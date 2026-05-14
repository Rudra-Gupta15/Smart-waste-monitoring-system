import os
import shutil
import random
from pathlib import Path
# pyrefly: ignore [missing-import]
from ultralytics import YOLO

# Folders
BASE_DIR = Path(__file__).resolve().parent
WASTE_DIR = BASE_DIR / "Waste"
DATASET_DIR = BASE_DIR / "datasets" / "garbage"

# YOLO dataset structure
DIRS = {
    "images_train": DATASET_DIR / "images" / "train",
    "images_val": DATASET_DIR / "images" / "val",
    "labels_train": DATASET_DIR / "labels" / "train",
    "labels_val": DATASET_DIR / "labels" / "val",
}

def setup_dataset():
    print("[*] Setting up dataset...")
    # Create directories
    for d in DIRS.values():
        d.mkdir(parents=True, exist_ok=True)
    
    # Get all images and their matching text files
    images = []
    for ext in ["*.jpg", "*.jpeg", "*.png"]:
        images.extend(list(WASTE_DIR.glob(ext)))
        
    print(f"Found {len(images)} images in Waste folder.")
    
    # Shuffle for train/val split
    random.shuffle(images)
    split_idx = int(len(images) * 0.8)
    train_imgs = images[:split_idx]
    val_imgs = images[split_idx:]
    
    def copy_files(img_list, split):
        for img_path in img_list:
            label_path = img_path.with_suffix(".txt")
            
            # If label doesn't exist, we skip or assume empty. Let's create empty label if missing.
            if not label_path.exists():
                label_path.touch()
                
            shutil.copy(img_path, DIRS[f"images_{split}"] / img_path.name)
            shutil.copy(label_path, DIRS[f"labels_{split}"] / label_path.name)

    copy_files(train_imgs, "train")
    copy_files(val_imgs, "val")
    
    # Create YAML config
    yaml_content = f"""
path: {DATASET_DIR.absolute()}
train: images/train
val: images/val

names:
  0: garbage
  1: plastic_bag
  2: trash_bag
  3: litter
  4: garbage_pile
  5: bin
"""
    yaml_path = DATASET_DIR / "data.yaml"
    with open(yaml_path, "w") as f:
        f.write(yaml_content.strip())
        
    print(f"Dataset created at {DATASET_DIR}")
    return yaml_path

def train_model(yaml_path):
    print("[*] Starting training...")
    # Start with YOLOv8 nano for speed
    model = YOLO("yolov8n.pt")
    
    results = model.train(
        data=str(yaml_path),
        epochs=10,            # 10 epochs for a quick test
        imgsz=640,
        batch=4,              # Low batch size to avoid memory issues
        name="garbage_model"
    )
    
    # Move trained model to data/models/garbage.pt
    model_dest = BASE_DIR / "data" / "models" / "garbage.pt"
    model_dest.parent.mkdir(parents=True, exist_ok=True)
    
    trained_weights = Path(results.save_dir) / "weights" / "best.pt"
    shutil.copy(trained_weights, model_dest)
    print(f"\n[SUCCESS] Model successfully trained and saved to {model_dest} !")
    print("Restart your web server to begin using the custom garbage detector.")

if __name__ == "__main__":
    yaml_file = setup_dataset()
    train_model(yaml_file)
