import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
EVIDENCE_DIR = DATA_DIR / "evidence"
MODELS_DIR = DATA_DIR / "models"

EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Detection settings
CONFIDENCE_THRESHOLD = 0.25
FRAME_INTERVAL = 3
CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", 0)
if str(CAMERA_SOURCE).isdigit():
    CAMERA_SOURCE = int(CAMERA_SOURCE)

# Camera Location
CAMERA_LAT = float(os.getenv("CAMERA_LAT", "21.1458"))
CAMERA_LNG = float(os.getenv("CAMERA_LNG", "79.0882"))

# Accuracy filters
MIN_BBOX_AREA_FRACTION = 0.0005  # Object bbox must be >=0.05% of frame area to catch tiny litter
MIN_CONSECUTIVE_DETECTIONS = 2  # Report after 2 consistent detections

# Per-class confidence overrides (stricter for context-dependent classes)
PER_CLASS_CONFIDENCE = {
    "bottle":       0.20,
    "cup":          0.20,
    "bowl":         0.20,
    "banana":       0.20,
    "apple":        0.20,
    "orange":       0.20,
    "sandwich":     0.20,
    "hot dog":      0.20,
    "pizza":        0.20,
    "cake":         0.20,
    "carrot":       0.20,
    "backpack":     0.25,
    "handbag":      0.25,
    "suitcase":     0.25,
    "toilet":       0.30,
    "refrigerator": 0.30,
    "sink":         0.30,
    "microwave":    0.30,
    "oven":         0.30,
    "toaster":      0.30,
    "chair":        0.25,
    "bird":         0.10,
}

# YOLO model path — check multiple locations in priority order:
# 1. Custom garbage.pt in data/models/
# 2. yolov8m.pt in data/models/
# 3. yolov8m.pt in project root (common download location)
GARBAGE_MODEL = MODELS_DIR / "garbage.pt"
_models_dir_yolo = MODELS_DIR / "yolov8m.pt"
_root_yolo = BASE_DIR / "yolov8m.pt"
# if GARBAGE_MODEL.exists():
#     YOLO_MODEL = str(GARBAGE_MODEL)
if _models_dir_yolo.exists():
    YOLO_MODEL = str(_models_dir_yolo)
elif _root_yolo.exists():
    YOLO_MODEL = str(_root_yolo)
else:
    YOLO_MODEL = "yolov8m.pt"  # Let ultralytics auto-download

# COCO classes used as waste proxies (yolov8s.pt is COCO-pretrained, no custom garbage classes)
# These are the best available COCO classes that appear as discarded waste

# Discarded containers
CONTAINER_WASTE = {"bowl", "vase"}

# Plastics (including 'bird' as COCO often misclassifies white trash bags as birds)
PLASTIC_WASTE = {"bottle", "cup", "bird"}

# Food litter (commonly found discarded on streets)
FOOD_WASTE = {"banana", "apple", "orange", "sandwich", "hot dog", "pizza", "cake", "carrot", "donut"}

# Abandoned items
ABANDONED_ITEMS = {"suitcase", "backpack", "handbag", "umbrella"}

# Dumped household appliances
HOUSEHOLD_WASTE = {"toilet", "refrigerator", "microwave", "oven", "toaster", "sink"}

# Furniture and large objects
FURNITURE_WASTE = {"chair", "couch", "bed", "dining table", "bench"}

# Electronics / Small items often dumped
ELECTRONIC_WASTE = {"cell phone", "remote", "mouse", "keyboard", "book", "tv", "laptop", "clock", "hair drier"}

# Combined waste classes (Refined to reduce false positives)
WASTE_CLASSES = CONTAINER_WASTE | PLASTIC_WASTE | FOOD_WASTE | ABANDONED_ITEMS | HOUSEHOLD_WASTE | FURNITURE_WASTE | ELECTRONIC_WASTE

# Category labels for display
WASTE_CATEGORY_MAP = {}
for _cls in CONTAINER_WASTE:   WASTE_CATEGORY_MAP[_cls] = "Container/Utensil"
for _cls in PLASTIC_WASTE:     WASTE_CATEGORY_MAP[_cls] = "Plastic Waste"
for _cls in FOOD_WASTE:        WASTE_CATEGORY_MAP[_cls] = "Food Waste"
for _cls in ABANDONED_ITEMS:   WASTE_CATEGORY_MAP[_cls] = "Abandoned Item"
for _cls in HOUSEHOLD_WASTE:   WASTE_CATEGORY_MAP[_cls] = "Household Waste"
for _cls in FURNITURE_WASTE:   WASTE_CATEGORY_MAP[_cls] = "Furniture Waste"
for _cls in ELECTRONIC_WASTE:  WASTE_CATEGORY_MAP[_cls] = "E-Waste"
WASTE_CATEGORY_MAP["person"] = "Person"

# Support for custom garbage.pt classes
CUSTOM_GARBAGE = {"garbage", "plastic_bag", "trash_bag", "litter", "garbage_pile", "bin"}
WASTE_CLASSES |= CUSTOM_GARBAGE
for _cls in CUSTOM_GARBAGE:
    WASTE_CATEGORY_MAP[_cls] = "Garbage"

# Custom garbage classes (when using fine-tuned TACO model)
GARBAGE_CLASSES = {
    "garbage", "trash", "litter", "waste", "garbage_bag",
    "garbage_pile", "plastic_bag", "bottle", "can",
    "paper", "cardboard", "debris", "overflowing_bin",
}

# Severity thresholds — raised so 1 object alone = LOW (not medium/high)
SEVERITY_THRESHOLDS = {
    "LOW":      (1, 2),
    "MEDIUM":   (3, 5),
    "HIGH":     (6, 10),
    "CRITICAL": (11, float("inf")),
}

# Server
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Nagpur Zones and Areas for mock geocoding
NAGPUR_ZONES = [
    {"name": "Laxmi Nagar", "lat": 21.1167, "lng": 79.0667},
    {"name": "Dharampeth", "lat": 21.1417, "lng": 79.0667},
    {"name": "Hanuman Nagar", "lat": 21.1230, "lng": 79.0980},
    {"name": "Dhantoli", "lat": 21.1400, "lng": 79.0850},
    {"name": "Nehru Nagar", "lat": 21.1200, "lng": 79.1150},
    {"name": "Gandhibagh", "lat": 21.1550, "lng": 79.1000},
    {"name": "Satranjipura", "lat": 21.1650, "lng": 79.1100},
    {"name": "Lakadganj", "lat": 21.1550, "lng": 79.1300},
    {"name": "Ashi Nagar", "lat": 21.1850, "lng": 79.1150},
    {"name": "Mangalwari", "lat": 21.1750, "lng": 79.0800},
    {"name": "Mahal", "lat": 21.1450, "lng": 79.1100},
    {"name": "Civil Lines", "lat": 21.1550, "lng": 79.0750},
    {"name": "Ramdaspeth", "lat": 21.1350, "lng": 79.0800},
    {"name": "IT Park (Parsodi)", "lat": 21.1250, "lng": 79.0500},
]

def get_area_name(lat: float, lng: float) -> str:
    """Find the nearest area name in Nagpur."""
    import math
    best_area = "Nagpur Central"
    min_dist = float('inf')
    
    for zone in NAGPUR_ZONES:
        dist = math.sqrt((lat - zone["lat"])**2 + (lng - zone["lng"])**2)
        if dist < min_dist:
            min_dist = dist
            best_area = zone["name"]
    
    # If the distance is too far, it's just "Nagpur Outskirts"
    if min_dist > 0.05:
        return "Nagpur Region"
        
    return best_area
