"""
Auto Ticket Engine — generates tickets when AI detects garbage.
Handles de-duplication (100m radius), severity scoring, and worker assignment.
"""

import time
import uuid
import math
import random
from datetime import datetime

# Nagpur region workers
WORKERS = [
    {"id": "WKR-001", "name": "Rajesh Kumar", "zone": "Dharampeth", "phone": "9823XXXX01", "status": "available", "active_tickets": 0, "lat": 21.1520, "lng": 79.0750},
    {"id": "WKR-002", "name": "Priya Sharma", "zone": "Sitabuldi", "phone": "9823XXXX02", "status": "available", "active_tickets": 0, "lat": 21.1430, "lng": 79.0830},
    {"id": "WKR-003", "name": "Amit Patil", "zone": "Sadar", "phone": "9823XXXX03", "status": "available", "active_tickets": 0, "lat": 21.1560, "lng": 79.0930},
    {"id": "WKR-004", "name": "Sunita Deshmukh", "zone": "Civil Lines", "phone": "9823XXXX04", "status": "available", "active_tickets": 0, "lat": 21.1490, "lng": 79.0680},
    {"id": "WKR-005", "name": "Ganesh Wagh", "zone": "Manewada", "phone": "9823XXXX05", "status": "available", "active_tickets": 0, "lat": 21.1680, "lng": 79.1100},
    {"id": "WKR-006", "name": "Meena Borkar", "zone": "Hingna", "phone": "9823XXXX06", "status": "available", "active_tickets": 0, "lat": 21.1200, "lng": 79.0400},
    {"id": "WKR-007", "name": "Ravi Thakre", "zone": "Lakadganj", "phone": "9823XXXX07", "status": "available", "active_tickets": 0, "lat": 21.1650, "lng": 79.0950},
    {"id": "WKR-008", "name": "Anita Meshram", "zone": "Gandhibagh", "phone": "9823XXXX08", "status": "available", "active_tickets": 0, "lat": 21.1380, "lng": 79.0920},
]

# Nagpur garbage hotspot locations for simulation
NAGPUR_HOTSPOTS = [
    {"lat": 21.1458, "lng": 79.0882, "address": "Sitabuldi Main Road, Nagpur", "ward": "Ward 15", "zone": "Sitabuldi"},
    {"lat": 21.1520, "lng": 79.0750, "address": "Dharampeth Garden, Nagpur", "ward": "Ward 22", "zone": "Dharampeth"},
    {"lat": 21.1350, "lng": 79.0950, "address": "Cotton Market, Gandhibagh", "ward": "Ward 31", "zone": "Gandhibagh"},
    {"lat": 21.1600, "lng": 79.0850, "address": "Sadar Bazaar, Nagpur", "ward": "Ward 10", "zone": "Sadar"},
    {"lat": 21.1400, "lng": 79.0680, "address": "Law College Square, Civil Lines", "ward": "Ward 18", "zone": "Civil Lines"},
    {"lat": 21.1700, "lng": 79.1100, "address": "Manewada Road, Nagpur", "ward": "Ward 42", "zone": "Manewada"},
    {"lat": 21.1250, "lng": 79.0400, "address": "Hingna MIDC, Nagpur", "ward": "Ward 55", "zone": "Hingna"},
    {"lat": 21.1550, "lng": 79.1000, "address": "Wardhaman Nagar, Nagpur", "ward": "Ward 37", "zone": "Lakadganj"},
    {"lat": 21.1480, "lng": 79.0600, "address": "Seminary Hills, Nagpur", "ward": "Ward 20", "zone": "Civil Lines"},
    {"lat": 21.1320, "lng": 79.0800, "address": "Itwari Railway Station Area", "ward": "Ward 28", "zone": "Gandhibagh"},
    {"lat": 21.1620, "lng": 79.0700, "address": "Ambazari Lake Road", "ward": "Ward 25", "zone": "Dharampeth"},
    {"lat": 21.1380, "lng": 79.1050, "address": "Pardi, Nagpur", "ward": "Ward 33", "zone": "Gandhibagh"},
]

# Collection points for vehicle pickup monitoring
COLLECTION_POINTS = [
    {"id": "CP-001", "name": "Sitabuldi Bus Stand", "lat": 21.1458, "lng": 79.0882, "status": "pending", "zone": "Sitabuldi"},
    {"id": "CP-002", "name": "Dharampeth Colony", "lat": 21.1530, "lng": 79.0760, "status": "collected", "zone": "Dharampeth"},
    {"id": "CP-003", "name": "Cotton Market Gate", "lat": 21.1355, "lng": 79.0945, "status": "missed", "zone": "Gandhibagh"},
    {"id": "CP-004", "name": "Sadar Market", "lat": 21.1605, "lng": 79.0855, "status": "collected", "zone": "Sadar"},
    {"id": "CP-005", "name": "Law College Square", "lat": 21.1405, "lng": 79.0675, "status": "pending", "zone": "Civil Lines"},
    {"id": "CP-006", "name": "Manewada Chowk", "lat": 21.1695, "lng": 79.1105, "status": "collected", "zone": "Manewada"},
    {"id": "CP-007", "name": "Hingna T-Point", "lat": 21.1245, "lng": 79.0405, "status": "pending", "zone": "Hingna"},
    {"id": "CP-008", "name": "Wardhaman Nagar", "lat": 21.1555, "lng": 79.1005, "status": "missed", "zone": "Lakadganj"},
    {"id": "CP-009", "name": "Seminary Hills Gate", "lat": 21.1485, "lng": 79.0605, "status": "collected", "zone": "Civil Lines"},
    {"id": "CP-010", "name": "Itwari Main Road", "lat": 21.1325, "lng": 79.0805, "status": "pending", "zone": "Gandhibagh"},
]

# SLA hours by severity
SLA_HOURS = {"LOW": 8, "MEDIUM": 4, "HIGH": 2, "CRITICAL": 1}

# In-memory stores
tickets = []
alerts = []
notifications = []  # admin notifications


def _haversine(lat1, lng1, lat2, lng2):
    """Distance in meters between two GPS points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _find_nearest_worker(lat, lng):
    """Find the nearest available worker."""
    available = [w for w in WORKERS if w["status"] == "available"]
    if not available:
        available = sorted(WORKERS, key=lambda w: w["active_tickets"])[:3]
    best = min(available, key=lambda w: _haversine(lat, lng, w["lat"], w["lng"]))
    return best


def _find_duplicate_ticket(lat, lng, radius_m=100):
    """Check if there's an open ticket within radius."""
    for t in tickets:
        if t["status"] in ("OPEN", "ASSIGNED"):
            dist = _haversine(lat, lng, t["location"]["lat"], t["location"]["lng"])
            if dist <= radius_m:
                return t
    return None


def create_ticket_from_detection(detection_result):
    """Auto-create a ticket when AI detects garbage."""
    if detection_result.object_count == 0:
        return None

    # Use actual detection location
    lat = getattr(detection_result, 'lat', 21.1458)
    lng = getattr(detection_result, 'lng', 79.0882)
    area = getattr(detection_result, 'area', 'Nagpur Central')
    
    address = f"AI Detection at {area}"

    # De-duplicate: check 100m radius
    existing = _find_duplicate_ticket(lat, lng)
    if existing:
        existing["detection_count"] += 1
        existing["updated_at"] = time.time()
        if detection_result.severity in ("HIGH", "CRITICAL") and existing["severity"] in ("LOW", "MEDIUM"):
            existing["severity"] = detection_result.severity
            existing["priority"] = 1 if detection_result.severity == "CRITICAL" else 2
        return existing

    # Create new ticket
    ticket_id = f"TKT-{datetime.now().strftime('%Y%m%d')}-{len(tickets) + 1:03d}"
    worker = _find_nearest_worker(lat, lng)

    sla = SLA_HOURS.get(detection_result.severity, 4)
    priority_map = {"LOW": 4, "MEDIUM": 3, "HIGH": 2, "CRITICAL": 1}

    ticket = {
        "id": ticket_id,
        "source": "AI_AUTO_DETECTION",
        "location": {
            "lat": lat,
            "lng": lng,
            "address": address,
            "ward": "Dynamic Ward",
            "zone": area,
        },
        "severity": detection_result.severity,
        "priority": priority_map.get(detection_result.severity, 3),
        "status": "OPEN",
        "assigned_worker": {
            "id": worker["id"],
            "name": worker["name"],
            "zone": worker["zone"],
            "phone": worker["phone"],
        },
        "detections": [
            {"class_name": d.class_name, "category": d.category, "confidence": round(d.confidence, 3)}
            for d in detection_result.detections
        ],
        "detection_count": 1,
        "object_count": detection_result.object_count,
        "categories": list(set(d.category for d in detection_result.detections)),
        "snapshot_url": None,
        "created_at": time.time(),
        "updated_at": time.time(),
        "accepted_at": None,
        "resolved_at": None,
        "sla_hours": sla,
    }

    tickets.append(ticket)
    worker["active_tickets"] += 1

    # Create alert for admin
    alert = {
        "id": f"ALT-{len(alerts) + 1:03d}",
        "type": "GARBAGE_DETECTED",
        "severity": detection_result.severity,
        "message": f"Garbage detected at {area} ({detection_result.severity})",
        "ticket_id": ticket_id,
        "location": {"lat": lat, "lng": lng, "address": address, "area": area},
        "timestamp": time.time(),
        "acknowledged": False,
    }
    alerts.append(alert)

    return ticket


def accept_ticket(ticket_id, worker_id):
    """Worker accepts a ticket."""
    ticket = next((t for t in tickets if t["id"] == ticket_id), None)
    if not ticket:
        return None, "Ticket not found"
    if ticket["status"] not in ("OPEN", "ASSIGNED"):
        return None, "Ticket already accepted or resolved"

    ticket["status"] = "IN_PROGRESS"
    ticket["accepted_at"] = time.time()

    # Notification for admin
    worker_name = ticket["assigned_worker"]["name"]
    notif = {
        "id": f"NOT-{len(notifications) + 1:03d}",
        "type": "TICKET_ACCEPTED",
        "message": f"{worker_name} accepted ticket {ticket_id} at {ticket['location']['address']}",
        "ticket_id": ticket_id,
        "worker_id": worker_id,
        "worker_name": worker_name,
        "timestamp": time.time(),
        "read": False,
    }
    notifications.append(notif)

    return ticket, None


def resolve_ticket(ticket_id):
    """Mark ticket as resolved."""
    ticket = next((t for t in tickets if t["id"] == ticket_id), None)
    if not ticket:
        return None, "Ticket not found"

    ticket["status"] = "RESOLVED"
    ticket["resolved_at"] = time.time()

    worker = next((w for w in WORKERS if w["id"] == ticket["assigned_worker"]["id"]), None)
    if worker:
        worker["active_tickets"] = max(0, worker["active_tickets"] - 1)

    notif = {
        "id": f"NOT-{len(notifications) + 1:03d}",
        "type": "TICKET_RESOLVED",
        "message": f"Ticket {ticket_id} resolved at {ticket['location']['address']}",
        "ticket_id": ticket_id,
        "worker_id": ticket["assigned_worker"]["id"],
        "worker_name": ticket["assigned_worker"]["name"],
        "timestamp": time.time(),
        "read": False,
    }
    notifications.append(notif)

    return ticket, None


def get_tickets(status=None):
    if status:
        return [t for t in tickets if t["status"] == status]
    return list(tickets)


def get_alerts(acknowledged=None):
    if acknowledged is not None:
        return [a for a in alerts if a["acknowledged"] == acknowledged]
    return list(alerts)


def get_notifications(unread_only=False):
    if unread_only:
        return [n for n in notifications if not n["read"]]
    return list(notifications)


def mark_notification_read(notif_id):
    notif = next((n for n in notifications if n["id"] == notif_id), None)
    if notif:
        notif["read"] = True
    return notif


def get_workers():
    return list(WORKERS)


def get_worker_tickets(worker_id):
    return [t for t in tickets if t["assigned_worker"]["id"] == worker_id]


def get_collection_points():
    return list(COLLECTION_POINTS)


def get_stats_summary():
    open_count = len([t for t in tickets if t["status"] == "OPEN"])
    assigned_count = len([t for t in tickets if t["status"] == "ASSIGNED"])
    in_progress = len([t for t in tickets if t["status"] == "IN_PROGRESS"])
    resolved_count = len([t for t in tickets if t["status"] == "RESOLVED"])
    active_alerts = len([a for a in alerts if not a["acknowledged"]])
    unread_notifs = len([n for n in notifications if not n["read"]])

    collected = len([cp for cp in COLLECTION_POINTS if cp["status"] == "collected"])
    missed = len([cp for cp in COLLECTION_POINTS if cp["status"] == "missed"])

    return {
        "total_tickets": len(tickets),
        "open_tickets": open_count,
        "assigned_tickets": assigned_count,
        "in_progress_tickets": in_progress,
        "resolved_tickets": resolved_count,
        "active_alerts": active_alerts,
        "unread_notifications": unread_notifs,
        "total_workers": len(WORKERS),
        "available_workers": len([w for w in WORKERS if w["status"] == "available"]),
        "collection_points_total": len(COLLECTION_POINTS),
        "pickups_completed": collected,
        "pickups_missed": missed,
        "pickup_rate": round(collected / len(COLLECTION_POINTS) * 100, 1),
        "garbage_hotspots": len(set(t["location"]["zone"] for t in tickets if t["status"] in ("OPEN", "ASSIGNED", "IN_PROGRESS"))),
    }
