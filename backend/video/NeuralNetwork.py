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
import argparse
import json

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
    parser = argparse.ArgumentParser()
    parser.add_argument('--rubric', type=str, required=True)
    parser.add_argument('--transcript', type=str, required=True)
    parser.add_argument('--media', type=str, required=False)
    args = parser.parse_args()

    file_path = args.transcript
    rubric_path = args.rubric
    media_path = args.media

    # If media is provided and is a .wav, use for audio analysis
    if media_path and media_path.endswith('.wav'):
        waveform, sr = load_audio(media_path)
        transcript = transcribe_audio(waveform, sr)
        energy = extract_energy(waveform)
        pitch_var = extract_pitch(waveform, sr)
    # If media is provided and is a .webm or .mp4, skip audio for now (could add extraction)
    elif media_path and (media_path.endswith('.webm') or media_path.endswith('.mp4')):
        transcript = open(file_path).read()
        waveform, sr = None, None
        energy, pitch_var = 0, 0
    else:
        waveform, sr = load_audio(file_path) if file_path.endswith('.wav') else (None, None)
        transcript = open(file_path).read() if not waveform else transcribe_audio(waveform, sr)
        energy = extract_energy(waveform) if waveform is not None else 0
        pitch_var = extract_pitch(waveform, sr) if waveform is not None else 0

    filler_count, total_words, filler_ratio = detect_filler_words(transcript)
    norm_filler = 1 - min(filler_ratio * 10, 1)
    norm_energy = normalize(energy, 0.01, 0.1)
    norm_pitch = normalize(pitch_var, 0, 50)
    fluency_component_score = (norm_filler + norm_energy + norm_pitch) / 3 * 100

    rubric_text = extract_rubric_text(rubric_path)
    rubric_score = score_content_against_rubric(transcript, rubric_text)

    combined_audio_score = (0.5 * rubric_score) + (0.5 * fluency_component_score)

    # If media is provided and is a video, optionally call video.py for pose/emotion
    video_metrics = {}
    if media_path and (media_path.endswith('.webm') or media_path.endswith('.mp4')):
        try:
            import subprocess
            # Call video.py and parse its output if needed
            # Example: subprocess.run(['python3', 'backend/video/video.py', '--input', media_path])
            # For now, just leave as empty or mock
            video_metrics = {}
        except Exception as e:
            video_metrics = {"error": str(e)}
    else:
        video_metrics = scores() if callable(scores) else {}
    video_score = video_metrics.get("final_score", 0.0) if video_metrics else 0.0
    final_score = (combined_audio_score + video_score) / 2

    if final_score > 80:
        final_rating = "Excellent"
    elif final_score > 60:
        final_rating = "Good"
    elif final_score > 40:
        final_rating = "Fair"
    else:
        final_rating = "Needs Improvement"

    result = {
        "transcript": transcript,
        "rubric_score": rubric_score,
        "fluency_component_score": fluency_component_score,
        "combined_audio_score": combined_audio_score,
        "video_score": video_score,
        "final_score": final_score,
        "final_rating": final_rating,
        "video_metrics": video_metrics,
    }
    print(json.dumps(result))
    return result

if __name__ == "__main__":
    main()