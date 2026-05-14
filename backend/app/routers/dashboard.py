"""
Dashboard API — KPI stats and overview data.
"""

import time
import os
# pyrefly: ignore [missing-import]
from fastapi import APIRouter
from backend.app.config import EVIDENCE_DIR

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Track when the server started
_start_time = time.time()

# In-memory stats (replace with DB in production)
_stats = {
    "total_detections": 0,
    "total_alerts": 0,
    "severity_counts": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
    "category_counts": {},
    "recent_events": [],
}


def record_detection(result):
    """Called by camera callback to update stats."""
    if result.object_count == 0:
        return
    _stats["total_detections"] += 1
    if result.severity in _stats["severity_counts"]:
        _stats["severity_counts"][result.severity] += 1
    if result.severity in ("HIGH", "CRITICAL"):
        _stats["total_alerts"] += 1

    for d in result.detections:
        cat = d.category
        _stats["category_counts"][cat] = _stats["category_counts"].get(cat, 0) + 1

    event = {
        "severity": result.severity,
        "object_count": result.object_count,
        "timestamp": result.timestamp,
        "lat": result.lat,
        "lng": result.lng,
        "area": result.area,
        "classes": [d.class_name for d in result.detections],
        "categories": [d.category for d in result.detections],
    }
    _stats["recent_events"].append(event)
    # Keep only last 50 events
    if len(_stats["recent_events"]) > 50:
        _stats["recent_events"] = _stats["recent_events"][-50:]


@router.get("/stats")
def get_stats():
    """Return dashboard KPI stats."""
    evidence_count = len(list(EVIDENCE_DIR.glob("*.jpg"))) if EVIDENCE_DIR.exists() else 0
    return {
        "total_detections": _stats["total_detections"],
        "total_alerts": _stats["total_alerts"],
        "severity_counts": _stats["severity_counts"],
        "category_counts": _stats["category_counts"],
        "evidence_snapshots": evidence_count,
        "uptime": round(time.time() - _start_time, 1),
    }


@router.get("/recent-events")
def get_recent_events():
    """Return last 50 detection events."""
    return {"events": list(reversed(_stats["recent_events"]))}
