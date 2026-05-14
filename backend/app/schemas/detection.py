# pyrefly: ignore [missing-import]
from pydantic import BaseModel


class DetectionItem(BaseModel):
    class_name: str
    confidence: float
    bbox: list[int]
    lat: float = 0.0
    lng: float = 0.0


class DetectionEvent(BaseModel):
    event_type: str = "detection"
    severity: str
    object_count: int
    timestamp: float
    lat: float = 0.0
    lng: float = 0.0
    detections: list[DetectionItem]


class CameraStatus(BaseModel):
    camera_id: str
    active: bool
    source: str
    latest_severity: str = "NONE"
    latest_count: int = 0


class CameraSourceRequest(BaseModel):
    source: str | int
