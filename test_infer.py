# pyrefly: ignore [missing-import]
from ultralytics import YOLO
import functools
# pyrefly: ignore [missing-import]
import torch

torch.load = functools.partial(torch.load, weights_only=False)

try:
    print("--- best_model.pt ---")
    model = YOLO(r"c:\Study\Projects\smart waste management\data\models\best_model.pt")
    results = model(r"c:\Study\Projects\smart waste management\data\uploads\6.jpg", conf=0.05)
    print("Boxes:", len(results[0].boxes))
    for b in results[0].boxes:
        print("Class:", model.names[int(b.cls[0])], "Conf:", float(b.conf[0]))

except Exception as e:
    print("Error:", e)
