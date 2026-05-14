
import sys
import os

print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")

try:
    # pyrefly: ignore [missing-import]
    import fastapi
    print("fastapi imported successfully")
except ImportError as e:
    print(f"fastapi import failed: {e}")

try:
    # pyrefly: ignore [missing-import]
    import uvicorn
    print("uvicorn imported successfully")
except ImportError as e:
    print(f"uvicorn import failed: {e}")

try:
    # pyrefly: ignore [missing-import]
    import cv2
    print(f"cv2 version: {cv2.__version__}")
except ImportError as e:
    print(f"cv2 import failed: {e}")

try:
    # pyrefly: ignore [missing-import]
    import numpy as np
    print(f"numpy version: {np.__version__}")
except ImportError as e:
    print(f"numpy import failed: {e}")

try:
    # pyrefly: ignore [missing-import]
    import torch
    print(f"torch version: {torch.__version__}")
except ImportError as e:
    print(f"torch import failed: {e}")

try:
    # pyrefly: ignore [missing-import]
    from ultralytics import YOLO
    print("ultralytics imported successfully")
except ImportError as e:
    print(f"ultralytics import failed: {e}")
