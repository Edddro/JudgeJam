import torch
import torchaudio
import numpy as np
import librosa
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
import re
from video import scores

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
    # RMS energy (fast, vectorized)
    return np.sqrt(np.mean(waveform ** 2))

def extract_pitch(waveform, sr):
    # librosa.pyin is slow, so limit max frames by downsampling
    hop_length = 512
    try:
        pitches, voiced_flag, _ = librosa.pyin(
            waveform,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            hop_length=hop_length
        )
    except Exception:
        # fallback pitch = 0 if pyin fails
        return 0.0
    voiced_pitches = pitches[voiced_flag]
    if len(voiced_pitches) == 0:
        return 0.0
    return float(np.std(voiced_pitches))

def normalize(value, min_val, max_val):
    return max(0, min(1, (value - min_val) / (max_val - min_val)))

def score_fluency(filler_ratio, energy, pitch_var):
    norm_filler = 1 - min(filler_ratio * 10, 1)
    norm_energy = normalize(energy, 0.01, 0.1)
    norm_pitch = normalize(pitch_var, 0, 50)
    combined_score = (0.5 * norm_filler) + (0.3 * norm_pitch) + (0.2 * norm_energy)
    return combined_score * 100

def main():
    file_path = "./recording.wav"
    waveform, sr = load_audio(file_path)

    transcript = transcribe_audio(waveform, sr)
    print("\nTranscription:\n", transcript)

    filler_count, total_words, filler_ratio = detect_filler_words(transcript)
    energy = extract_energy(waveform)
    pitch_var = extract_pitch(waveform, sr)

    combined_score_audio = score_fluency(filler_ratio, energy, pitch_var)

    video_metrics = scores()
    print(video_metrics)

    video_score = video_metrics.get("final_score", 0.0)

    # Combine audio and video scores
    final_score = (combined_score_audio + video_score) / 2

    # Final rating based on combined score
    if final_score > 80:
        final_rating = "Excellent"
    elif final_score > 60:
        final_rating = "Good"
    elif final_score > 40:
        final_rating = "Fair"
    else:
        final_rating = "Needs Improvement"

    # Print results
    print(f"\nFiller Words Detected: {filler_count}")
    print(f"Total Words: {total_words}")
    print(f"Filler Word Ratio: {filler_ratio:.2%}")
    print(f"Energy (RMS): {energy:.4f}")
    print(f"Pitch Variability (std Hz): {pitch_var:.2f}")
    print(f"Combined Audio Fluency Score: {combined_score_audio:.2f}")
    print(f"Video Score: {video_score:.2f}")
    print(f"Final Combined Score: {final_score:.2f} ({final_rating})")

    print("\n=== Overall Speaking Quality Score ===")
    print(f"Final Score (0-1 scale): {final_score:.2f}% ({final_rating})")

    return float(final_score.__round__(2) * 100), final_rating

if __name__ == "__main__":
    main()

# return feedback (like be more positive) and compare code with description and pitch