import os
from pathlib import Path
from typing import Optional, Tuple, List

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import torch.nn as nn
# pyrefly: ignore [missing-import]
import torchvision.models as models

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
# 2. Classifier Wrapper Class
# ------------------------------------------------------------------
class WasteClassifier:
    """
    Wrapper class to load the trained WasteCNN weights and classify
    cropped waste bounding boxes from OpenCV images.
    """
    def __init__(self, model_path: Optional[str] = None):
        # Configure model path default
        if model_path is None:
            from backend.app.config import MODELS_DIR
            model_path = str(MODELS_DIR / "waste_classifier.pt")
            
        self.model_path = model_path
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[WasteCNN] = None
        self.classes: List[str] = []
        self._model_loaded = False
        
        # Mean/Std for normalization
        self.mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1).to(self.device)
        self.std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1).to(self.device)
        
        # Load the model weights
        self.load_model()

    def load_model(self):
        """Loads weights and classes from checkpoint file."""
        model_path = Path(self.model_path)
        
        if not model_path.exists():
            print(f"[Classifier] WARNING: Model file not found at '{model_path}'. Sub-classification will be disabled.")
            return

        try:
            print(f"[Classifier] Loading waste classifier from '{model_path}' on device '{self.device}'...")
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            # Extract classes metadata
            self.classes = checkpoint.get("classes", [])
            if not self.classes:
                raise ValueError("Checkpoint is missing classes metadata.")
                
            # Recreate model with correct output size
            self.model = WasteCNN(num_classes=len(self.classes)).to(self.device)
            self.model.load_state_dict(checkpoint["state_dict"])
            self.model.eval()
            self._model_loaded = True
            
            print(f"[Classifier] Success! Loaded {len(self.classes)} classes: {self.classes}")
        except Exception as e:
            print(f"[Classifier] ERROR: Failed to load model weights: {e}")
            self.model = None
            self._model_loaded = False

    def predict(self, crop_img: np.ndarray) -> Optional[Tuple[str, float]]:
        """
        Classifies a single cropped waste bounding box.
        
        Args:
            crop_img: OpenCV BGR image crop of the waste item.
            
        Returns:
            Tuple of (class_name, confidence) or None if model is not loaded or prediction fails.
        """
        if not self._model_loaded or self.model is None:
            return None
            
        # Ensure crop is valid
        if crop_img is None or crop_img.size == 0:
            return None
            
        try:
            # 1. Convert BGR to RGB
            rgb_crop = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
            
            # 2. Resize to 128x128
            resized = cv2.resize(rgb_crop, (128, 128), interpolation=cv2.INTER_LINEAR)
            
            # 3. Convert to FloatTensor, transpose to [C, H, W] and scale to [0, 1]
            tensor_img = torch.FloatTensor(resized).permute(2, 0, 1).to(self.device) / 255.0
            
            # 4. Standard Normalize
            tensor_img = (tensor_img - self.mean) / self.std
            
            # 5. Add batch dimension
            tensor_img = tensor_img.unsqueeze(0)
            
            # 6. Predict
            with torch.no_grad():
                outputs = self.model(tensor_img)
                probabilities = torch.softmax(outputs, dim=1)[0]
                confidence, class_idx = torch.max(probabilities, dim=0)
                
                predicted_class = self.classes[class_idx.item()]
                return predicted_class, confidence.item()
                
        except Exception as e:
            print(f"[Classifier] Prediction error: {e}")
            return None
