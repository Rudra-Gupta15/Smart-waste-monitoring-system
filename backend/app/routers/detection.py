"""
Detection API — live video feed (MJPEG), static image analysis, and detection events.
"""

import asyncio
import base64
import json
import time
import urllib.request
import urllib.parse

# pyrefly: ignore [missing-import]
import cv2
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse, JSONResponse
import shutil
from pathlib import Path

from backend.app.schemas.detection import CameraSourceRequest
from backend.app.config import get_area_name

router = APIRouter(prefix="/api/detection", tags=["detection"])

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/source")
async def update_camera_source(request: CameraSourceRequest):
    """Update the camera source dynamically."""
    if _camera_stream is None:
        return JSONResponse({"status": "error", "message": "Camera stream not initialized"}, status_code=500)

    try:
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, _camera_stream.update_source, request.source)
        return {"status": "success", "source": request.source}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@router.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video/image file and set it as the camera source for detection."""
    if _camera_stream is None:
        return JSONResponse({"status": "error", "message": "Camera stream not initialized"}, status_code=500)

    try:
        # Sanitize filename to prevent path traversal on Windows
        safe_name = Path(file.filename).name if file.filename else "upload"
        file_path = UPLOAD_DIR / safe_name

        # Write file to disk asynchronously
        contents = await file.read()
        file_path.write_bytes(contents)

        # Run blocking update_source() in a thread so we don't block the event loop.
        # Without this, model stop/start (~3-10s) would freeze all other requests
        # and cause the Vite proxy to return 400/504 errors.
        abs_path = str(file_path.absolute())
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, _camera_stream.update_source, abs_path)

        return {
            "status": "success",
            "message": "Media uploaded and source updated",
            "filename": safe_name,
            "path": abs_path,
        }
    except Exception as e:
        print(f"[API] /upload-video error: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@router.post("/detect-image")
async def detect_image_endpoint(file: UploadFile = File(...)):
    """
    Detect waste in a static uploaded image.
    Bypasses temporal tracking — all confident detections are immediately
    confirmed and returned, plus a base64-encoded annotated JPEG.
    """
    if _camera_stream is None:
        return JSONResponse(
            {"status": "error", "message": "Detector not initialized. Start the server first."},
            status_code=500,
        )

    try:
        # Decode the uploaded image into an OpenCV frame
        raw_bytes = await file.read()
        np_arr = np.frombuffer(raw_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            return JSONResponse(
                {"status": "error", "message": "Could not decode image. Make sure it is a valid JPEG/PNG."},
                status_code=400,
            )

        # Run static-image detection (no tracking, immediate confirmation)
        result = _camera_stream.detector.detect_image(frame)

        # Encode the annotated frame as a base64 JPEG for inline display
        annotated_b64 = None
        if result.annotated_frame is not None:
            _, buf = cv2.imencode(".jpg", result.annotated_frame,
                                  [cv2.IMWRITE_JPEG_QUALITY, 90])
            annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")

        return {
            "status": "success",
            "severity": result.severity,
            "object_count": result.object_count,
            "annotated_image": annotated_b64,
            "detections": [
                {
                    "id": d.id,
                    "class_name": d.class_name,
                    "category": d.category,
                    "confidence": round(d.confidence, 3),
                    "bbox": d.bbox,
                    "types": d.types_list,
                }
                for d in result.detections
            ],
        }
    except Exception as e:
        print(f"[API] /detect-image error: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@router.post("/location")
def update_camera_location(lat: float, lng: float):
    """Update the camera location dynamically and resolve real area name."""
    global _current_area_name

    if _camera_stream is None:
        return JSONResponse({"status": "error", "message": "Camera stream not initialized"}, status_code=500)

    print(f"[LOCATION] Updating camera GPS: {lat}, {lng}")
    _camera_stream.config.latitude = lat
    _camera_stream.config.longitude = lng
    # Also update the detector's cached coordinates
    _camera_stream.detector.current_lat = lat
    _camera_stream.detector.current_lng = lng

    # Real reverse geocoding — get human-readable location name
    area_name = _reverse_geocode(lat, lng)
    _current_area_name = area_name
    # Inject the resolved name into the detector so all detections use it
    _camera_stream.detector.current_area_name = area_name
    print(f"[LOCATION] Resolved area: '{area_name}'")

    return {"status": "success", "lat": lat, "lng": lng, "area": area_name}

# Global reference — set by main.py at startup
_camera_stream = None

# Current resolved location name (updated when GPS is synced)
_current_area_name: str = "Nagpur Central"


def set_camera_stream(stream):
    global _camera_stream
    _camera_stream = stream


def _reverse_geocode(lat: float, lng: float) -> str:
    """Reverse geocode coordinates to a human-readable location name.
    Uses Nominatim (OpenStreetMap) — no API key required.
    Falls back to the nearest hardcoded Nagpur zone on any error.
    """
    try:
        params = urllib.parse.urlencode({
            "lat": lat,
            "lon": lng,
            "format": "json",
            "zoom": 16,          # neighbourhood level
            "addressdetails": 1,
        })
        url = f"https://nominatim.openstreetmap.org/reverse?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "SmartWasteManagement/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())

        addr = data.get("address", {})
        # Build a concise, readable name from address components
        parts = []
        for key in ("suburb", "neighbourhood", "quarter", "city_district", "town", "village"):
            val = addr.get(key)
            if val:
                parts.append(val)
                break  # take only the most specific part
        city = addr.get("city") or addr.get("town") or ""
        if city and city not in parts:
            parts.append(city)
        name = ", ".join(parts) if parts else data.get("display_name", "").split(",")[0]
        return name.strip() or get_area_name(lat, lng)
    except Exception as e:
        print(f"[GEO] Reverse geocode failed: {e} — using local lookup")
        return get_area_name(lat, lng)


def _generate_mjpeg():
    """Generator that yields MJPEG frames from the camera stream."""
    while True:
        if _camera_stream is None or not _camera_stream.running:
            time.sleep(0.1)
            continue

        jpeg = _camera_stream.latest_jpeg
        if jpeg is None:
            time.sleep(0.05)
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
        )
        time.sleep(0.033)  # ~30 FPS


@router.get("/video-feed")
def video_feed():
    """MJPEG stream of the annotated camera feed."""
    return StreamingResponse(
        _generate_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/latest")
def latest_detection():
    """Get the latest detection result as JSON."""
    if _camera_stream is None:
        return JSONResponse({"status": "no_camera"}, status_code=503)

    result = _camera_stream.latest_result
    if result is None:
        return {"status": "waiting", "detections": [], "severity": "NONE", "object_count": 0}

    return {
        "status": "active",
        "severity": result.severity,
        "object_count": result.object_count,
        "timestamp": result.timestamp,
        "lat": result.lat,
        "lng": result.lng,
        "area": result.area,
        "detections": [
            {
                "class_name": d.class_name,
                "category": d.category,
                "confidence": round(d.confidence, 3),
                "bbox": d.bbox,
                "lat": d.lat,
                "lng": d.lng,
            }
            for d in result.detections
        ],
    }


@router.get("/status")
def camera_status():
    """Check if the camera is running."""
    if _camera_stream is None:
        return {"active": False, "source": "none"}
    return {
        "active": _camera_stream.running,
        "source": str(_camera_stream.config.source),
        "frame_count": _camera_stream._frame_count,
        "paused": getattr(_camera_stream, 'paused', False),
    }

@router.post("/toggle-pause")
def toggle_pause():
    """Toggle the paused state of the camera stream."""
    if _camera_stream is None:
        return JSONResponse({"status": "error", "message": "Camera stream not initialized"}, status_code=500)
    
    _camera_stream.paused = not getattr(_camera_stream, 'paused', False)
    return {"status": "success", "paused": _camera_stream.paused}


@router.websocket("/ws/events")
async def detection_events_ws(websocket: WebSocket):
    """WebSocket that pushes detection events in real-time."""
    await websocket.accept()
    print("[WS] Client connected to /ws/events")

    last_sent_timestamp = 0
    last_object_ids = set()
    
    try:
        while True:
            if _camera_stream and _camera_stream.latest_result:
                result = _camera_stream.latest_result
                
                # Deduplication logic:
                # 1. Get current object IDs
                current_ids = {d.id for d in result.detections}
                
                # 2. Check if anything changed:
                # - IDs changed (new objects, or objects left)
                # - Severity changed
                # - Or it's been more than 30 seconds (heartbeat/persistence)
                ids_changed = current_ids != last_object_ids
                time_passed = result.timestamp - last_sent_timestamp > 30
                
                # Send event if we have objects OR if we just dropped to 0 objects (so UI clears)
                should_send = (result.object_count > 0 and (ids_changed or time_passed)) or (result.object_count == 0 and len(last_object_ids) > 0)
                
                if should_send:
                    event = {
                        "event": "waste_detected",
                        "severity": result.severity,
                        "object_count": result.object_count,
                        "timestamp": result.timestamp,
                        "lat": result.lat,
                        "lng": result.lng,
                        "area": result.area,
                        "classes": [c for d in result.detections for c in (d.types_list if hasattr(d, "types_list") and d.types_list else [d.class_name])],
                        "categories": [d.category for d in result.detections],
                        "detections": [
                            {
                                "id": d.id,
                                "class_name": d.class_name,
                                "category": d.category,
                                "confidence": round(d.confidence, 3),
                                "bbox": d.bbox,
                                "lat": d.lat,
                                "lng": d.lng,
                            }
                            for d in result.detections
                        ],
                    }
                    await websocket.send_text(json.dumps(event))
                    last_sent_timestamp = result.timestamp
                    last_object_ids = current_ids

            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
