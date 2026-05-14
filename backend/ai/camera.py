"""
Camera Manager — handles video capture from webcam, RTSP, or video files.
Feeds frames to the waste detector and streams results.
"""

import time
import threading
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List, Union, Dict

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np

from backend.ai.detector import WasteDetector, FrameResult
from backend.app.config import CAMERA_SOURCE, FRAME_INTERVAL, EVIDENCE_DIR


@dataclass
class CameraConfig:
    source: Union[int, str] = 0       # 0=webcam, or filepath, or RTSP url
    frame_interval: int = 2     # Process every N-th frame
    resolution: tuple = (1280, 720)
    save_detections: bool = True
    latitude: float = 21.1458   # Default Nagpur
    longitude: float = 79.0882


class CameraStream:
    """Manages a single camera feed with waste detection."""

    def __init__(self, config: Optional[CameraConfig] = None):
        self.config = config or CameraConfig(source=CAMERA_SOURCE, frame_interval=FRAME_INTERVAL)
        self.detector = WasteDetector()
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        self._lock = threading.Lock()
        
        # State
        self._latest_raw_frame: Optional[np.ndarray] = None
        self._latest_result: Optional[FrameResult] = None
        self._latest_jpeg: Optional[bytes] = None
        
        # Performance/Tracking
        self._frame_count = 0
        self._callbacks: List = []
        self._last_notification_time = 0
        self._notification_cooldown = 10.0
        self._last_object_ids = set()
        self._last_severity = "NONE"

    def start(self):
        """Open camera and start capture/processing threads."""
        self.detector.load_model()

        source = self.config.source
        print(f"[Camera] Opening source: {source}")
        self.cap = cv2.VideoCapture(source)

        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open camera source: {source}")

        # Apply configured resolution
        w, h = self.config.resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, w)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
        
        # Reduce internal buffer size to minimum to avoid lag
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        # Get original video FPS to prevent playing too fast
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        if not self.fps or self.fps <= 0:
            self.fps = 30.0

        self.running = True
        
        # Thread 1: Continuous Frame Capture (Producer)
        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._capture_thread.start()
        
        # Thread 2: Detection and Encoding (Consumer)
        self._process_thread = threading.Thread(target=self._processing_loop, daemon=True)
        self._process_thread.start()
        
        print("[Camera] Stream threads started.")

    def stop(self):
        """Stop threads and release camera."""
        self.running = False
        # Wait for threads to finish before releasing hardware
        for t in (getattr(self, '_capture_thread', None), getattr(self, '_process_thread', None)):
            if t and t.is_alive():
                t.join(timeout=3.0)
        if self.cap:
            self.cap.release()
            self.cap = None
        print("[Camera] Stream stopped.")

    def update_source(self, new_source: Union[int, str]):
        """Update camera source and restart stream."""
        print(f"[Camera] Updating source to: {new_source}")
        was_running = self.running
        self.stop()
        self.config.source = new_source
        if was_running:
            self.start()

    def on_detection(self, callback):
        """Register a callback for when waste is detected: callback(FrameResult)."""
        self._callbacks.append(callback)

    @property
    def latest_result(self) -> Optional[FrameResult]:
        with self._lock:
            return self._latest_result

    @property
    def latest_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._latest_jpeg

    def _capture_loop(self):
        """Low-latency capture loop that always keeps the latest frame available."""
        is_file = isinstance(self.config.source, str) and Path(self.config.source).is_file()
        # 0.5x speed requested: Multiply delay by 2.0
        frame_delay = (1.0 / self.fps) * 2.0 if hasattr(self, 'fps') and self.fps > 0 else (1.0 / 30.0) * 2.0

        while self.running:
            try:
                start_time = time.time()
                
                if self.cap is None or not self.cap.isOpened():
                    time.sleep(0.1)
                    continue
                ret, frame = self.cap.read()
                if not ret:
                    if is_file:
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    print("[Camera] Failed to read frame. Capture loop exiting.")
                    break
                
                with self._lock:
                    self._latest_raw_frame = frame
                
                if is_file:
                    # Maintain real video speed
                    elapsed = time.time() - start_time
                    sleep_time = frame_delay - elapsed
                    if sleep_time > 0:
                        time.sleep(sleep_time)
                else:
                    # Tiny sleep to yield for live cameras
                    time.sleep(0.001)
            except Exception as e:
                print(f"[Camera] Capture error: {e}")
                time.sleep(0.1)

    def _processing_loop(self):
        """Background loop that processes the latest available frame."""
        while self.running:
            frame = None
            with self._lock:
                if self._latest_raw_frame is not None:
                    frame = self._latest_raw_frame.copy()  # Copy to avoid race with capture thread
            
            if frame is None:
                time.sleep(0.1)
                continue

            self._frame_count += 1
            
            # 1. Decide if we should run AI detection or just encode
            is_detection_frame = (self._frame_count % self.config.frame_interval == 0)
            
            if is_detection_frame:
                # Run full YOLO detection — wrapped so any crash keeps the thread alive
                try:
                    # Update detector with current location before processing
                    self.detector.current_lat = self.config.latitude
                    self.detector.current_lng = self.config.longitude
                    result = self.detector.detect(frame)
                except Exception as e:
                    print(f"[Camera] Detection error: {e}")
                    result = None

                if result is not None:
                    with self._lock:
                        self._latest_result = result
                        if result.annotated_frame is not None:
                            _, buf = cv2.imencode(".jpg", result.annotated_frame,
                                                  [cv2.IMWRITE_JPEG_QUALITY, 80])
                            self._latest_jpeg = buf.tobytes()

                    # Notification logic
                    self._handle_notifications(result)
            else:
                # Non-detection frame: only encode raw if we have NO annotated
                # frame yet (first few frames). Otherwise keep showing the last
                # annotated frame so bounding boxes don't flicker on/off.
                with self._lock:
                    if self._latest_jpeg is None:
                        _, buf = cv2.imencode(".jpg", frame,
                                              [cv2.IMWRITE_JPEG_QUALITY, 75])
                        self._latest_jpeg = buf.tobytes()

            # Pacing
            time.sleep(0.01 if not is_detection_frame else 0.001)

    def _handle_notifications(self, result: FrameResult):
        """Checks if a notification or evidence save is needed."""
        current_ids = {d.id for d in result.detections}
        new_objects = current_ids - self._last_object_ids
        severity_increased = self._is_severity_higher(result.severity, self._last_severity)
        time_since_last = time.time() - self._last_notification_time

        should_notify = (
            len(new_objects) > 0 or 
            severity_increased or 
            (result.object_count > 0 and time_since_last > self._notification_cooldown)
        )

        if should_notify:
            self._last_notification_time = time.time()
            self._last_object_ids = current_ids
            self._last_severity = result.severity

            if result.object_count > 0 and self.config.save_detections:
                self._save_snapshot(result)

            for cb in self._callbacks:
                try:
                    cb(result)
                except Exception as e:
                    print(f"[Camera] Callback error: {e}")

    def _is_severity_higher(self, current: str, last: str) -> bool:
        order = {"NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        return order.get(current, 0) > order.get(last, 0)

    def _save_snapshot(self, result: FrameResult):
        """Save annotated frame as evidence."""
        ts = time.strftime("%Y%m%d_%H%M%S")
        filename = f"detection_{ts}_{result.severity}.jpg"
        path = EVIDENCE_DIR / filename
        if result.annotated_frame is not None:
            cv2.imwrite(str(path), result.annotated_frame)


class CameraManager:
    """Manages multiple camera streams."""

    def __init__(self):
        self.streams: Dict[str, CameraStream] = {}

    def add_camera(self, camera_id: str, config: CameraConfig) -> CameraStream:
        stream = CameraStream(config)
        self.streams[camera_id] = stream
        return stream

    def get_stream(self, camera_id: str) -> Optional[CameraStream]:
        return self.streams.get(camera_id)

    def start_all(self):
        for cid, stream in self.streams.items():
            print(f"[Manager] Starting camera: {cid}")
            stream.start()

    def stop_all(self):
        for cid, stream in self.streams.items():
            print(f"[Manager] Stopping camera: {cid}")
            stream.stop()
