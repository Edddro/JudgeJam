import cv2
import mediapipe as mp
from deepface import DeepFace
from collections import Counter

cap = cv2.VideoCapture(0)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose()

gesture_count = 0
emotion_counts = Counter()
frame_count = 0
good_posture_frames = 0
posture_score_count = 0
prev_center_x = None
movement_deltas = []

print("⏳ Starting live analysis. Press 'q' to stop.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1

    display_frame = cv2.flip(frame.copy(), 1)

    if frame_count % 15 == 0:
        try:
            result = DeepFace.analyze(display_frame, actions=["emotion"], enforce_detection=False)
            dominant_emotion = result[0]['dominant_emotion']
            emotion_counts[dominant_emotion] += 1
        except Exception:
            pass

    rgb_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
    result = pose.process(rgb_frame)

    if result.pose_landmarks:
        landmarks = result.pose_landmarks.landmark

        left_hand = landmarks[mp_pose.PoseLandmark.LEFT_WRIST]
        right_hand = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]

        if left_hand.visibility > 0.5 and left_hand.y < right_shoulder.y:
            gesture_count += 1
        elif right_hand.visibility > 0.5 and right_hand.y < right_shoulder.y:
            gesture_count += 1

        nose = landmarks[mp_pose.PoseLandmark.NOSE]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]

        shoulder_avg_y = (left_shoulder.y + right_shoulder.y) / 2
        hip_avg_y = (left_hip.y + right_hip.y) / 2
        torso_length = hip_avg_y - shoulder_avg_y
        head_tilt = abs(nose.x - ((left_shoulder.x + right_shoulder.x) / 2))

        posture_score_count += 1
        if torso_length > 0.1 and head_tilt < 0.05:
            good_posture_frames += 1

        mid_hip_x = (left_hip.x + right_hip.x) / 2
        if prev_center_x is not None:
            delta_x = abs(mid_hip_x - prev_center_x)
            movement_deltas.append(delta_x)
        prev_center_x = mid_hip_x

    cv2.putText(display_frame, "Press 'q' to quit", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    cv2.imshow('Live Pitch Evaluator', display_frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

positive_emotions = emotion_counts['happy'] + emotion_counts['surprise'] + emotion_counts['neutral']
total_emotion_frames = sum(emotion_counts.values())
emotion_score = (positive_emotions / max(1, total_emotion_frames)) * 100

gesture_score = (gesture_count / max(1, frame_count)) * 100

posture_score = (good_posture_frames / max(1, posture_score_count)) * 100

avg_movement = sum(movement_deltas) / max(1, len(movement_deltas))
if avg_movement < 0.002:
    movement_score = 20
elif avg_movement > 0.015:
    movement_score = 30 
else:
    movement_score = 100

final_score = round(0.3 * emotion_score + 0.2 * gesture_score + 0.2 * posture_score + 0.3 * movement_score, 2)

print("\n📊 Final Pitch Evaluation")
print(f"😀 Emotion Score:     {emotion_score:.2f}%")
print(f"🤝 Gesture Score:     {gesture_score:.2f}%")
print(f"💪 Posture Score:     {posture_score:.2f}%")
print(f"🚶 Movement Score:    {movement_score:.2f}%")
print(f"🏆 Final Score:       {final_score:.2f}%")
print(f"📈 Emotion Breakdown: {dict(emotion_counts)}")

def scores():
    return {
        "emotion_score": emotion_score,
        "gesture_score": gesture_score,
        "posture_score": posture_score,
        "movement_score": movement_score,
        "final_score": final_score,
        "emotion_counts": dict(emotion_counts)
    }