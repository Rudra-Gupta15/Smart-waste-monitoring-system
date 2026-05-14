import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
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

function createStationIcon(isSelected = false) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${isSelected ? 30 : 24}px; height: ${isSelected ? 30 : 24}px;
      background: ${isSelected ? '#059669' : '#10b981'};
      border: ${isSelected ? '3px solid #d1fae5' : '2px solid white'};
      border-radius: 6px;
      box-shadow: 0 0 ${isSelected ? '16px #05966980' : '10px #10b98180'};
      display: flex; align-items: center; justify-content: center;
      font-size: ${isSelected ? 14 : 12}px; color: white;
    ">🏛</div>`,
    iconSize: [isSelected ? 30 : 24, isSelected ? 30 : 24],
    iconAnchor: [isSelected ? 15 : 12, isSelected ? 15 : 12],
  });
}

function createTruckIcon(color, type) {
  const emoji = type === 'ev' ? '⚡' : type === 'heavy' ? '🚚' : '🚛';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px; height: 28px;
      background: ${color};
      border: 2px solid white;
      border-radius: 8px;
      box-shadow: 0 2px 10px ${color}70;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    ">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createLiveIcon(severity) {
  const colors = { LOW: '#facc15', MEDIUM: '#f97316', HIGH: '#ef4444', CRITICAL: '#dc2626' };
  const color = colors[severity] || '#ef4444';
  return L.divIcon({
    className: '',
    html: `
      <div class="live-marker">
        <div class="pulse" style="background: ${color}"></div>
        <div class="dot" style="background: ${color}"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Global pulse animation for live markers
const MapStyles = () => (
  <style>{`
    .live-marker { position: relative; width: 24px; height: 24px; }
    .dot { 
      position: absolute; top: 50%; left: 50%; 
      transform: translate(-50%, -50%); 
      width: 14px; height: 14px; 
      border-radius: 50%; border: 3px solid white;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      z-index: 2;
    }
    .pulse {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 24px; height: 24px;
      border-radius: 50%;
      animation: marker-pulse 2s infinite ease-out;
      opacity: 0.6;
      z-index: 1;
    }
    @keyframes marker-pulse {
      0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
    }
    .user-marker { position: relative; width: 20px; height: 20px; }
    .user-dot {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 12px; height: 12px;
      background: #3b82f6; border: 2px solid white;
      border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
      z-index: 10;
    }
    .user-pulse {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 12px; height: 12px;
      background: rgba(59, 130, 246, 0.4);
      border-radius: 50%;
      animation: user-pulse 2s infinite;
      z-index: 9;
    }
    @keyframes user-pulse {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
    }
  `}</style>
);

const cpStatusColors = { collected: '#22c55e', pending: '#facc15', missed: '#ef4444' };

function ChangeView({ center }) {
  const map = useMap();
  const prevCenter = useRef(null);

  useEffect(() => {
    if (!center) return;
    const [lat, lng] = center;
    const prev = prevCenter.current;
    // Only fly if the coordinates actually changed
    if (!prev || Math.abs(prev[0] - lat) > 0.00001 || Math.abs(prev[1] - lng) > 0.00001) {
      prevCenter.current = center;
      map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
    }
  }, [center, map]);

  return null;
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      if (onLocationSelect) onLocationSelect(lat, lng);
    },
  });
  return null;
}

// User location icon (blue dot)
function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div class="user-marker">
        <div class="user-pulse"></div>
        <div class="user-dot"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function NagpurMap({
  tickets = [],
  collectionPoints = [],
  workers = [],
  liveDetections = [],
  showWorkers = false,
  height = '100%',
  viewType = 'stations',
  center = null,
  userLocation = null,
  onLocationSelect = null,
  selectedStation = null,
  trucks = [],
}) {
  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED');

  const STATIONS = [
    { id: 1, name: "Laxmi Nagar Station",   pos: [21.1167, 79.0667], zone: 1,  cap: "150 MT" },
    { id: 2, name: "Dharampeth Station",     pos: [21.1417, 79.0667], zone: 2,  cap: "150 MT" },
    { id: 3, name: "Hanuman Nagar Station",  pos: [21.1230, 79.0980], zone: 3,  cap: "150 MT" },
    { id: 4, name: "Dhantoli Station",       pos: [21.1400, 79.0850], zone: 4,  cap: "150 MT" },
    { id: 5, name: "Nehru Nagar Station",    pos: [21.1200, 79.1150], zone: 5,  cap: "150 MT" },
    { id: 6, name: "Gandhi Mahal Station",   pos: [21.1550, 79.1000], zone: 6,  cap: "150 MT" },
    { id: 7, name: "Satranjipura Station",   pos: [21.1650, 79.1100], zone: 7,  cap: "150 MT" },
    { id: 8, name: "Lakadganj Station",      pos: [21.1550, 79.1300], zone: 8,  cap: "150 MT" },
    { id: 9, name: "Ashi Nagar Station",     pos: [21.1850, 79.1150], zone: 9,  cap: "150 MT" },
    { id: 10, name: "Mangalwari Station",    pos: [21.1750, 79.0800], zone: 10, cap: "150 MT" },
  ];

  return (
    <>
      <MapStyles />
      <MapContainer
      center={NAGPUR_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height, width: '100%' }}
      zoomControl={true}
    >
      <ChangeView center={center} />
      <MapClickHandler onLocationSelect={onLocationSelect} />
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Garbage Hotspot Tickets */}
      {(viewType === 'hotspots' || !viewType) && activeTickets.map((t, i) => (
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
            radius={150}
            pathOptions={{
              color: t.severity === 'CRITICAL' ? '#dc2626' : t.severity === 'HIGH' ? '#ef4444' : '#f97316',
              fillOpacity: 0.1,
              weight: 1,
            }}
          />
        </React.Fragment>
      ))}

      {/* Garbage Stations */}
      {(viewType === 'stations' || !viewType) && STATIONS.map(s => (
        <React.Fragment key={`station-${s.id}`}>
          <Marker position={s.pos} icon={createStationIcon(selectedStation === s.id)}>
            <Popup>
              <div style={{ minWidth: 160, color: '#111' }}>
                <strong style={{ fontSize: 13 }}>{s.name}</strong>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  <div><strong>Zone:</strong> {s.zone}</div>
                  <div><strong>Capacity:</strong> {s.cap}</div>
                  <div><strong>Tech:</strong> Solar Hoppers</div>
                  <div style={{ color: '#10b981', fontWeight: 'bold', marginTop: 2 }}>✓ Smart City Active</div>
                </div>
              </div>
            </Popup>
          </Marker>
          {/* Coverage area circle for selected station */}
          {selectedStation === s.id && (
            <Circle
              center={s.pos}
              radius={1200}
              pathOptions={{
                color: '#059669',
                fillColor: '#10b981',
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '8 6',
              }}
            />
          )}
        </React.Fragment>
      ))}

      {/* Selected station auto-pan */}
      {selectedStation && (
        <ChangeView center={STATIONS.find(s => s.id === selectedStation)?.pos} />
      )}

      {/* Fleet Trucks */}
      {trucks.map(truck => (
        <Marker
          key={`truck-${truck.id}`}
          position={[truck.lat, truck.lng]}
          icon={createTruckIcon(truck.color, truck.type)}
        >
          <Popup>
            <div style={{ minWidth: 160, color: '#111' }}>
              <strong style={{ fontSize: 12 }}>{truck.label}</strong>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                <div><strong>Type:</strong> {truck.typeName}</div>
                <div><strong>Zone:</strong> {truck.zone}</div>
                <div><strong>Status:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{truck.status}</span></div>
                <div><strong>Speed:</strong> {truck.speed} km/h</div>
              </div>
            </div>
          </Popup>
        </Marker>
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

      {/* Current User Location (Blue Dot) */}
      {userLocation && (
        <Marker position={userLocation} icon={createUserIcon()}>
          <Popup>
            <div className="text-xs font-bold text-slate-800">Your Live Location</div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
    </>
  );
}
