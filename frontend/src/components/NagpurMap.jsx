import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Nagpur center coordinates
const NAGPUR_CENTER = [21.1458, 79.0882];
const DEFAULT_ZOOM = 13;

// Custom marker icons
function createIcon(color, size = 12) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px; height: ${size}px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 0 6px ${color}80;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createTicketIcon(severity) {
  const colors = { LOW: '#facc15', MEDIUM: '#f97316', HIGH: '#ef4444', CRITICAL: '#dc2626' };
  const color = colors[severity] || '#ef4444';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 22px; height: 22px;
      background: ${color};
      border: 2px solid white;
      border-radius: 4px;
      box-shadow: 0 0 8px ${color}80;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: bold; color: white;
    ">!</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function createWorkerIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 18px; height: 18px;
      background: #3b82f6;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 0 8px #3b82f680;
      display: flex; align-items: center; justify-content: center;
      font-size: 8px; color: white; font-weight: bold;
    ">W</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const cpStatusColors = { collected: '#22c55e', pending: '#facc15', missed: '#ef4444' };

export default function NagpurMap({
  tickets = [],
  collectionPoints = [],
  workers = [],
  showWorkers = false,
  height = '100%',
}) {
  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED');

  return (
    <MapContainer
      center={NAGPUR_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height, width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Garbage Hotspot Tickets */}
      {activeTickets.map((t, i) => (
        <React.Fragment key={`ticket-${t.id}`}>
          <Marker
            position={[t.location.lat, t.location.lng]}
            icon={createTicketIcon(t.severity)}
          >
            <Popup>
              <div style={{ minWidth: 200, color: '#111' }}>
                <strong style={{ fontSize: 13 }}>{t.id}</strong>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  <div><strong>Location:</strong> {t.location.address}</div>
                  <div><strong>Severity:</strong> <span style={{ color: t.severity === 'CRITICAL' ? '#dc2626' : t.severity === 'HIGH' ? '#ef4444' : '#f97316' }}>{t.severity}</span></div>
                  <div><strong>Status:</strong> {t.status}</div>
                  <div><strong>Objects:</strong> {t.object_count}</div>
                  <div><strong>Worker:</strong> {t.assigned_worker?.name}</div>
                  <div><strong>Zone:</strong> {t.location.zone}</div>
                  <div style={{ marginTop: 4 }}>
                    {t.categories?.map((c, j) => (
                      <span key={j} style={{
                        display: 'inline-block', background: '#e5e7eb', borderRadius: 4,
                        padding: '1px 6px', fontSize: 10, marginRight: 4, marginBottom: 2
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
          {/* Hotspot radius circle */}
          <Circle
            center={[t.location.lat, t.location.lng]}
            radius={100}
            pathOptions={{
              color: t.severity === 'CRITICAL' ? '#dc2626' : t.severity === 'HIGH' ? '#ef4444' : '#f97316',
              fillOpacity: 0.1,
              weight: 1,
            }}
          />
        </React.Fragment>
      ))}

      {/* Collection Points */}
      {collectionPoints.map((cp, i) => (
        <Marker
          key={`cp-${cp.id}`}
          position={[cp.lat, cp.lng]}
          icon={createIcon(cpStatusColors[cp.status] || '#9ca3af', 10)}
        >
          <Popup>
            <div style={{ minWidth: 160, color: '#111' }}>
              <strong style={{ fontSize: 12 }}>{cp.name}</strong>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                <div><strong>Status:</strong> <span style={{ color: cpStatusColors[cp.status] }}>{cp.status.toUpperCase()}</span></div>
                <div><strong>Zone:</strong> {cp.zone}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Workers */}
      {showWorkers && workers.map((w, i) => (
        <Marker
          key={`worker-${w.id}`}
          position={[w.lat, w.lng]}
          icon={createWorkerIcon()}
        >
          <Popup>
            <div style={{ minWidth: 150, color: '#111' }}>
              <strong style={{ fontSize: 12 }}>{w.name}</strong>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                <div><strong>Zone:</strong> {w.zone}</div>
                <div><strong>Status:</strong> {w.status}</div>
                <div><strong>Active Tickets:</strong> {w.active_tickets}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
