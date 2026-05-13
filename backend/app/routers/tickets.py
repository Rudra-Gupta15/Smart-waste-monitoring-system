"""
Tickets API — auto-generated tickets, CRUD, worker actions.
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from backend.app.services.ticket_engine import (
    get_tickets, accept_ticket, resolve_ticket,
    get_alerts, get_notifications, mark_notification_read,
    get_workers, get_worker_tickets, get_collection_points,
    get_stats_summary, NAGPUR_HOTSPOTS,
)

router = APIRouter(prefix="/api", tags=["tickets"])


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
