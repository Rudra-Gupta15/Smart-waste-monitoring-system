import os
from pathlib import Path

DATASET_DIR = Path("datasets")
categories = sorted([d.name for d in DATASET_DIR.iterdir() if d.is_dir() and d.name != "garbage"])
print("Dataset size per class:")
total = 0
for cat in categories:
    cat_dir = DATASET_DIR / cat
    files = [f for f in cat_dir.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]]
    print(f"  {cat}: {len(files)} images")
    total += len(files)
print(f"Total fine-grained images: {total}")
