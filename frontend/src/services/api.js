const API_BASE = '/api';

// ── Detection ──
export async function fetchLatestDetection() {
  const res = await fetch(`${API_BASE}/detection/latest`);
  return res.json();
}

export async function fetchCameraStatus() {
  const res = await fetch(`${API_BASE}/detection/status`);
  return res.json();
}

export async function updateCameraSource(source) {
  const res = await fetch(`${API_BASE}/detection/source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  return res.json();
}

export function getVideoFeedUrl() {
  return `${API_BASE}/detection/video-feed`;
}

// ── Dashboard Stats ──
export async function fetchStats() {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  return res.json();
}

export async function fetchAdminStats() {
  const res = await fetch(`${API_BASE}/admin/stats`);
  return res.json();
}

export async function fetchRecentEvents() {
  const res = await fetch(`${API_BASE}/dashboard/recent-events`);
  return res.json();
}

// ── Tickets ──
export async function fetchTickets(status) {
  const url = status ? `${API_BASE}/tickets?status=${status}` : `${API_BASE}/tickets`;
  const res = await fetch(url);
  return res.json();
}

export async function acceptTicket(ticketId, workerId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/accept?worker_id=${workerId}`, {
    method: 'POST',
  });
  return res.json();
}

export async function resolveTicket(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/resolve`, { method: 'POST' });
  return res.json();
}

// ── Alerts & Notifications ──
export async function fetchAlerts() {
  const res = await fetch(`${API_BASE}/alerts`);
  return res.json();
}

export async function fetchNotifications(unread = false) {
  const res = await fetch(`${API_BASE}/notifications?unread=${unread}`);
  return res.json();
}

export async function markNotificationRead(notifId) {
  const res = await fetch(`${API_BASE}/notifications/${notifId}/read`, { method: 'POST' });
  return res.json();
}

// ── Workers ──
export async function fetchWorkers() {
  const res = await fetch(`${API_BASE}/workers`);
  return res.json();
}

export async function fetchWorkerTickets(workerId) {
  const res = await fetch(`${API_BASE}/workers/${workerId}/tickets`);
  return res.json();
}

// ── Map Data ──
export async function fetchCollectionPoints() {
  const res = await fetch(`${API_BASE}/collection-points`);
  return res.json();
}

export async function fetchHotspots() {
  const res = await fetch(`${API_BASE}/hotspots`);
  return res.json();
}

// ── WebSocket ──
export function createDetectionWebSocket(onMessage) {
  const wsUrl = `ws://${window.location.hostname}:8000/api/detection/ws/events`;
  let ws = null;
  let cancelled = false;

  function connect() {
    if (cancelled) return;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('[WS] Connected');
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => { if (!cancelled) setTimeout(connect, 3000); };
    ws.onerror = (err) => console.error('[WS] Error:', err);
  }

  connect();
  return { close: () => { cancelled = true; if (ws) ws.close(); } };
}
