# pyrefly: ignore [missing-import]
import cv2
import time
from backend.ai.detector import WasteDetector

det = WasteDetector(model_path=r"c:\Study\Projects\smart waste management\data\models\best_model.pt")

while det.model is None:
    time.sleep(0.5)

img = cv2.imread(r"c:\Study\Projects\smart waste management\data\uploads\pexels-fernando-makers-305644384-13537446.jpg")
if img is not None:
    res = det.detect(img)
    print("Total detections from _run_detection:", len(res.detections))
    for d in res.detections:
        print(f"Class: {d.class_name}, Conf: {d.confidence}, Types: {getattr(d, 'types_list', [])}")
else:
    print("Failed to read image")
