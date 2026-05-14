# pyrefly: ignore [missing-import]
from ultralytics import YOLO
import functools
# pyrefly: ignore [missing-import]
import torch

torch.load = functools.partial(torch.load, weights_only=False)

try:
    print("--- garbage.pt ---")
    model = YOLO(r"c:\Study\Projects\smart waste management\data\models\garbage.pt")
    results = model(r"c:\Study\Projects\smart waste management\data\uploads\3.jpg", conf=0.01)
    print("Boxes:", len(results[0].boxes))
    for b in results[0].boxes:
        print("Class:", model.names[int(b.cls[0])], "Conf:", float(b.conf[0]))
    
    print("--- yolov8m.pt ---")
    model2 = YOLO(r"c:\Study\Projects\smart waste management\data\models\yolov8m.pt")
    results2 = model2(r"c:\Study\Projects\smart waste management\data\uploads\3.jpg", conf=0.1)
    print("Boxes:", len(results2[0].boxes))
    for b in results2[0].boxes:
        print("Class:", model2.names[int(b.cls[0])], "Conf:", float(b.conf[0]))

except Exception as e:
    print("Error:", e)
