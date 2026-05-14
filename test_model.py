# pyrefly: ignore [missing-import]
from ultralytics import YOLO
import functools
# pyrefly: ignore [missing-import]
import torch

torch.load = functools.partial(torch.load, weights_only=False)

try:
    model = YOLO(r"c:\Study\Projects\smart waste management\data\models\garbage.pt")
    print(model.names)
except Exception as e:
    print("Error:", e)
