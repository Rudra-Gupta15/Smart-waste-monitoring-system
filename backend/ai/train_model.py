# pyrefly: ignore [missing-import]
from ultralytics import YOLO
import functools
# pyrefly: ignore [missing-import]
import torch

# Fix for PyTorch 2.6+
torch.load = functools.partial(torch.load, weights_only=False)

def train_model():
    # Load the base model
    model = YOLO("yolov8m.pt")
    
    # Train the model
    print("Starting training...")
    results = model.train(
        data="custom_dataset/data.yaml",
        epochs=30,
        imgsz=640,
        project="custom_training",
        name="waste_detector"
    )
    print("Training finished!")
    print(f"Model saved in custom_training/waste_detector/weights/best.pt")

if __name__ == "__main__":
    train_model()
