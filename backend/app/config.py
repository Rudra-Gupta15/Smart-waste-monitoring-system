import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
EVIDENCE_DIR = DATA_DIR / "evidence"
MODELS_DIR = DATA_DIR / "models"

EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Detection settings
CONFIDENCE_THRESHOLD = 0.20         # Lowered from 0.25 — catch more waste
FRAME_INTERVAL = 2                  # Process every 2nd frame (was 3)
CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", 0)
if str(CAMERA_SOURCE).isdigit():
    CAMERA_SOURCE = int(CAMERA_SOURCE)

# Camera Location
CAMERA_LAT = float(os.getenv("CAMERA_LAT", "21.1458"))
CAMERA_LNG = float(os.getenv("CAMERA_LNG", "79.0882"))

# Accuracy filters
MIN_BBOX_AREA_FRACTION = 0.0003     # Object bbox must be >=0.03% of frame to catch small litter
MIN_CONSECUTIVE_DETECTIONS = 1      # Confirm after 1 consistent detection (was 2)

# Per-class confidence overrides — lower = more sensitive for that class
PER_CLASS_CONFIDENCE = {
    # Bottles and containers — very common litter
    "bottle":       0.25,
    "cup":          0.25,
    "bowl":         0.30,
    # Food items — raised threshold to avoid false positives on random objects
    "banana":       0.40,
    "apple":        0.40,
    "orange":       0.40,
    "sandwich":     0.40,
    "hot dog":      0.40,
    "pizza":        0.40,
    "cake":         0.40,
    "carrot":       0.40,
    "donut":        0.40,
    # Proxy detections (trash bags misclassified as these)
    "bird":         0.35,
    "teddy bear":   0.35,
    "sports ball":  0.35,
    # Abandoned items
    "backpack":     0.30,
    "handbag":      0.30,
    "suitcase":     0.30,
    "umbrella":     0.30,
    # Dumped appliances (somewhat lenient — large objects, easy to confirm)
    "toilet":       0.25,
    "refrigerator": 0.25,
    "sink":         0.25,
    "microwave":    0.25,
    "oven":         0.25,
    "toaster":      0.25,
    # Furniture (only truly abandoned outdoor furniture — chairs/couches/benches removed to avoid false positives indoors)
    "bed":          0.30,
    "dining table": 0.30,
    # E-waste
    "cell phone":   0.15,
    "laptop":       0.20,
    "tv":           0.20,
    "keyboard":     0.15,
    "remote":       0.15,
    # Custom garbage model classes (very low threshold — model is purpose-built)
    "plastic":      0.10,
    "paper":        0.10,
    "glass":        0.10,
    "metal":        0.10,
    "waste":        0.10,
    "garbage":      0.10,
    "litter":       0.10,
    "trash":        0.10,
    "garbage_pile": 0.10,
    "plastic_bag":  0.10,
    "trash_bag":    0.10,
    "bin":          0.15,
    # COCO misclassification proxy (birds often = white trash bags)
    "bird":         0.10,
}

# YOLO model path — check multiple locations in priority order:
# 1. Custom garbage.pt in data/models/
# 2. yolov8m.pt in data/models/
# 3. yolov8m.pt in project root (common download location)
GARBAGE_MODEL = MODELS_DIR / "best_model.pt"
_models_dir_yolo = MODELS_DIR / "yolov8m.pt"
_root_yolo = BASE_DIR / "yolov8m.pt"
if GARBAGE_MODEL.exists():
    YOLO_MODEL = str(GARBAGE_MODEL)
elif _models_dir_yolo.exists():
    YOLO_MODEL = str(_models_dir_yolo)
elif _root_yolo.exists():
    YOLO_MODEL = str(_root_yolo)
else:
    YOLO_MODEL = "yolov8m.pt"  # Let ultralytics auto-download

# Secondary waste classifier configuration (Two-Stage pipeline)
# ENABLED: Retrained with MobileNetV3-small backbone for >80% accuracy.
USE_CLASSIFIER = True
CLASSIFIER_MODEL_PATH = MODELS_DIR / "waste_classifier.pt"
CLASSIFIER_CATEGORY_MAP = {
    "battery": "E-Waste",
    "biological": "Food Waste",
    "cardboard": "Paper/Stationery",
    "clothes": "Abandoned Item",
    "glass": "Glass Waste",
    "metal": "Metal Waste",
    "paper": "Paper/Stationery",
    "plastic": "Plastic Waste",
    "shoes": "Abandoned Item",
    "trash": "Misc Waste"
}

# COCO classes used as waste proxies (yolov8s.pt is COCO-pretrained, no custom garbage classes)
# These are the best available COCO classes that appear as discarded waste

# Discarded containers
CONTAINER_WASTE = {"bowl", "vase"}

# Plastics (including 'bird', 'teddy bear', 'sports ball' as COCO often misclassifies white/black trash bags and clumps as these)
PLASTIC_WASTE = {"bottle", "cup", "bird", "teddy bear", "sports ball"}

# Food litter (commonly found discarded on streets)
FOOD_WASTE = {"banana", "apple", "orange", "sandwich", "hot dog", "pizza", "cake", "carrot", "donut"}

# Abandoned items
ABANDONED_ITEMS = {"suitcase", "backpack", "handbag", "umbrella"}

# Dumped household appliances
HOUSEHOLD_WASTE = {"toilet", "refrigerator", "microwave", "oven", "toaster", "sink"}

# Furniture and large objects
# NOTE: chair, couch, bench removed — they cause constant false positives indoors.
# Only truly outdoor-abandoned items kept.
FURNITURE_WASTE = {"bed", "dining table"}

# Electronics / Small items often dumped
ELECTRONIC_WASTE = {"cell phone", "remote", "mouse", "keyboard", "book", "tv", "laptop", "clock", "hair drier", "skateboard"}

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

# Support for custom garbage.pt and best_model.pt classes
CUSTOM_GARBAGE = {"glass", "metal", "paper", "plastic", "waste", "garbage", "plastic_bag", "trash_bag", "litter", "garbage_pile", "bin"}
WASTE_CLASSES |= CUSTOM_GARBAGE
for _cls in CUSTOM_GARBAGE:
    if _cls == "plastic": WASTE_CATEGORY_MAP[_cls] = "Plastic Waste"
    elif _cls == "paper": WASTE_CATEGORY_MAP[_cls] = "Paper/Stationery"
    elif _cls == "glass": WASTE_CATEGORY_MAP[_cls] = "Glass Waste"
    elif _cls == "metal": WASTE_CATEGORY_MAP[_cls] = "Metal Waste"
    else: WASTE_CATEGORY_MAP[_cls] = "Garbage"

# Custom garbage classes (when using fine-tuned TACO model)
GARBAGE_CLASSES = {
    "glass", "metal", "paper", "plastic", "waste",
    "garbage", "trash", "litter", "garbage_bag",
    "garbage_pile", "plastic_bag", "bottle", "can",
    "cardboard", "debris", "overflowing_bin", "trash_bag", "bin"
}

# Severity thresholds
SEVERITY_THRESHOLDS = {
    "LOW":      (1, 3),
    "MEDIUM":   (4, 7),
    "HIGH":     (8, 12),
    "CRITICAL": (13, float("inf")),
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
