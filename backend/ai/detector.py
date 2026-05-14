"""
YOLOv8 Waste/Garbage Object Detector
Processes camera frames and detects waste-related objects.
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
)


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
        self.max_missed = 5   # frames before dropping a lost track
        self.min_streak = 2   # minimum consecutive detections to confirm

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
        except Exception as e:
            raise RuntimeError(f"[Detector] Failed to load model '{self.model_path}': {e}") from e

        self.class_names = self.model.names
        self._build_waste_class_ids()
        self._model_loaded = True
        print(f"[Detector] Model loaded. {len(self.class_names)} classes, "
              f"{len(self.waste_class_ids)} waste class IDs active.")

    def _build_waste_class_ids(self):
        """Determine which class IDs are considered waste."""
        all_names = set(n.lower() for n in self.class_names.values())
        is_custom_garbage_model = bool(all_names) and all_names.issubset(GARBAGE_CLASSES)

        if is_custom_garbage_model:
            # Custom model: every class is waste — leave waste_class_ids empty
            # so the filter `if self.waste_class_ids` evaluates False → all pass
            self.waste_class_ids = set()
            for name in self.class_names.values():
                # Provide nice human-readable category names for custom classes
                formatted_name = name.replace("_", " ").title()
                WASTE_CATEGORY_MAP[name] = formatted_name
            print("[Detector] Custom garbage model detected — all classes treated as waste.")
        else:
            # COCO model: only approved waste proxy classes
            self.waste_class_ids = set()
            for class_id, name in self.class_names.items():
                if name.lower() in WASTE_CLASSES:
                    self.waste_class_ids.add(class_id)
            print(f"[Detector] COCO model. Active waste classes: "
                  f"{[self.class_names[i] for i in sorted(self.waste_class_ids)]}")

    # ------------------------------------------------------------------
    # Core detection
    # ------------------------------------------------------------------

    def detect(self, frame: np.ndarray) -> FrameResult:
        """
        Run YOLO inference on a frame and return a FrameResult.
        Never raises — returns an empty result on any error so the
        camera stream keeps running.
        """
        # Safety: model must be loaded before detect() is called
        if not self._model_loaded:
            print("[Detector] detect() called but model not loaded — skipping frame.")
            return FrameResult(timestamp=time.time())

        try:
            return self._run_detection(frame)
        except Exception as e:
            print(f"[Detector] ERROR during inference: {e}")
            # Return a safe empty result so the camera doesn't hang
            return FrameResult(
                timestamp=time.time(),
                annotated_frame=frame.copy(),
            )

    def _run_detection(self, frame: np.ndarray) -> FrameResult:
        """Internal detection logic — called by detect() inside a try/except."""
        frame_h, frame_w = frame.shape[:2]
        frame_area = frame_h * frame_w

        # --- YOLO inference ---
        results = self.model(frame, conf=self.confidence, verbose=False)[0]

        # 1. Extract raw detections from this frame
        current_detections: List[Detection] = []
        for box in results.boxes:
            class_id = int(box.cls[0])
            class_name = self.class_names.get(class_id, "unknown")
            conf = float(box.conf[0])

            # 1. Explicit exclusion: Never treat actual animals as waste
            if class_name in ["dog", "cat"]:
                continue

            # 2. Filter: allow waste classes OR people (informational)
            is_person = (class_name == "person")
            if self.waste_class_ids and class_id not in self.waste_class_ids and not is_person:
                continue

            # Per-class confidence override
            min_conf = PER_CLASS_CONFIDENCE.get(class_name, self.confidence)
            if conf < min_conf:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            # Filter: skip tiny bounding boxes
            bbox_area = (x2 - x1) * (y2 - y1)
            if frame_area > 0 and bbox_area / frame_area < MIN_BBOX_AREA_FRACTION:
                continue

            category = WASTE_CATEGORY_MAP.get(class_name, "Misc Waste")
            current_detections.append(Detection(
                class_name=class_name,
                confidence=conf,
                bbox=[int(x1), int(y1), int(x2), int(y2)],
                category=category,
                color=CATEGORY_COLORS.get(category, CATEGORY_COLORS["default"]),
                streak=1,
            ))

        # 2. Update tracking (thread-safe)
        with self._track_lock:
            self._update_tracks(current_detections)
            confirmed = [t for t in self.tracked_objects if t.is_confirmed and t.missed_count == 0]
            display  = [t for t in self.tracked_objects if t.missed_count == 0]

        severity = self._assess_severity(confirmed)
        annotated = self._annotate_frame(frame.copy(), display, severity, frame_w, frame_h)

        # 3. Prepare reporting data (Exclude 'Person' from logs/database)
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

    def _update_tracks(self, current_detections: List[Detection]):
        """Match current detections against tracked objects, update streaks."""
        updated_tracks = []
        now = time.time()

        for track in self.tracked_objects:
            best_iou = 0.0
            best_match = None

            for i, det in enumerate(current_detections):
                if det.class_name == track.class_name:
                    iou = self._calculate_iou(track.bbox, det.bbox)
                    if iou > 0.3 and iou > best_iou:
                        best_iou = iou
                        best_match = i

            if best_match is not None:
                match = current_detections.pop(best_match)

                # Reset stationary timer only if it moved significantly
                if best_iou < 0.8:
                    track.stationary_start = now

                track.bbox = match.bbox
                track.confidence = match.confidence
                track.streak += 1
                track.missed_count = 0

                # Confirm: stationary for 3 s AND seen enough consecutive frames
                if (now - track.stationary_start) >= 3.0 and track.streak >= self.min_streak:
                    track.is_confirmed = True

                updated_tracks.append(track)
            else:
                track.missed_count += 1
                if track.missed_count <= self.max_missed:
                    updated_tracks.append(track)
                # else: drop the track (garbage collected)

        # 3. Register new tracks for unmatched detections
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
        union = (x2-x1)*(y2-y1) + (x4-x3)*(y4-y3) - inter
        return inter / union if union > 0 else 0.0

    def _assess_severity(self, detections: List[Detection]) -> str:
        """Map confirmed detection count to a severity level."""
        # Only count objects that are NOT in the "Person" category
        waste_detections = [d for d in detections if d.category != "Person"]
        count = len(waste_detections)

        if count == 0:
            return "NONE"
        for level, (lo, hi) in SEVERITY_THRESHOLDS.items():
            if lo <= count <= hi:
                return level
        return "CRITICAL"

    def _annotate_frame(
        self,
        frame: np.ndarray,
        detections: List[Detection],
        severity: str,
        frame_w: int,
        frame_h: int,
    ) -> np.ndarray:
        """Draw bounding boxes, labels, and severity badge."""
        now = time.time()

        for det in detections:
            x1, y1, x2, y2 = det.bbox

            # Clamp coords to frame bounds to avoid OpenCV errors
            x1 = max(0, min(x1, frame_w - 1))
            x2 = max(0, min(x2, frame_w - 1))
            y1 = max(0, min(y1, frame_h - 1))
            y2 = max(0, min(y2, frame_h - 1))

            if det.is_confirmed:
                color = det.color
                if det.category == "Person":
                    status = "PERSON (Monitoring)"
                else:
                    status = f"CONFIRMED {det.category.upper()}"
            else:
                color = (150, 150, 150)
                wait = max(0.0, 3.0 - (now - det.stationary_start))
                status = f"ANALYZING ({wait:.1f}s)"

            label = f"#{det.id} {det.class_name}: {status}"

            # Bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Label background — clamp so it never goes above the frame top
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
            label_top = max(0, y1 - th - 8)
            label_bot = label_top + th + 8
            cv2.rectangle(frame, (x1, label_top), (x1 + tw + 4, label_bot), color, -1)
            cv2.putText(frame, label, (x1 + 2, label_bot - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)

        # Severity badge at top-left
        sev_color = SEVERITY_COLORS.get(severity, (200, 200, 200))
        badge = f"Waste: {len(detections)} obj | Severity: {severity}"
        badge_w = len(badge) * 10 + 20
        cv2.rectangle(frame, (0, 0), (min(badge_w, frame_w), 32), (0, 0, 0), -1)
        cv2.putText(frame, badge, (8, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, sev_color, 2)

        return frame
