"""
YOLOv8 Waste/Garbage Object Detector
Processes camera frames and detects waste-related objects.

Detection modes:
  detect(frame)        — Video/live mode. Uses temporal tracking to confirm
                         objects that stay stationary for >= 1 second.
  detect_image(frame)  — Static image mode. All detections above the
                         confidence threshold are immediately confirmed.
                         No tracking required.
"""

import time
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import torch
import functools

# Fix for PyTorch 2.6+ weights_only=True default loading error with Ultralytics models
torch.load = functools.partial(torch.load, weights_only=False)

# pyrefly: ignore [missing-import]
from ultralytics import YOLO

from backend.app.config import (
    CONFIDENCE_THRESHOLD,
    MODELS_DIR,
    YOLO_MODEL,
    WASTE_CLASSES,
    WASTE_CATEGORY_MAP,
    GARBAGE_CLASSES,
    SEVERITY_THRESHOLDS,
    PER_CLASS_CONFIDENCE,
    MIN_BBOX_AREA_FRACTION,
    MIN_CONSECUTIVE_DETECTIONS,
    get_area_name,
    USE_CLASSIFIER,
    CLASSIFIER_MODEL_PATH,
    CLASSIFIER_CATEGORY_MAP,
)
from backend.ai.classifier import WasteClassifier


@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: List[int]      # [x1, y1, x2, y2]
    id: int = 0          # Tracking ID
    category: str = "Misc Waste"
    color: tuple = (0, 255, 0)
    streak: int = 0
    missed_count: int = 0
    stationary_start: float = field(default_factory=time.time)
    is_confirmed: bool = False
    lat: float = 0.0
    lng: float = 0.0
    area: str = "Unknown"
    types_list: List[str] = field(default_factory=list)


@dataclass
class FrameResult:
    detections: List[Detection] = field(default_factory=list)
    severity: str = "NONE"
    object_count: int = 0
    timestamp: float = 0.0
    frame: Optional[np.ndarray] = None
    annotated_frame: Optional[np.ndarray] = None
    lat: float = 0.0
    lng: float = 0.0
    area: str = "Unknown"


# Colors for severity levels (BGR)
SEVERITY_COLORS = {
    "NONE":     (200, 200, 200),
    "LOW":      (0, 255, 255),    # Yellow
    "MEDIUM":   (0, 165, 255),    # Orange
    "HIGH":     (0, 0, 255),      # Red
    "CRITICAL": (0, 0, 180),      # Dark Red
}

# Colors per waste category (BGR for OpenCV)
CATEGORY_COLORS = {
    "Plastic Waste":     (0, 255, 255),
    "Paper/Stationery":  (0, 200, 255),
    "Food Waste":        (0, 255, 100),
    "Container/Utensil": (255, 100, 0),
    "Abandoned Item":    (200, 0, 200),
    "E-Waste":           (0, 100, 255),
    "Household Waste":   (100, 100, 255),
    "Furniture Waste":   (150, 100, 50),
    "Glass Waste":       (200, 255, 200),
    "Metal Waste":       (180, 180, 180),
    "Misc Waste":        (200, 200, 0),
    "Garbage":           (0, 140, 255),
    "Person":            (255, 255, 0),  # Cyan for people
    "default":           (0, 255, 0),
}


class WasteDetector:
    """YOLOv8-based waste and garbage detector with IoU tracking."""

    def __init__(self, model_path: Optional[str] = None, confidence: float = CONFIDENCE_THRESHOLD):
        self.confidence = confidence
        self.model_path = model_path or YOLO_MODEL
        self.model: Optional[YOLO] = None
        self.class_names: Dict[int, str] = {}
        self.waste_class_ids: Set[int] = set()
        self._model_loaded = False

        # Tracking state — guarded by _track_lock
        self._track_lock = threading.Lock()
        self.tracked_objects: List[Detection] = []
        self.next_id = 1
        self.current_lat = 0.0
        self.current_lng = 0.0
        self.max_missed = 3   # frames before dropping a lost track (was 5)
        self.min_streak = 1   # minimum consecutive detections to confirm (was 2)

        # Secondary classifier (Two-Stage segregation pipeline)
        self.classifier = None
        if USE_CLASSIFIER:
            self.classifier = WasteClassifier(str(CLASSIFIER_MODEL_PATH))

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load_model(self):
        """Load YOLOv8 model. Raises clear error if model file is missing."""
        model_path = Path(self.model_path)

        # If the configured path is a custom .pt file that doesn't exist, fall
        # back to yolov8n.pt (Ultralytics will auto-download it once).
        if not model_path.exists() and model_path.suffix == ".pt" and "yolov8" not in model_path.stem:
            fallback = str(MODELS_DIR / "yolov8n.pt")
            print(f"[Detector] WARNING: '{self.model_path}' not found. Falling back to {fallback}")
            self.model_path = fallback

        print(f"[Detector] Loading model: {self.model_path} ...")
        try:
            self.model = YOLO(self.model_path)
            self.class_names = self.model.names
            self._build_waste_class_ids()

            # Load secondary model exclusively for "Human Shield" protection
            _nano = MODELS_DIR / "yolov8n.pt"
            self.person_model = YOLO(str(_nano) if _nano.exists() else "yolov8n.pt")

            self._model_loaded = True
            print(
                f"[Detector] Model loaded: {self.model_path}. "
                f"{len(self.class_names)} classes, {len(self.waste_class_ids)} waste class IDs active."
            )
        except Exception as e:
            raise RuntimeError(f"[Detector] Failed to load model '{self.model_path}': {e}") from e

    def _build_waste_class_ids(self):
        """Determine which class IDs are considered waste."""
        all_names = set(n.lower() for n in self.class_names.values())
        is_custom_garbage_model = bool(all_names) and all_names.issubset(GARBAGE_CLASSES)

        if is_custom_garbage_model:
            # Custom model: every class is waste — leave waste_class_ids empty
            # so the filter `if self.waste_class_ids` evaluates False → all pass
            self.waste_class_ids = set()
            for name in self.class_names.values():
                formatted_name = name.replace("_", " ").title()
                WASTE_CATEGORY_MAP[name] = formatted_name
            print("[Detector] Custom garbage model detected — all classes treated as waste.")
        else:
            # COCO model: only approved waste proxy classes
            self.waste_class_ids = set()
            for class_id, name in self.class_names.items():
                if name.lower() in WASTE_CLASSES:
                    self.waste_class_ids.add(class_id)
            print(
                f"[Detector] COCO model. Active waste classes: "
                f"{[self.class_names[i] for i in sorted(self.waste_class_ids)]}"
            )

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def _preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Passes the frame through directly.
        (Previously attempted CLAHE contrast enhancement, but this severely degrades
        confidence scores for the COCO model since it wasn't trained on equalized images.)
        """
        return frame

    # ------------------------------------------------------------------
    # Core detection — Video/Live mode (with temporal tracking)
    # ------------------------------------------------------------------

    def detect(self, frame: np.ndarray) -> FrameResult:
        """
        Run YOLO inference on a video/live frame and return a FrameResult.
        Uses temporal tracking: objects must be stationary for >= 1 second
        to be 'confirmed' and included in the report.
        Never raises — returns an empty result on any error.
        """
        if not self._model_loaded:
            print("[Detector] detect() called but model not loaded — skipping frame.")
            return FrameResult(timestamp=time.time())

        try:
            return self._run_detection(frame)
        except Exception as e:
            print(f"[Detector] ERROR during inference: {e}")
            return FrameResult(
                timestamp=time.time(),
                annotated_frame=frame.copy(),
            )

    def _run_detection(self, frame: np.ndarray) -> FrameResult:
        """Internal detection logic for video/live mode — called by detect()."""
        frame_h, frame_w = frame.shape[:2]
        frame_area = frame_h * frame_w

        # Preprocess for better detection in varied lighting
        enhanced = self._preprocess_frame(frame)

        # Run inference at the absolute lowest confidence floor (0.02)
        # so YOLO returns all candidates. Our custom per-class loop handles the real filtering.
        results = self.model(enhanced, conf=0.02, verbose=False)[0]

        # Human Shield: run nano model to find people and prevent garbage
        # model from labelling clothes/bags on persons as waste
        person_results = getattr(self, "person_model", self.model)(
            enhanced, classes=[0], conf=0.35, verbose=False
        )[0]
        person_boxes = [box.xyxy[0].tolist() for box in person_results.boxes]

        # Extract raw detections
        current_detections: List[Detection] = []
        for box in results.boxes:
            class_id = int(box.cls[0])
            class_name = self.class_names.get(class_id, "unknown").lower()
            conf = float(box.conf[0])

            # Never treat actual animals as waste
            if class_name in ["dog", "cat"]:
                continue

            is_person = (class_name == "person")
            if self.waste_class_ids and class_id not in self.waste_class_ids and not is_person:
                continue

            # Per-class threshold override
            base_conf = PER_CLASS_CONFIDENCE.get(class_name, self.confidence)
            if conf < max(0.02, base_conf):
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox_area = (x2 - x1) * (y2 - y1)
            if frame_area > 0 and bbox_area / frame_area < MIN_BBOX_AREA_FRACTION:
                continue

            category = WASTE_CATEGORY_MAP.get(class_name, "Misc Waste")

            # Human Shield & In-Use Filter: discard garbage detections that heavily
            # overlap with a person, or furniture that is being used by a person.
            if not is_person:
                is_on_human = False
                for pb in person_boxes:
                    ioa = self._calculate_ioa([x1, y1, x2, y2], pb)
                    
                    if category == "Furniture Waste":
                        iou = self._calculate_iou([x1, y1, x2, y2], pb)
                        # If a person significantly overlaps with furniture, it's in use
                        if iou > 0.05 or ioa > 0.1:
                            is_on_human = True
                            break
                    elif ioa > 0.5:
                        # For general items (like clothes/bags), require heavy overlap
                        is_on_human = True
                        break

                if is_on_human:
                    continue
            
            if not is_person:
                # Two-Stage Inference: sub-classify generic waste boxes using our custom CNN
                bbox_ints = [int(x1), int(y1), int(x2), int(y2)]
                pred_cls, pred_cat, pred_conf = self._subclassify_crop(
                    frame, bbox_ints, class_name, category
                )
                if pred_conf > 0.0:
                    class_name = pred_cls
                    category = pred_cat
                    conf = pred_conf

            current_detections.append(Detection(
                class_name=class_name,
                confidence=conf,
                bbox=[int(x1), int(y1), int(x2), int(y2)],
                category=category,
                color=CATEGORY_COLORS.get(category, CATEGORY_COLORS["default"]),
                streak=1,
            ))

        # Cluster nearby waste items into 'garbage_pile'
        waste_dets = [d for d in current_detections if d.class_name != "person"]
        person_dets = [d for d in current_detections if d.class_name == "person"]

        if len(waste_dets) >= 2:
            waste_dets = self._cluster_detections(waste_dets, margin=80, min_cluster_size=2)

        current_detections = person_dets + waste_dets

        # Update tracking (thread-safe)
        with self._track_lock:
            self._update_tracks(current_detections)
            confirmed = [t for t in self.tracked_objects if t.is_confirmed and t.missed_count == 0]
            display   = [t for t in self.tracked_objects if t.missed_count == 0]

        # Scene-level garbage pile detection — supplements YOLO for large piles
        # that fill the frame and have no distinct individual object boundaries.
        scene_pile = self._detect_scene_garbage_pile(frame, frame_h, frame_w, confirmed)
        if scene_pile is not None:
            has_overlap = any(
                d.class_name == "garbage_pile" and self._calculate_iou(d.bbox, scene_pile.bbox) > 0.3
                for d in confirmed
            )
            if not has_overlap:
                scene_pile.id = self.next_id
                self.next_id += 1
                # Enrich types_list with any YOLO-detected classes in the same frame
                inner = [d.class_name for d in confirmed if d.category != "Person"]
                if inner:
                    scene_pile.types_list = list(set(inner))[:5]
                confirmed.append(scene_pile)
                display.append(scene_pile)

        severity = self._assess_severity(confirmed)
        annotated = self._annotate_frame(frame.copy(), display, severity, frame_w, frame_h)

        # Exclude 'Person' from logs/database
        reporting_detections = [d for d in confirmed if d.category != "Person"]

        return FrameResult(
            detections=reporting_detections,
            severity=severity,
            object_count=len(reporting_detections),
            timestamp=time.time(),
            frame=frame,
            annotated_frame=annotated,
            lat=getattr(self, 'current_lat', 0.0),
            lng=getattr(self, 'current_lng', 0.0),
            area=getattr(self, 'current_area_name', None) or get_area_name(
                getattr(self, 'current_lat', 0.0), getattr(self, 'current_lng', 0.0)
            ),
        )

    # ------------------------------------------------------------------
    # Core detection — Static Image mode (no tracking required)
    # ------------------------------------------------------------------

    def detect_image(self, frame: np.ndarray) -> FrameResult:
        """
        Detect waste in a static image — bypasses temporal tracking entirely.
        Every detection above the confidence threshold is immediately confirmed
        and included in the result.  Use this for uploaded image analysis.
        """
        if not self._model_loaded:
            print("[Detector] detect_image() called but model not loaded.")
            return FrameResult(timestamp=time.time())
        try:
            return self._run_image_detection(frame)
        except Exception as e:
            print(f"[Detector] ERROR during image detection: {e}")
            return FrameResult(timestamp=time.time(), annotated_frame=frame.copy())

    def _run_image_detection(self, frame: np.ndarray) -> FrameResult:
        """Internal static-image detection — all detections immediately confirmed."""
        frame_h, frame_w = frame.shape[:2]
        frame_area = frame_h * frame_w

        # CLAHE contrast enhancement — significantly helps with outdoor/poorly-lit images
        enhanced = self._preprocess_frame(frame)

        # For images, run at highest resolution to catch small litter.
        # We pass 0.02 to the model to get all candidates, then filter below.
        infer_size = 1280 if (frame_w > 1024 or frame_h > 768) else 640

        results = self.model(enhanced, conf=0.02, imgsz=infer_size, verbose=False)[0]

        # Human Shield
        person_results = getattr(self, "person_model", self.model)(
            enhanced, classes=[0], conf=0.35, verbose=False
        )[0]
        person_boxes = [box.xyxy[0].tolist() for box in person_results.boxes]

        raw_detections: List[Detection] = []
        for idx, box in enumerate(results.boxes):
            class_id = int(box.cls[0])
            class_name = self.class_names.get(class_id, "unknown").lower()
            conf = float(box.conf[0])

            if class_name in ["dog", "cat"]:
                continue

            is_person = (class_name == "person")
            if self.waste_class_ids and class_id not in self.waste_class_ids and not is_person:
                continue

            # Per-class threshold (scaled down for image mode)
            base_conf = PER_CLASS_CONFIDENCE.get(class_name, self.confidence)
            min_conf = max(0.02, base_conf * 0.75)
            if conf < min_conf:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            bbox_area = (x2 - x1) * (y2 - y1)
            if frame_area > 0 and bbox_area / frame_area < MIN_BBOX_AREA_FRACTION:
                continue

            category = WASTE_CATEGORY_MAP.get(class_name, "Misc Waste")

            # Human Shield & In-Use Filter
            if not is_person:
                is_on_human = False
                for pb in person_boxes:
                    ioa = self._calculate_ioa([x1, y1, x2, y2], pb)
                    
                    if category == "Furniture Waste":
                        iou = self._calculate_iou([x1, y1, x2, y2], pb)
                        if iou > 0.05 or ioa > 0.1:
                            is_on_human = True
                            break
                    elif ioa > 0.5:
                        is_on_human = True
                        break

                if is_on_human:
                    continue
            
            if not is_person:
                # Two-Stage Inference: sub-classify generic waste boxes using our custom CNN
                bbox_ints = [int(x1), int(y1), int(x2), int(y2)]
                pred_cls, pred_cat, pred_conf = self._subclassify_crop(
                    frame, bbox_ints, class_name, category
                )
                if pred_conf > 0.0:
                    class_name = pred_cls
                    category = pred_cat
                    conf = pred_conf

            raw_detections.append(Detection(
                class_name=class_name,
                confidence=conf,
                bbox=[int(x1), int(y1), int(x2), int(y2)],
                id=idx + 1,
                category=category,
                color=CATEGORY_COLORS.get(category, CATEGORY_COLORS["default"]),
                streak=99,
                is_confirmed=True,   # Immediately confirmed for static images
            ))

        # Cluster nearby waste items
        waste_dets = [d for d in raw_detections if d.class_name != "person"]
        person_dets = [d for d in raw_detections if d.class_name == "person"]

        if len(waste_dets) >= 2:
            waste_dets = self._cluster_detections(waste_dets, margin=80, min_cluster_size=2)

        # Scene-level garbage pile detection — supplements YOLO for large piles
        scene_pile = self._detect_scene_garbage_pile(frame, frame_h, frame_w, waste_dets)
        if scene_pile is not None:
            has_overlap = any(
                d.class_name == "garbage_pile" and self._calculate_iou(d.bbox, scene_pile.bbox) > 0.3
                for d in waste_dets
            )
            if not has_overlap:
                inner = [d.class_name for d in waste_dets]
                if inner:
                    scene_pile.types_list = list(set(inner))[:5]
                waste_dets.append(scene_pile)

        # Clean up IDs
        for i, det in enumerate(person_dets + waste_dets):
            det.id = i + 1

        all_detections = person_dets + waste_dets
        reporting = [d for d in waste_dets if d.category != "Person"]
        severity = self._assess_severity(reporting)

        annotated = self._annotate_frame(frame.copy(), all_detections, severity, frame_w, frame_h)

        return FrameResult(
            detections=reporting,
            severity=severity,
            object_count=len(reporting),
            timestamp=time.time(),
            frame=frame,
            annotated_frame=annotated,
            lat=getattr(self, 'current_lat', 0.0),
            lng=getattr(self, 'current_lng', 0.0),
            area=getattr(self, 'current_area_name', None) or get_area_name(
                getattr(self, 'current_lat', 0.0), getattr(self, 'current_lng', 0.0)
            ),
        )

    # ------------------------------------------------------------------
    # Clustering helper
    # ------------------------------------------------------------------

    def _cluster_detections(
        self,
        waste_dets: List[Detection],
        margin: int = 150,
        min_cluster_size: int = 2,
    ) -> List[Detection]:
        """
        Merge spatially close detections into a single 'garbage_pile' detection.
        Items within `margin` pixels of each other are merged into one cluster.
        Clusters with >= min_cluster_size items become a garbage_pile.
        """
        clusters = []

        for det in waste_dets:
            x1, y1, x2, y2 = det.bbox
            b_x1, b_y1 = x1 - margin, y1 - margin
            b_x2, b_y2 = x2 + margin, y2 + margin

            matched_clusters = []
            for i, cluster in enumerate(clusters):
                cx1, cy1, cx2, cy2 = cluster["bbox"]
                if not (b_x2 < cx1 or b_x1 > cx2 or b_y2 < cy1 or b_y1 > cy2):
                    matched_clusters.append(i)

            if not matched_clusters:
                clusters.append({"bbox": [x1, y1, x2, y2], "dets": [det]})
            else:
                merged_dets = [det]
                min_x, min_y, max_x, max_y = x1, y1, x2, y2
                for i in sorted(matched_clusters, reverse=True):
                    c = clusters.pop(i)
                    merged_dets.extend(c["dets"])
                    cx1, cy1, cx2, cy2 = c["bbox"]
                    min_x = min(min_x, cx1)
                    min_y = min(min_y, cy1)
                    max_x = max(max_x, cx2)
                    max_y = max(max_y, cy2)
                clusters.append({"bbox": [min_x, min_y, max_x, max_y], "dets": merged_dets})

        final: List[Detection] = []
        for c in clusters:
            if len(c["dets"]) >= min_cluster_size:
                types = list(set(d.class_name for d in c["dets"]))
                
                # Determine category: if any constituent has a specific waste category (other than general Garbage/Misc Waste),
                # use the category of the constituent with the highest severity/priority.
                # Priority rank: E-Waste > Food Waste > Glass Waste > Plastic Waste > Metal Waste > Paper/Stationery > Abandoned Item > Household Waste > Furniture Waste > Container/Utensil > Misc Waste > Garbage
                category_priority = [
                    "E-Waste", "Food Waste", "Glass Waste", "Plastic Waste",
                    "Metal Waste", "Paper/Stationery", "Abandoned Item",
                    "Household Waste", "Furniture Waste", "Container/Utensil",
                    "Misc Waste", "Garbage"
                ]
                
                # Find all unique categories of constituent detections
                constituent_categories = set(d.category for d in c["dets"])
                
                # Select the highest priority category present
                selected_category = "Garbage"
                for cat in category_priority:
                    if cat in constituent_categories:
                        selected_category = cat
                        break
                
                pile = Detection(
                    class_name="garbage_pile",
                    confidence=max(d.confidence for d in c["dets"]),
                    bbox=c["bbox"],
                    category=selected_category,
                    color=CATEGORY_COLORS.get(selected_category, CATEGORY_COLORS["default"]),
                    streak=99,
                    is_confirmed=True,
                    types_list=types,
                )
                final.append(pile)
            else:
                final.extend(c["dets"])

        return final

    # ------------------------------------------------------------------
    # Tracking (video/live only)
    # ------------------------------------------------------------------

    def _update_tracks(self, current_detections: List[Detection]):
        """Match current detections against tracked objects, update streaks."""
        updated_tracks = []
        now = time.time()

        for track in self.tracked_objects:
            best_iou = 0.0
            best_match = None

            for i, det in enumerate(current_detections):
                iou = self._calculate_iou(track.bbox, det.bbox)
                # If class name matches, allow a lower IoU threshold. If class changed (refined or fluctuated),
                # require a higher IoU (0.45) to ensure it is the same physical object.
                min_iou = 0.2 if det.class_name == track.class_name else 0.45
                if iou > min_iou and iou > best_iou:
                    best_iou = iou
                    best_match = i

            if best_match is not None:
                match = current_detections.pop(best_match)

                # Reset stationary timer only if it moved significantly
                if best_iou < 0.8:
                    track.stationary_start = now

                track.bbox = match.bbox
                track.confidence = match.confidence
                track.types_list = match.types_list
                track.class_name = match.class_name
                track.category = match.category
                track.color = match.color
                track.streak += 1
                track.missed_count = 0

                # Confirm: stationary for 1 s AND seen enough consecutive frames
                # (was 3.0s + min_streak=2 — now 1.0s + min_streak=1)
                if (now - track.stationary_start) >= 1.0 and track.streak >= self.min_streak:
                    track.is_confirmed = True

                updated_tracks.append(track)
            else:
                track.missed_count += 1
                if track.missed_count <= self.max_missed:
                    updated_tracks.append(track)
                # else: drop the track

        # Register new tracks for unmatched detections
        for det in current_detections:
            det.id = self.next_id
            det.stationary_start = now
            self.next_id += 1
            updated_tracks.append(det)

        self.tracked_objects = updated_tracks

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _calculate_iou(self, bbox1, bbox2) -> float:
        """Intersection over Union of two [x1,y1,x2,y2] boxes."""
        x1, y1, x2, y2 = bbox1
        x3, y3, x4, y4 = bbox2
        xi1, yi1 = max(x1, x3), max(y1, y3)
        xi2, yi2 = min(x2, x4), min(y2, y4)
        inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        union = (x2 - x1) * (y2 - y1) + (x4 - x3) * (y4 - y3) - inter
        return inter / union if union > 0 else 0.0

    def _calculate_ioa(self, bbox_obj, bbox_person) -> float:
        """Intersection over Area of the object. Useful for checking if an object is INSIDE another."""
        x1, y1, x2, y2 = bbox_obj
        x3, y3, x4, y4 = bbox_person
        xi1, yi1 = max(x1, x3), max(y1, y3)
        xi2, yi2 = min(x2, x4), min(y2, y4)
        inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        area_obj = (x2 - x1) * (y2 - y1)
        return inter / area_obj if area_obj > 0 else 0.0

    def _detect_scene_garbage_pile(
        self,
        frame: np.ndarray,
        frame_h: int,
        frame_w: int,
        existing_dets: List[Detection],
    ) -> Optional[Detection]:
        """
        Grid-based scene-level garbage pile detector.

        Divides the frame into an 8×8 grid and evaluates each cell independently.
        A cell qualifies as 'garbage' only if it passes ALL of:
          1. Edge density  ≥ 8%           (chaotic texture, not flat surface)
          2. Color entropy ≥ 1.5          (diverse hues, not uniform sky/road/wall)
          3. Hue concentration top-3 ≤ 65% (no dominant brand colors, not a truck/logo)
          4. Garbage-palette ratio ≥ 20%  (earthy browns, dirty greys, dark/ash — not bright logos)

        The output bbox is the TIGHT bounding box of only the qualifying cells,
        NOT an inflated morphological mask. This gives precise, localized detection.
        """
        if frame_h < 100 or frame_w < 100:
            return None

        # --- Preprocessing ---
        gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges   = cv2.Canny(blurred, 40, 120)

        hsv      = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        hue_chan = hsv[:, :, 0]
        sat_chan = hsv[:, :, 1]
        val_chan = hsv[:, :, 2]

        # --- Grid setup ---
        GRID_ROWS, GRID_COLS = 8, 8
        cell_h = frame_h // GRID_ROWS
        cell_w = frame_w // GRID_COLS
        if cell_h < 20 or cell_w < 20:
            return None

        cell_scores = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.float32)

        for r in range(GRID_ROWS):
            for c in range(GRID_COLS):
                r1, r2 = r * cell_h, min(frame_h, (r + 1) * cell_h)
                c1, c2 = c * cell_w, min(frame_w, (c + 1) * cell_w)

                cell_edges = edges[r1:r2, c1:c2]
                cell_hue   = hue_chan[r1:r2, c1:c2].ravel()
                cell_sat   = sat_chan[r1:r2, c1:c2].ravel()
                cell_val   = val_chan[r1:r2, c1:c2].ravel()

                n_px = len(cell_hue)
                if n_px == 0:
                    continue

                # ── Filter 1: edge density ──────────────────────────────────
                edge_density = float(np.sum(cell_edges > 0)) / n_px
                if edge_density < 0.08:
                    continue   # Flat / featureless (sky, clean road)

                # ── Filter 2: color entropy ─────────────────────────────────
                hist, _ = np.histogram(cell_hue, bins=12, range=(0, 180))
                hist_norm = hist / (hist.sum() + 1e-8)
                entropy = float(-np.sum(hist_norm * np.log2(hist_norm + 1e-8)))
                if entropy < 1.5:
                    continue   # Too few colors = uniform surface

                # ── Filter 3: hue concentration (rejects branded surfaces) ──
                # If the top-3 hue bins own > 65% of pixels, this is a painted
                # or branded surface (truck body, colorful wall, billboard).
                top3_concentration = float(np.sort(hist_norm)[-3:].sum())
                if top3_concentration > 0.65:
                    continue

                # ── Filter 4: garbage-palette pixel ratio ───────────────────
                # Garbage piles contain: earthy browns, dirty olive greens,
                # grey/dirty neutrals, and dark/ash areas.
                # Truck logos, clean walls, and vehicles fail this check because
                # they have bright, saturated brand colors, not earthy dirty tones.
                brown = (cell_hue >= 5)  & (cell_hue <= 30) & (cell_sat >= 40) & (cell_val >= 30) & (cell_val <= 160)
                olive = (cell_hue >= 30) & (cell_hue <= 75) & (cell_sat >= 25) & (cell_val >= 20) & (cell_val <= 130)
                grey  = (cell_sat < 60)  & (cell_val >= 30) & (cell_val <= 200)
                dark  = cell_val < 55    # Ash, burnt waste, deep shadow
                garbage_palette_ratio = float(np.sum(brown | olive | grey | dark)) / n_px
                if garbage_palette_ratio < 0.20:
                    continue   # Not enough dirty/earthy colors → not garbage

                # ── Cell score ──────────────────────────────────────────────
                score = (
                    min(1.0, edge_density / 0.30)                   * 0.35 +
                    min(1.0, max(0.0, entropy - 1.5) / 2.0)         * 0.35 +
                    min(1.0, garbage_palette_ratio / 0.50)          * 0.30
                )
                cell_scores[r, c] = score

        # --- Require minimum qualifying cells ---
        CELL_THRESHOLD = 0.42
        garbage_mask   = cell_scores > CELL_THRESHOLD
        n_garbage      = int(np.sum(garbage_mask))
        if n_garbage < 3:
            return None

        # --- Tight bounding box: only the qualifying cells, nothing extra ---
        garbage_rows = np.where(garbage_mask.any(axis=1))[0]
        garbage_cols = np.where(garbage_mask.any(axis=0))[0]
        min_r, max_r = int(garbage_rows.min()), int(garbage_rows.max())
        min_c, max_c = int(garbage_cols.min()), int(garbage_cols.max())

        px1 = min_c * cell_w
        py1 = min_r * cell_h
        px2 = min((max_c + 1) * cell_w, frame_w - 1)
        py2 = min((max_r + 1) * cell_h, frame_h - 1)

        # --- Final region verification ---
        region_edges = edges[py1:py2, px1:px2]
        region_hue   = hue_chan[py1:py2, px1:px2].ravel()
        n_region = len(region_hue)
        if n_region == 0:
            return None

        final_edge_density = float(np.sum(region_edges > 0)) / n_region
        hist2, _ = np.histogram(region_hue, bins=18, range=(0, 180))
        hist2_norm = hist2 / (hist2.sum() + 1e-8)
        final_entropy = float(-np.sum(hist2_norm * np.log2(hist2_norm + 1e-8)))
        mean_cell_score = float(np.mean(cell_scores[garbage_mask]))

        overall_score = (
            min(1.0, n_garbage / 12.0)              * 0.25 +
            min(1.0, final_entropy / 3.5)           * 0.35 +
            min(1.0, final_edge_density / 0.20)     * 0.25 +
            mean_cell_score                         * 0.15
        )
        if overall_score < 0.45:
            return None

        confidence = min(0.92, 0.35 + overall_score * 0.60)
        print(
            f"[Detector] Scene pile: cells={n_garbage}/{GRID_ROWS*GRID_COLS}, "
            f"bbox=[{px1},{py1},{px2},{py2}], entropy={final_entropy:.2f}, "
            f"edge={final_edge_density:.2f}, score={overall_score:.2f}, conf={confidence:.2f}"
        )

        return Detection(
            class_name="garbage_pile",
            confidence=confidence,
            bbox=[px1, py1, px2, py2],
            category="Garbage",
            color=CATEGORY_COLORS.get("Garbage", CATEGORY_COLORS["default"]),
            streak=99,
            is_confirmed=True,
            types_list=["mixed waste"],
        )

    def _assess_severity(self, detections: List[Detection]) -> str:
        """Map confirmed detection count to a severity level.
        
        A garbage_pile detection (whether from clustering or scene analysis)
        is always escalated to at least MEDIUM, since it represents a large
        uncontained mass of waste that needs urgent attention.
        """
        waste_detections = [d for d in detections if d.category != "Person"]
        count = len(waste_detections)

        if count == 0:
            return "NONE"

        severity = "CRITICAL"
        for level, (lo, hi) in SEVERITY_THRESHOLDS.items():
            if lo <= count <= hi:
                severity = level
                break

        # Escalate: garbage pile = always at least MEDIUM
        has_pile = any(d.class_name == "garbage_pile" for d in waste_detections)
        if has_pile:
            order = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
            if order.index(severity) < order.index("MEDIUM"):
                severity = "MEDIUM"

        return severity

    def _annotate_frame(
        self,
        frame: np.ndarray,
        detections: List[Detection],
        severity: str,
        frame_w: int,
        frame_h: int,
    ) -> np.ndarray:
        """Draw bounding boxes, labels, and severity badge on frame."""
        now = time.time()

        for det in detections:
            x1, y1, x2, y2 = det.bbox

            # Clamp coords to frame bounds
            x1 = max(0, min(x1, frame_w - 1))
            x2 = max(0, min(x2, frame_w - 1))
            y1 = max(0, min(y1, frame_h - 1))
            y2 = max(0, min(y2, frame_h - 1))

            if det.is_confirmed:
                color = det.color
                if det.category == "Person":
                    status = "PERSON"
                else:
                    status = f"{det.category}  {det.confidence:.0%}"
            else:
                color = (150, 150, 150)
                wait = max(0.0, 1.0 - (now - det.stationary_start))
                status = f"CHECKING... ({wait:.1f}s)"

            # Build label text
            display_name = det.class_name.replace("_", " ").title()
            if det.types_list:
                inner = ", ".join(n.replace("_", " ").title() for n in det.types_list[:3])
                display_name = f"Garbage Pile [{inner}]"
            label = f"#{det.id} {display_name}: {status}"

            # Bounding box
            thickness = 2 if det.is_confirmed else 1
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

            # Label background — clamp so it never goes above the frame top
            font_scale = 0.42
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
            label_top = max(0, y1 - th - 8)
            label_bot = label_top + th + 8
            cv2.rectangle(frame, (x1, label_top), (x1 + tw + 6, label_bot), color, -1)
            cv2.putText(frame, label, (x1 + 3, label_bot - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), 1, cv2.LINE_AA)

        # Severity badge at top-left
        sev_color = SEVERITY_COLORS.get(severity, (200, 200, 200))
        waste_count = len([d for d in detections if d.category != "Person"])
        badge = f"Waste: {waste_count} obj | Severity: {severity}"
        badge_w = len(badge) * 10 + 20
        cv2.rectangle(frame, (0, 0), (min(badge_w, frame_w), 34), (0, 0, 0), -1)
        cv2.putText(frame, badge, (8, 23),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.62, sev_color, 2, cv2.LINE_AA)

        return frame

    def _subclassify_crop(
        self,
        frame: np.ndarray,
        bbox: List[int],
        current_class: str,
        current_category: str
    ) -> tuple:
        """
        Extract the cropped bounding box, check if classifier is enabled/loaded,
        and predict the fine-grained category if it is a waste item.
        """
        if self.classifier and not self.classifier._model_loaded:
            # Dynamically try to reload the classifier if training just finished
            self.classifier.load_model()

        if not self.classifier or not self.classifier._model_loaded:
            return current_class, current_category, 0.0

        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        cx1 = max(0, min(int(x1), w - 1))
        cy1 = max(0, min(int(y1), h - 1))
        cx2 = max(0, min(int(x2), w - 1))
        cy2 = max(0, min(int(y2), h - 1))

        if cx2 <= cx1 or cy2 <= cy1:
            return current_class, current_category, 0.0

        crop_img = frame[cy1:cy2, cx1:cx2]
        pred = self.classifier.predict(crop_img)
        if pred:
            pred_class, pred_conf = pred
            # Dynamic thresholding: standard guess among 10 classes is 10%.
            # We use 0.25 for general classes, and 0.20 specifically for hazardous E-Waste (battery)
            # to make sure critical items are identified even with moderate confidence.
            threshold = 0.20 if pred_class == "battery" else 0.25
            if pred_conf > threshold:
                mapped_cat = CLASSIFIER_CATEGORY_MAP.get(pred_class, current_category)
                return pred_class, mapped_cat, pred_conf

        return current_class, current_category, 0.0
