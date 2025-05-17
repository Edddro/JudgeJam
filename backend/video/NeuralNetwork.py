import torch
import torchaudio
import numpy as np
import librosa
import re
import openai
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
from google.cloud import vision
import io
from video import scores
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

print("Loading CrisperWhisper...")
processor = AutoProcessor.from_pretrained("nyrahealth/CrisperWhisper")
model = AutoModelForSpeechSeq2Seq.from_pretrained("nyrahealth/CrisperWhisper")
model.eval()
device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)

FILLER_REGEX = re.compile(
    r"\[(UM|UH|ERM|YEAH|HMM|LIKE + UM|URM|YOU KNOW|SO|ACTUALLY|BASICALLY|I MEAN)\]", re.IGNORECASE
)

def load_audio(file_path):
    waveform, sr = torchaudio.load(file_path)
    if sr != 16000:
        waveform = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)(waveform)
        sr = 16000
    return waveform[0].numpy().astype(np.float32), sr

def transcribe_audio(waveform, sample_rate):
    print("Transcribing audio...")
    inputs = processor(waveform, sampling_rate=sample_rate, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        predicted_ids = model.generate(inputs["input_features"])
    transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
    return transcription

def detect_filler_words(transcription):
    filler_matches = FILLER_REGEX.findall(transcription)
    filler_count = len(filler_matches)
    words = re.findall(r"\b\w+\b", transcription)
    total_words = len(words)
    filler_ratio = filler_count / total_words if total_words > 0 else 0
    return filler_count, total_words, filler_ratio

def extract_energy(waveform):
    return np.sqrt(np.mean(waveform ** 2))

def extract_pitch(waveform, sr):
    try:
        pitches, voiced_flag, _ = librosa.pyin(
            waveform,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            hop_length=512
        )
    except Exception:
        return 0.0
    voiced_pitches = pitches[voiced_flag]
    if len(voiced_pitches) == 0:
        return 0.0
    return float(np.std(voiced_pitches))

def normalize(value, min_val, max_val):
    return max(0, min(1, (value - min_val) / (max_val - min_val)))

def extract_rubric_text(image_path):
    print("Extracting rubric via OCR...")
    client = vision.ImageAnnotatorClient()
    with io.open(image_path, 'rb') as image_file:
        content = image_file.read()
    image = vision.Image(content=content)
    response = client.text_detection(image=image)
    return response.text_annotations[0].description if response.text_annotations else ""

def score_content_against_rubric(transcript, rubric_text):
    print("Scoring content using OpenAI...")

    prompt = f"""
You are an evaluator grading a student's presentation. Rate the transcript from 0 to 100 based on how well it meets the following rubric criteria:

Rubric:
{rubric_text}

Transcript:
{transcript}

Give a score from 0 to 100 depending on how thoroughly the transcript addresses the rubric criteria. Be critical: short or vague responses (e.g., under 10 words or generic language) should receive very low scores. Only respond with a single numeric score (0-100). No explanation.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        score_str = response.choices[0].message.content.strip()
        return float(score_str)
    except Exception as e:
        print("Error during OpenAI scoring:", e)
        return 0.0

def main():
    file_path = "./recording.wav"
    rubric_path = "./rubric.pdf"

    waveform, sr = load_audio(file_path)
    transcript = transcribe_audio(waveform, sr)
    filler_count, total_words, filler_ratio = detect_filler_words(transcript)
    energy = extract_energy(waveform)
    pitch_var = extract_pitch(waveform, sr)

    norm_filler = 1 - min(filler_ratio * 10, 1)
    norm_energy = normalize(energy, 0.01, 0.1)
    norm_pitch = normalize(pitch_var, 0, 50)
    fluency_component_score = (norm_filler + norm_energy + norm_pitch) / 3 * 100

    rubric_text = extract_rubric_text(rubric_path)
    print("\nExtracted Rubric Text:\n", rubric_text)
    rubric_score = score_content_against_rubric(transcript, rubric_text)

    combined_audio_score = (0.5 * rubric_score) + (0.5 * fluency_component_score)

    video_metrics = scores()
    video_score = video_metrics.get("final_score", 0.0)
    final_score = (combined_audio_score + video_score) / 2

    if final_score > 80:
        final_rating = "Excellent"
    elif final_score > 60:
        final_rating = "Good"
    elif final_score > 40:
        final_rating = "Fair"
    else:
        final_rating = "Needs Improvement"

    print("\n=== Evaluation Summary ===")
    print("Transcript:\n", transcript)
    print(f"Rubric Score (content): {rubric_score:.2f}")
    print(f"Fluency Component Score: {fluency_component_score:.2f}")
    print(f"Combined Audio Score: {combined_audio_score:.2f}")
    print(f"Video Score: {video_score:.2f}")
    print(f"Final Combined Score: {final_score:.2f} ({final_rating})")

    return float(final_score.__round__(2) * 100), final_rating

if __name__ == "__main__":
    main()