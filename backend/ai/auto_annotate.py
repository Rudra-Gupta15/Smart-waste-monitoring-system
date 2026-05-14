import os
# pyrefly: ignore [missing-import]
import cv2
from pathlib import Path
import functools
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
from ultralytics import YOLO

# Fix for PyTorch 2.6+ weights_only=True default loading error with Ultralytics models
torch.load = functools.partial(torch.load, weights_only=False)

# Paths
WASTE_DIR = Path(r"c:\Study\Projects\smart waste management\Waste")
MODEL_PATH = "yolov8m.pt"

# Waste proxy classes from config.py to consider as "Garbage"
WASTE_PROXIES = [
    "bottle", "cup", "bowl", "vase", 
    "banana", "apple", "orange", "sandwich", "hot dog", "pizza", "cake", "carrot", "donut",
    "suitcase", "backpack", "handbag", "umbrella",
    "toilet", "refrigerator", "microwave", "oven", "toaster", "sink",
    "chair", "couch", "bed", "dining table", "bench"
]

def auto_annotate():
    print(f"Loading model {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    
    # Get all image files
    image_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    images = [f for f in WASTE_DIR.iterdir() if f.suffix.lower() in image_extensions]
    
    print(f"Found {len(images)} images in {WASTE_DIR}")
    
    for img_path in images:
        print(f"Annotating {img_path.name}...")
        results = model(str(img_path))[0]
        
        label_path = img_path.with_suffix(".txt")
        yolo_lines = []
        
        img_h, img_w = results.orig_shape
        
        for box in results.boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            conf = float(box.conf[0])
            
            # If it's a known waste proxy, label it as class 0 (Garbage)
            if class_name in WASTE_PROXIES:
                # YOLO format: class x_center y_center width height (normalized)
                xywh = box.xywhn[0].tolist()
                line = f"0 {xywh[0]:.6f} {xywh[1]:.6f} {xywh[2]:.6f} {xywh[3]:.6f}\n"
                yolo_lines.append(line)
        
        # Save the .txt file
        with open(label_path, "w") as f:
            f.writelines(yolo_lines)
            
    print("Annotation complete! Each image now has a corresponding .txt label file.")
    print("Note: I labeled all detected waste objects as class '0' (Garbage).")

if __name__ == "__main__":
    auto_annotate()
