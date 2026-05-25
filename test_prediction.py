import os
import sys
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import cv2
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.ai.classifier import WasteClassifier
from backend.ai.detector import WasteDetector

def test_classifier():
    classifier = WasteClassifier()
    if not classifier._model_loaded:
        print("Classifier model not loaded!")
        return

    print("Classes in model:", classifier.classes)
    
    battery_dir = Path("datasets/battery")
    files = list(battery_dir.glob("*.jpg"))[:20] # Test first 20 battery images
    
    print("\nTesting individual crops directly on WasteClassifier:")
    for f in files:
        img = cv2.imread(str(f))
        pred = classifier.predict(img)
        if pred:
            cls, conf = pred
            print(f"  {f.name}: predicted={cls} (conf={conf:.2%})")
        else:
            print(f"  {f.name}: failed to predict")

if __name__ == "__main__":
    test_classifier()
