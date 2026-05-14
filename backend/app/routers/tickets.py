"""
Tickets API — auto-generated tickets, CRUD, worker actions.
"""

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Query
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
from typing import Optional
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from backend.app.services.ticket_engine import (
    get_tickets, accept_ticket, resolve_ticket,
    get_alerts, get_notifications, mark_notification_read,
    get_workers, get_worker_tickets, get_collection_points,
    get_stats_summary, NAGPUR_HOTSPOTS, WORKERS,
)

router = APIRouter(prefix="/api", tags=["tickets"])


class WorkerCreate(BaseModel):
    id: str
    name: str
    zone: str
    phone: str
    status: Optional[str] = "available"
    lat: Optional[float] = 21.1458
    lng: Optional[float] = 79.0882


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None


@router.get("/tickets")
def list_tickets(status: str = None):
    return {"tickets": get_tickets(status)}


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str):
    ticket = next((t for t in get_tickets() if t["id"] == ticket_id), None)
    if not ticket:
        return JSONResponse({"error": "Ticket not found"}, status_code=404)
    return ticket


@router.post("/tickets/{ticket_id}/accept")
def accept(ticket_id: str, worker_id: str = Query(...)):
    ticket, err = accept_ticket(ticket_id, worker_id)
    if err:
        return JSONResponse({"error": err}, status_code=400)
    return {"status": "accepted", "ticket": ticket}


@router.post("/tickets/{ticket_id}/resolve")
def resolve(ticket_id: str):
    ticket, err = resolve_ticket(ticket_id)
    if err:
        return JSONResponse({"error": err}, status_code=400)
    return {"status": "resolved", "ticket": ticket}


@router.get("/alerts")
def list_alerts():
    return {"alerts": list(reversed(get_alerts()))}


@router.get("/notifications")
def list_notifications(unread: bool = False):
    return {"notifications": list(reversed(get_notifications(unread)))}


@router.post("/notifications/{notif_id}/read")
def read_notification(notif_id: str):
    notif = mark_notification_read(notif_id)
    if not notif:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return {"status": "read"}


@router.get("/workers")
def list_workers():
    return {"workers": get_workers()}


@router.post("/workers")
def create_worker(worker: WorkerCreate):
    """Add a new worker."""
    if any(w["id"] == worker.id for w in WORKERS):
        return JSONResponse({"error": f"Worker ID {worker.id} already exists"}, status_code=400)
    new_worker = worker.model_dump()
    new_worker.setdefault("active_tickets", 0)
    WORKERS.append(new_worker)
    return new_worker


@router.put("/workers/{worker_id}")
def update_worker(worker_id: str, data: WorkerUpdate):
    """Update an existing worker."""
    worker = next((w for w in WORKERS if w["id"] == worker_id), None)
    if not worker:
        return JSONResponse({"error": "Worker not found"}, status_code=404)
    update_fields = data.model_dump(exclude_none=True)
    worker.update(update_fields)
    return worker


@router.delete("/workers/{worker_id}")
def delete_worker(worker_id: str):
    """Delete a worker."""
    global WORKERS
    worker = next((w for w in WORKERS if w["id"] == worker_id), None)
    if not worker:
        return JSONResponse({"error": "Worker not found"}, status_code=404)
    WORKERS[:] = [w for w in WORKERS if w["id"] != worker_id]
    return {"status": "deleted", "id": worker_id}


@router.get("/workers/{worker_id}/tickets")
def worker_tickets(worker_id: str):
    return {"tickets": get_worker_tickets(worker_id)}


@router.get("/collection-points")
def list_collection_points():
    return {"points": get_collection_points()}


@router.get("/hotspots")
def list_hotspots():
    return {"hotspots": NAGPUR_HOTSPOTS}


@router.get("/admin/stats")
def admin_stats():
    return get_stats_summary()
