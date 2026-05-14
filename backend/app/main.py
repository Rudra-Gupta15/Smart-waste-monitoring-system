"""
Smart Waste Management — FastAPI Application
AI-Powered Waste Detection & Monitoring
"""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ai.camera import CameraStream, CameraConfig
from backend.app.config import EVIDENCE_DIR, CAMERA_SOURCE, FRAME_INTERVAL, CAMERA_LAT, CAMERA_LNG
from backend.app.routers import detection, dashboard, tickets
from backend.app.services.ticket_engine import create_ticket_from_detection

# Global camera stream
camera_stream: Optional[CameraStream] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start camera on startup, stop on shutdown."""
    global camera_stream

    source = os.getenv("CAMERA_SOURCE", str(CAMERA_SOURCE))
    # Try to parse as int (webcam index)
    try:
        source = int(source)
    except ValueError:
        pass  # Keep as string (file path or RTSP URL)

    config = CameraConfig(
        source=source,
        frame_interval=int(os.getenv("FRAME_INTERVAL", str(FRAME_INTERVAL))),
        save_detections=True,
        latitude=float(os.getenv("CAMERA_LAT", str(CAMERA_LAT))),
        longitude=float(os.getenv("CAMERA_LNG", str(CAMERA_LNG))),
    )

    camera_stream = CameraStream(config)
    camera_stream.on_detection(dashboard.record_detection)
    camera_stream.on_detection(create_ticket_from_detection)  # Auto-ticketing
    detection.set_camera_stream(camera_stream)

    try:
        camera_stream.start()
        print("[App] Camera stream started. Detection active.")
    except RuntimeError as e:
        print(f"[App] WARNING: Could not start camera: {e}")
        print("[App] Running in API-only mode. Set CAMERA_SOURCE env var.")

    yield

    if camera_stream:
        camera_stream.stop()
    print("[App] Shutdown complete.")


app = FastAPI(
    title="Smart Waste Management",
    description="AI-Powered Waste Detection & Monitoring System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve evidence images
if EVIDENCE_DIR.exists():
    app.mount("/evidence", StaticFiles(directory=str(EVIDENCE_DIR)), name="evidence")

# Register routers
app.include_router(detection.router)
app.include_router(dashboard.router)
app.include_router(tickets.router)


@app.get("/")
def root():
    return {
        "name": "Smart Waste Management System",
        "status": "running",
        "docs": "/docs",
        "video_feed": "/api/detection/video-feed",
        "ws_events": "ws://localhost:8000/api/detection/ws/events",
    }


if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
