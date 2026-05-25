import os
import random
from pathlib import Path
# pyrefly: ignore [missing-import]
from PIL import Image

# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import torch.nn as nn
# pyrefly: ignore [missing-import]
import torch.optim as optim
# pyrefly: ignore [missing-import]
from torch.utils.data import Dataset, DataLoader
# pyrefly: ignore [missing-import]
import torchvision.models as models

# Folders
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "datasets"
MODEL_DEST = BASE_DIR / "data" / "models" / "waste_classifier.pt"

# Set device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[*] Using device: {device}")

# ------------------------------------------------------------------
# 1. Custom CNN Architecture (Jetson-Optimized)
# ------------------------------------------------------------------
class WasteCNN(nn.Module):
    """
    A lightweight, high-performance deep CNN optimized for edge devices like Jetson Nano.
    Uses a MobileNetV3-small backbone fine-tuned for waste classification.
    """
    def __init__(self, num_classes):
        super(WasteCNN, self).__init__()
        # Load a pretrained MobileNetV3 small backbone
        self.backbone = models.mobilenet_v3_small(pretrained=True)
        # Modify the classifier head to output num_classes
        in_features = self.backbone.classifier[3].in_features
        self.backbone.classifier[3] = nn.Linear(in_features, num_classes)

    def forward(self, x):
        return self.backbone(x)

# ------------------------------------------------------------------
# 2. PyTorch Custom Dataset
# ------------------------------------------------------------------
class WasteDataset(Dataset):
    def __init__(self, file_paths, labels, is_train=False):
        self.file_paths = file_paths
        self.labels = labels
        self.is_train = is_train

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        img_path = self.file_paths[idx]
        label = self.labels[idx]
        
        # Load image in RGB
        try:
            with Image.open(img_path) as img:
                img = img.convert("RGB")
                
                # Apply data augmentation only during training
                if self.is_train:
                    # Random horizontal flip
                    if random.random() > 0.5:
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    # Random rotation (+/- 15 degrees)
                    if random.random() > 0.5:
                        angle = random.randint(-15, 15)
                        img = img.rotate(angle)
                
                img = img.resize((128, 128))
                
                # Convert to numpy and then to tensor (100x faster than pure python getdata loop)
                # pyrefly: ignore [missing-import]
                import numpy as np
                img_np = np.array(img, dtype=np.float32) / 255.0
                tensor_img = torch.from_numpy(img_np).permute(2, 0, 1)
                
                # Normalize: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
                mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
                std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
                tensor_img = (tensor_img - mean) / std
        except Exception as e:
            # Fallback for broken images
            print(f"[!] Warning: Failed to load {img_path}, returning dummy tensor.")
            tensor_img = torch.zeros(3, 128, 128)
            
        return tensor_img, label

# ------------------------------------------------------------------
# 3. Training Function
# ------------------------------------------------------------------
def train():
    # Discover categories
    categories = sorted([
        d.name for d in DATASET_DIR.iterdir()
        if d.is_dir() and d.name != "garbage"
    ])
    
    print(f"[*] Discovered {len(categories)} classes: {categories}")
    class_to_idx = {name: i for i, name in enumerate(categories)}
    
    # Gather image files
    all_files = []
    all_labels = []
    
    image_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    
    # Increased cap to 400 for robust training on a larger subset (fast due to numpy optimization)
    MAX_IMAGES_PER_CLASS = 400
    
    for category in categories:
        cat_dir = DATASET_DIR / category
        files = [
            f for f in cat_dir.iterdir()
            if f.suffix.lower() in image_extensions
        ]
        
        print(f"  Class '{category}': found {len(files)} images. Using up to {MAX_IMAGES_PER_CLASS}.")
        # Shuffle files before capping to ensure we get a random diverse subset
        random.shuffle(files)
        files = files[:MAX_IMAGES_PER_CLASS]
        
        for f in files:
            all_files.append(f)
            all_labels.append(class_to_idx[category])
            
    if not all_files:
        print("[ERROR] No image files found in datasets directory!")
        return
 
    # Shuffle and split (80% train, 20% validation)
    combined = list(zip(all_files, all_labels))
    random.shuffle(combined)
    
    split_idx = int(len(combined) * 0.8)
    train_data = combined[:split_idx]
    val_data = combined[split_idx:]
    
    train_files, train_labels = zip(*train_data)
    val_files, val_labels = zip(*val_data)
    
    print(f"[*] Training items: {len(train_files)} | Validation items: {len(val_files)}")
    
    train_dataset = WasteDataset(train_files, train_labels, is_train=True)
    val_dataset = WasteDataset(val_files, val_labels, is_train=False)
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)
    
    # Instantiate Model
    model = WasteCNN(num_classes=len(categories)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.0005, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=2, gamma=0.5)
    
    epochs = 6 # 6 epochs is perfect for a quick, robust training session with MobileNetV3
    best_val_acc = 0.0
    
    print("[*] Starting training loop...")
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
        epoch_loss = running_loss / total
        epoch_acc = correct / total
        
        # Validation phase
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
                
        val_acc = val_correct / val_total
        scheduler.step()
        
        print(f"Epoch [{epoch+1}/{epochs}] - Train Loss: {epoch_loss:.4f} | Train Acc: {epoch_acc:.2%} | Val Acc: {val_acc:.2%}")
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            MODEL_DEST.parent.mkdir(parents=True, exist_ok=True)
            
            # Save weights, class definitions, and metadata in one file!
            checkpoint = {
                "state_dict": model.state_dict(),
                "classes": categories,
                "input_size": [3, 128, 128]
            }
            torch.save(checkpoint, MODEL_DEST)
            print(f"  [+] Saved new best model checkpoint to {MODEL_DEST}")
            
    print(f"\n[SUCCESS] Training finished! Best validation accuracy: {best_val_acc:.2%}")
    print(f"Jetson-optimized classifier weights saved to {MODEL_DEST}")

if __name__ == "__main__":
    train()
