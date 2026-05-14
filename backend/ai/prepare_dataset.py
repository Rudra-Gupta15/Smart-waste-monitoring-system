import os
import shutil
import random
from pathlib import Path

# Paths
BASE_DIR = Path(r"c:\Study\Projects\smart waste management")
SOURCE_DIR = BASE_DIR / "Waste"
DATASET_DIR = BASE_DIR / "custom_dataset"

def prepare_dataset():
    # Create directories
    for split in ["train", "val"]:
        for subdir in ["images", "labels"]:
            (DATASET_DIR / split / subdir).mkdir(parents=True, exist_ok=True)
            
    # Get all image files that have labels
    image_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    all_images = [f for f in SOURCE_DIR.iterdir() if f.suffix.lower() in image_extensions]
    labeled_images = [img for img in all_images if img.with_suffix(".txt").exists()]
    
    print(f"Found {len(labeled_images)} labeled images.")
    
    # Shuffle and split
    random.shuffle(labeled_images)
    split_idx = int(len(labeled_images) * 0.8)
    train_images = labeled_images[:split_idx]
    val_images = labeled_images[split_idx:]
    
    def copy_files(img_list, split):
        for img_path in img_list:
            label_path = img_path.with_suffix(".txt")
            
            # Copy image
            shutil.copy(img_path, DATASET_DIR / split / "images" / img_path.name)
            # Copy label
            shutil.copy(label_path, DATASET_DIR / split / "labels" / label_path.name)
            
    copy_files(train_images, "train")
    copy_files(val_images, "val")
    
    # Create data.yaml
    yaml_content = f"""
train: {DATASET_DIR.as_posix()}/train/images
val: {DATASET_DIR.as_posix()}/val/images

nc: 1
names: ['Garbage']
"""
    with open(DATASET_DIR / "data.yaml", "w") as f:
        f.write(yaml_content.strip())
        
    print(f"Dataset prepared at {DATASET_DIR}")
    print(f"Train: {len(train_images)} images, Val: {len(val_images)} images")

if __name__ == "__main__":
    prepare_dataset()
