import os
import sys
import json
from dotenv import load_dotenv
from pymongo import MongoClient
from openai import OpenAI
import torch
import torchaudio
import numpy as np
import librosa
import re
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
from google.cloud import vision
import io
from video import scores
from validateClaimedTechnologies import validate_technologies

load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../spartan-theorem-448917-k2-7f82253f1747.json"))
MONGODB_URI = os.getenv("MONGODB")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

print("Loading CrisperWhisper...", file=sys.stderr, flush=True)
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
    print("Transcribing audio...", file=sys.stderr, flush=True)
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
    print("Extracting rubric via OCR...", file=sys.stderr, flush=True)
    client = vision.ImageAnnotatorClient()
    with io.open(image_path, 'rb') as image_file:
        content = image_file.read()
    image = vision.Image(content=content)
    response = client.text_detection(image=image)
    return response.text_annotations[0].description if response.text_annotations else ""

def score_content_against_rubric(transcript, rubric_text):
    print("Scoring content using OpenAI...", file=sys.stderr, flush=True)
    prompt = f"""
Rubric:
{rubric_text}

Transcript:
{transcript}

Score the transcript 0-100 based on rubric coverage. Be strict. Short/vague responses = low scores. Respond with a single number only.
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

def return_values():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "recording.wav")
    rubric_path = os.path.join(base_dir, "rubric.pdf")

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
    print("\nExtracted Rubric Text:\n", rubric_text, file=sys.stderr, flush=True)
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

    print("\n=== Evaluation Summary ===", file=sys.stderr, flush=True)
    print("Transcript:\n", transcript, file=sys.stderr, flush=True)
    print(f"Rubric Score (content): {rubric_score:.2f}", file=sys.stderr, flush=True)
    print(f"Fluency Component Score: {fluency_component_score:.2f}", file=sys.stderr, flush=True)
    print(f"Combined Audio Score: {combined_audio_score:.2f}", file=sys.stderr, flush=True)
    print(f"Video Score: {video_score:.2f}", file=sys.stderr, flush=True)
    print(f"Final Combined Score: {final_score:.2f} ({final_rating})", file=sys.stderr, flush=True)

    return float(final_score.__round__(2) * 100), final_rating, transcript

def fetch_description_from_mongodb(project_id: str):
    print("Fetching project description from MongoDB...", file=sys.stderr, flush=True)
    mongo_client = MongoClient(MONGODB_URI)
    db = mongo_client["github_repos"]
    collection = db["descriptions"]
    doc = collection.find_one({"owner_repo": project_id})
    if doc and "description" in doc:
        return doc["description"]
    else:
        print(f"No description found for project_id '{project_id}'.", file=sys.stderr, flush=True)
        return None

def compare_with_openai(transcript: str, description: str):
    prompt = f"""
Transcript:
{transcript}

Project Description:
{description}

1. List mentioned technologies.
2. Score alignment 0-100 between transcript and description.

Respond in JSON:
{{
  "claimed_technologies": [...],
  "alignment_score": number
}}
"""
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        content = response.choices[0].message.content.strip()
        data = json.loads(content)
        return data.get("alignment_score", 0), data.get("claimed_technologies", [])
    except Exception as e:
        print("Error in compare_with_openai:", e, file=sys.stderr, flush=True)
        return 0, []

def generate_feedback(score):
    if score > 80:
        return "The transcript closely matches the description. Great job!"
    elif score > 50:
        return "The transcript somewhat matches the description. Consider improving alignment."
    else:
        return "The transcript does not match the description well. Significant improvements are needed."

def main(project_id: str):
    final_score, _, transcript = return_values()
    description = fetch_description_from_mongodb(project_id)
    if not description:
        return {"error": "Description not found in MongoDB."}

    similarity_score, claimed_tech = compare_with_openai(transcript, description)
    feedback = generate_feedback(similarity_score)

    validation_result = validate_technologies(project_id, claimed_tech)

    print("\n=== Comparison Results ===", file=sys.stderr, flush=True)
    print(f"Similarity Score: {similarity_score:.2f}", file=sys.stderr, flush=True)
    print("Feedback:", feedback, file=sys.stderr, flush=True)
    print("Technology Validation:", validation_result, file=sys.stderr, flush=True)

    return {
        "transcript": transcript,
        "description": description,
        "similarity_score": similarity_score,
        "feedback": feedback,
        "claimed_technologies": claimed_tech,
        "validation": validation_result
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Owner and repo arguments missing"}), file=sys.stderr, flush=True)
        sys.exit(1)

    owner = sys.argv[1]
    repo = sys.argv[2]
    project_id = f"{owner}_{repo}"

    result = main(project_id)
    print(json.dumps(result))