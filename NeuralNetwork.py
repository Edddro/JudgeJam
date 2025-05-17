import torch
import torch.nn as nn
import torch.nn.functional as F
import librosa
import numpy as np
from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
import soundfile as sf

# -------- PART 1: Load Audio & Extract Features --------

AUDIO_PATH = "/Users/anishpaleja/Desktop/eagle.wav"

def extract_audio_features(audio_path):
    y, sr = librosa.load(audio_path)
    
    # Compute pitch and energy
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    pitch_sequence = []
    for i in range(pitches.shape[1]):
        index = magnitudes[:, i].argmax()
        pitch = pitches[index, i]
        if pitch > 0:
            pitch_sequence.append(pitch)
    pitch_sequence = np.array(pitch_sequence)
    if len(pitch_sequence) == 0:
        pitch_mean = 0
        pitch_std = 0
    else:
        pitch_mean = np.mean(pitch_sequence)
        pitch_std = np.std(pitch_sequence)

    energy = np.array([np.sum(np.abs(y[i:i+2048]**2)) for i in range(0, len(y), 2048)])
    energy_mean = np.mean(energy)
    energy_std = np.std(energy)

    return pitch_mean, pitch_std, energy_mean, energy_std

# --------- PART 2: Transcribe Audio --------

def transcribe_audio(audio_path):
    import whisper
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    return result['text']

# -------- PART 3: Detect Filler Words Using Hugging Face Model --------

def detect_filler_words(text):
    tokenizer = AutoTokenizer.from_pretrained("navjordj/disfluency-detection-roberta")
    model = AutoModelForTokenClassification.from_pretrained("navjordj/disfluency-detection-roberta")
    nlp = pipeline("token-classification", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
    
    results = nlp(text)
    filler_count = sum(1 for r in results if r['entity_group'] == 'DISFLUENCY')
    total_tokens = len(results)
    filler_ratio = filler_count / max(total_tokens, 1)
    return filler_count, filler_ratio

# -------- PART 4: Define Neural Network --------

class EnthusiasmScorer(nn.Module):
    def __init__(self):
        super(EnthusiasmScorer, self).__init__()
        self.fc1 = nn.Linear(5, 32)
        self.fc2 = nn.Linear(32, 16)
        self.out = nn.Linear(16, 1)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        return torch.sigmoid(self.out(x))

# -------- PART 5: Run All Steps and Predict Score --------

def run_full_pipeline(audio_path):
    print("Extracting audio features...")
    pitch_mean, pitch_std, energy_mean, energy_std = extract_audio_features(audio_path)
    
    print("Transcribing audio...")
    transcription = transcribe_audio(audio_path)
    print("Transcript:", transcription)
    
    print("Detecting filler words...")
    filler_count, filler_ratio = detect_filler_words(transcription)
    print("Filler word count:", filler_count)
    print("Filler word ratio:", round(filler_ratio, 3))

    # Input vector: [pitch_mean, pitch_std, energy_mean, energy_std, filler_ratio]
    input_vector = torch.tensor([pitch_mean, pitch_std, energy_mean, energy_std, filler_ratio], dtype=torch.float32)
    
    model = EnthusiasmScorer()
    
    print("Scoring enthusiasm...")
    score = model(input_vector).item()
    print("Enthusiasm Score:", round(score * 100, 2), "%")

if __name__ == "__main__":
    run_full_pipeline(AUDIO_PATH)
