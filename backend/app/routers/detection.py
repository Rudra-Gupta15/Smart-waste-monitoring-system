"""
Detection API — live video feed (MJPEG) and detection events.
"""

import asyncio
import json
import time

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse, JSONResponse

from backend.app.schemas.detection import CameraSourceRequest

router = APIRouter(prefix="/api/detection", tags=["detection"])


@router.post("/source")
def update_camera_source(request: CameraSourceRequest):
    """Update the camera source dynamically."""
    if _camera_stream is None:
        return JSONResponse({"status": "error", "message": "Camera stream not initialized"}, status_code=500)
    
    try:
        _camera_stream.update_source(request.source)
        return {"status": "success", "source": request.source}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

# Global reference — set by main.py at startup
_camera_stream = None


def set_camera_stream(stream):
    global _camera_stream
    _camera_stream = stream


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
        "detections": [
            {
                "class_name": d.class_name,
                "category": d.category,
                "confidence": round(d.confidence, 3),
                "bbox": d.bbox,
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
    }


@router.websocket("/ws/events")
async def detection_events_ws(websocket: WebSocket):
    """WebSocket that pushes detection events in real-time."""
    await websocket.accept()
    print("[WS] Client connected to /ws/events")

    last_sent = 0
    try:
        while True:
            if _camera_stream and _camera_stream.latest_result:
                result = _camera_stream.latest_result
                # Only send if there's a new detection with waste
                if result.timestamp > last_sent and result.object_count > 0:
                    event = {
                        "event": "waste_detected",
                        "severity": result.severity,
                        "object_count": result.object_count,
                        "timestamp": result.timestamp,
                        "classes": [d.class_name for d in result.detections],
                        "categories": [d.category for d in result.detections],
                        "detections": [
                            {
                                "class_name": d.class_name,
                                "category": d.category,
                                "confidence": round(d.confidence, 3),
                                "bbox": d.bbox,
                            }
                            for d in result.detections
                        ],
                    }
                    await websocket.send_text(json.dumps(event))
                    last_sent = result.timestamp

            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
