import urllib.request
from pathlib import Path
# pyrefly: ignore [missing-import]
from ultralytics import YOLO

url = "https://github.com/gianlucasposito/YOLO-Waste-Detection/raw/main/best_model.pt"
out_path = Path(r"c:\Study\Projects\smart waste management\data\models\best_model.pt")

try:
    print("Downloading model...")
    urllib.request.urlretrieve(url, out_path)
    print("Downloaded to", out_path)
    
    # Check classes
    model = YOLO(out_path)
    print(model.names)
except Exception as e:
    print("Failed:", e)
