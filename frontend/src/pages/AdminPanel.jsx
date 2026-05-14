import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  fetchAdminStats, fetchTickets, fetchAlerts, fetchNotifications,
  fetchRecentEvents, fetchWorkers, fetchCollectionPoints,
  markNotificationRead, createDetectionWebSocket, getVideoFeedUrl,
  createWorker, updateWorker, deleteWorker, updateCameraLocation
} from '../services/api';
import NagpurMap from '../components/NagpurMap';
import StatsCard from '../components/StatsCard';
import AlertFeed from '../components/AlertFeed';
import TicketBoard from '../components/TicketBoard';
import SeverityChart from '../components/SeverityChart';
import NotificationPanel from '../components/NotificationPanel';
import VideoFeed from '../components/VideoFeed';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '□' },
  { id: 'monitor', label: 'Live Monitor', icon: '◉' },
  { id: 'map', label: 'Garbage Station', icon: '◎' },
  { id: 'tickets', label: 'Tickets', icon: '▤' },
  { id: 'alerts', label: 'Alerts', icon: '△' },
  { id: 'workers', label: 'Workers', icon: '◇' },
];

export default function AdminPanel() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [collectionPoints, setCollectionPoints] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [wsEvents, setWsEvents] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [currentAreaName, setCurrentAreaName] = useState('Nagpur Central');
  const wsRef = useRef(null);

  // Poll data
  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, a, n, e, w, cp] = await Promise.all([
          fetchAdminStats(),
          fetchTickets(),
          fetchAlerts(),
          fetchNotifications(),
          fetchRecentEvents(),
          fetchWorkers(),
          fetchCollectionPoints(),
        ]);
        setStats(s);
        setTickets(t.tickets || []);
        setAlerts(a.alerts || []);
        setNotifications(n.notifications || []);
        setEvents(e.events || []);
        setWorkers(w.workers || []);
        setCollectionPoints(cp.points || []);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket
  useEffect(() => {
    wsRef.current = createDetectionWebSocket((data) => {
      setWsEvents((prev) => [data, ...prev].slice(0, 50));
      if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
        toast.error(`${data.severity} Alert: ${data.object_count} waste objects detected!`, { duration: 5000 });
      }
    });
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // Check for new notifications and toast
  const prevNotifsLen = useRef(0);
  useEffect(() => {
    if (notifications.length > prevNotifsLen.current && prevNotifsLen.current > 0) {
      const latest = notifications[0];
      if (latest && !latest.read) {
        toast.success(latest.message, { duration: 4000 });
      }
    }
    prevNotifsLen.current = notifications.length;
  }, [notifications]);
  
  // Real-time Browser Location Sync
  const syncLocation = () => {
    if ("geolocation" in navigator) {
      toast.loading("Detecting live location...", { id: 'geo-sync', duration: 2000 });
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`[Geo] Syncing live location: ${latitude}, ${longitude}`);
        try {
          const result = await updateCameraLocation(latitude, longitude);
          const areaName = result?.area || 'Nagpur Central';
          setUserLocation([latitude, longitude]);
          setCurrentAreaName(areaName);
          toast.success(`📍 ${areaName}`, { 
            id: 'geo-sync',
            icon: '📍',
            style: { borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' } 
          });
          // Refresh stats to update area name
          const s = await fetchAdminStats();
          setStats(s);
        } catch (err) {
          toast.error("Failed to sync GPS with server", { id: 'geo-sync' });
        }
      }, (err) => {
        toast.error(`GPS Error: ${err.message}`, { id: 'geo-sync' });
      }, { enableHighAccuracy: true, timeout: 10000 });
    }
  };

  useEffect(() => {
    syncLocation();
  }, []);

  const handleManualLocationSync = async (lat, lng) => {
    toast.loading("Pinpointing camera location...", { id: 'geo-sync' });
    try {
      const result = await updateCameraLocation(lat, lng);
      const areaName = result?.area || 'Nagpur Central';
      setUserLocation([lat, lng]);
      setCurrentAreaName(areaName);
      toast.success(`📍 ${areaName}`, { 
        id: 'geo-sync',
        icon: '📍',
        style: { borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' } 
      });
      const s = await fetchAdminStats();
      setStats(s);
    } catch (err) {
      toast.error("Failed to sync location", { id: 'geo-sync' });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="h-screen bg-[#f1f3f5] text-slate-800 flex overflow-hidden">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' },
      }} />

      {/* Mobile Sidebar Overlay */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50 transition-transform duration-300
        ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-4 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-green-100">W</div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 leading-none">Smart Waste</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Nagpur Admin</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 text-xl" onClick={() => setShowMobileMenu(false)}>&times;</button>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShowMobileMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wide transition-all
                ${tab === t.id ? 'bg-green-50 text-green-700 border-r-4 border-green-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span className="text-base opacity-70">{t.icon}</span>
              {t.label}
              {t.id === 'alerts' && alerts.filter(a => !a.acknowledged).length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {alerts.filter(a => !a.acknowledged).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full alert-pulse"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden md:ml-64">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden w-10 h-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-500"
              onClick={() => setShowMobileMenu(true)}
            >
              ☰
            </button>
            <h2 className="text-sm md:text-lg font-black text-slate-800 tracking-tight">{TABS.find(t => t.id === tab)?.label}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={syncLocation}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95"
            >
              <span>📍</span> Sync GPS
            </button>
            {/* Live location name pill */}
            {userLocation && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest truncate max-w-[180px]">{currentAreaName}</span>
              </div>
            )}
            <span className="text-xs text-slate-500">Nagpur Municipal Corporation</span>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <span className="text-lg">&#9881;</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Notification Drawer */}
        {showNotifs && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setShowNotifs(false)}
            onMarkRead={async (id) => {
              await markNotificationRead(id);
              setNotifications(prev => prev.map(n => n.id === id ? {...n, read: true} : n));
            }}
          />
        )}

        <div className="flex-1 p-6 md:p-8 overflow-hidden h-full">
          <div className="max-w-[1600px] mx-auto h-full">
            {!stats ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Initializing Dashboard...</p>
                </div>
              </div>
            ) : (
              <>
                {tab === 'overview' && <div className="h-full overflow-y-auto pr-2"><OverviewTab stats={stats} tickets={tickets} events={wsEvents.length > 0 ? wsEvents : events} alerts={alerts} userLocation={userLocation} currentAreaName={currentAreaName} onLocationSelect={handleManualLocationSync} /></div>}
                {tab === 'monitor' && <div className="h-full overflow-y-auto pr-2"><MonitorTab events={wsEvents.length > 0 ? wsEvents : events} currentAreaName={currentAreaName} /></div>}
                {tab === 'map' && <MapTab tickets={tickets} collectionPoints={collectionPoints} workers={workers} liveDetections={wsEvents.filter(e => (Date.now() / 1000 - e.timestamp) < 30)} userLocation={userLocation} onLocationSelect={handleManualLocationSync} />}
                {tab === 'tickets' && <TicketsTab tickets={tickets} setTickets={setTickets} readOnly={true} />}
                {tab === 'alerts' && <AlertsTab alerts={alerts} />}
                {tab === 'workers' && <div className="h-full overflow-y-auto pr-2"><WorkersTab workers={workers} setWorkers={setWorkers} tickets={tickets} /></div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ──
function OverviewTab({ stats, tickets, events, alerts, userLocation, onLocationSelect }) {
  if (!stats) return <div className="text-gray-500">Loading...</div>;

  const recentTickets = [...tickets].sort((a, b) => b.created_at - a.created_at).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatsCard title="Total Tickets" value={stats.total_tickets} subtitle="Auto-generated" color="blue" />
        <StatsCard title="Open Tickets" value={stats.open_tickets + stats.assigned_tickets} subtitle="Needs attention" color="orange" />
        <StatsCard title="In Progress" value={stats.in_progress_tickets} subtitle="Workers active" color="green" />
        <StatsCard title="Resolved" value={stats.resolved_tickets} subtitle="Cleaned up" color="purple" />
        <StatsCard title="Pickup Rate" value={`${stats.pickup_rate}%`} subtitle={`${stats.pickups_completed}/${stats.collection_points_total}`} color="green" />
        <StatsCard title="Active Alerts" value={stats.active_alerts} subtitle="Unacknowledged" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Map */}
        <div className="lg:col-span-2 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200" style={{ height: '400px' }}>
          <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Nagpur - Live Garbage Hotspots</h3>
            <span className="text-xs text-slate-500">{tickets.filter(t => t.status !== 'RESOLVED').length} active incidents</span>
          </div>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <NagpurMap 
              tickets={tickets} 
              liveDetections={events.filter(e => (Date.now() / 1000 - e.timestamp) < 30)}
              showWorkers={false} 
              height="100%" 
              center={userLocation}
              userLocation={userLocation}
              onLocationSelect={onLocationSelect}
            />
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <AlertFeed events={events.slice(0, 15)} />
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="text-sm font-semibold mb-3 text-slate-800">Recent Auto-Generated Tickets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="text-left py-2 px-3">ID</th>
                <th className="text-left py-2 px-3">Location</th>
                <th className="text-left py-2 px-3">Severity</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Worker</th>
                <th className="text-left py-2 px-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-xs text-slate-600">{t.id}</td>
                  <td className="py-2 px-3 text-xs text-slate-600">{t.location.address}</td>
                  <td className="py-2 px-3">
                    <SeverityBadge severity={t.severity} />
                  </td>
                  <td className="py-2 px-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2 px-3 text-xs text-slate-600">{t.assigned_worker?.name}</td>
                  <td className="py-2 px-3 text-xs text-slate-500">{new Date(t.created_at * 1000).toLocaleTimeString()}</td>
                </tr>
              ))}
              {recentTickets.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">No tickets yet — AI will auto-generate when garbage is detected</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Live Monitor Tab ──
function MonitorTab({ events, currentAreaName }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VideoFeed />
        </div>
        <div>
          <AlertFeed events={events} currentAreaName={currentAreaName} />
        </div>
      </div>
    </div>
  );
}

// ── Garbage Station Tab ──
function MapTab({ tickets, collectionPoints, workers, liveDetections, userLocation, onLocationSelect }) {
  const [viewType, setViewType] = useState('stations'); // 'stations' or 'hotspots'
  const [selectedStation, setSelectedStation] = useState(null);
  const [trucks, setTrucks] = useState([]);
  
  // Station coordinates (must match NagpurMap STATIONS)
  const stationCoords = {
    1: [21.1167, 79.0667], 2: [21.1417, 79.0667], 3: [21.1230, 79.0980],
    4: [21.1400, 79.0850], 5: [21.1200, 79.1150], 6: [21.1550, 79.1000],
    7: [21.1650, 79.1100], 8: [21.1550, 79.1300], 9: [21.1850, 79.1150],
    10: [21.1750, 79.0800],
  };

  const zones = [
    { id: 1, name: "Laxmi Nagar", contractor: "AG Enviro", load: "140 MT", features: "Electric Fleet" },
    { id: 2, name: "Dharampeth", contractor: "AG Enviro", load: "145 MT", features: "Secondary Compactor" },
    { id: 3, name: "Hanuman Nagar", contractor: "AG Enviro", load: "135 MT", features: "Smart Sensor" },
    { id: 4, name: "Dhantoli", contractor: "AG Enviro", load: "124.47 MT", features: "Lowest Waste Zone", highlight: true },
    { id: 5, name: "Nehru Nagar", contractor: "AG Enviro", load: "138 MT", features: "Active Monitoring" },
    { id: 6, name: "Gandhi Mahal", contractor: "BVG India", load: "151.64 MT", features: "Transfer Station" },
    { id: 7, name: "Satranjipura", contractor: "BVG India", load: "127.95 MT", features: "Manual Collection" },
    { id: 8, name: "Lakadganj", contractor: "BVG India", load: "182.7 MT", features: "Highest Waste Zone", highlight: true },
    { id: 9, name: "Ashi Nagar", contractor: "BVG India", load: "167.83 MT", features: "Rapid Response" },
    { id: 10, name: "Mangalwari", contractor: "BVG India", load: "142 MT", features: "EV Ready" },
  ];

  const truckStats = [
    { type: "Auto Tippers", active: 242, total: 260 },
    { type: "Tata 407 Trucks", active: 45, total: 50 },
    { type: "Electric Vehicles", active: 20, total: 20 },
    { type: "Heavy Tippers", active: 12, total: 15 },
  ];

  // Demo truck definitions — spread across all 10 zones
  const truckDefs = useRef([
    { id: 'AT-001', zone: 1, type: 'auto', typeName: 'Auto Tipper', color: '#f59e0b', speed: 18 },
    { id: 'AT-002', zone: 2, type: 'auto', typeName: 'Auto Tipper', color: '#f59e0b', speed: 15 },
    { id: 'AT-003', zone: 3, type: 'auto', typeName: 'Auto Tipper', color: '#f59e0b', speed: 20 },
    { id: 'AT-004', zone: 5, type: 'auto', typeName: 'Auto Tipper', color: '#f59e0b', speed: 16 },
    { id: 'AT-005', zone: 7, type: 'auto', typeName: 'Auto Tipper', color: '#f59e0b', speed: 22 },
    { id: 'AT-006', zone: 9, type: 'auto', typeName: 'Auto Tipper', color: '#f59e0b', speed: 19 },
    { id: 'T4-001', zone: 4, type: 'auto', typeName: 'Tata 407', color: '#3b82f6', speed: 25 },
    { id: 'T4-002', zone: 6, type: 'auto', typeName: 'Tata 407', color: '#3b82f6', speed: 22 },
    { id: 'T4-003', zone: 8, type: 'auto', typeName: 'Tata 407', color: '#3b82f6', speed: 28 },
    { id: 'T4-004', zone: 10, type: 'auto', typeName: 'Tata 407', color: '#3b82f6', speed: 24 },
    { id: 'EV-001', zone: 1, type: 'ev', typeName: 'Electric Vehicle', color: '#10b981', speed: 30 },
    { id: 'EV-002', zone: 4, type: 'ev', typeName: 'Electric Vehicle', color: '#10b981', speed: 28 },
    { id: 'EV-003', zone: 10, type: 'ev', typeName: 'Electric Vehicle', color: '#10b981', speed: 32 },
    { id: 'HT-001', zone: 8, type: 'heavy', typeName: 'Heavy Tipper', color: '#8b5cf6', speed: 12 },
    { id: 'HT-002', zone: 6, type: 'heavy', typeName: 'Heavy Tipper', color: '#8b5cf6', speed: 10 },
  ]).current;

  // Track truck angles for circular movement
  const truckAngles = useRef(truckDefs.map(() => Math.random() * Math.PI * 2));

  // Animate trucks around their zone station centers
  useEffect(() => {
    const interval = setInterval(() => {
      truckAngles.current = truckAngles.current.map((angle, i) => {
        // Each truck moves at its own angular speed
        const speedFactor = 0.03 + (truckDefs[i].speed / 1000);
        return angle + speedFactor;
      });

      setTrucks(truckDefs.map((def, i) => {
        const center = stationCoords[def.zone];
        const angle = truckAngles.current[i];
        // Orbit radius ~0.004-0.008 degrees (~400-800m) with some variation
        const radius = 0.004 + (i % 5) * 0.001;
        return {
          ...def,
          label: `${def.typeName} ${def.id}`,
          lat: center[0] + Math.sin(angle) * radius,
          lng: center[1] + Math.cos(angle) * radius * 1.3,
          status: 'On Route',
        };
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Filter trucks for display — show all, or only the selected zone
  const visibleTrucks = selectedStation
    ? trucks.filter(t => t.zone === selectedStation)
    : trucks;

  const handleStationClick = (zoneId) => {
    setSelectedStation(prev => prev === zoneId ? null : zoneId);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Map Side */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex gap-4 flex-wrap text-[10px] font-medium uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Garbage Hotspot</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Station (Active)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Auto Tipper</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Tata 407</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Electric</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span> Heavy Tipper</span>
        </div>
        
        <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative">
          <NagpurMap
            tickets={tickets}
            collectionPoints={collectionPoints}
            workers={workers}
            liveDetections={liveDetections}
            showWorkers={true}
            height="100%"
            viewType={viewType}
            center={userLocation}
            onLocationSelect={onLocationSelect}
            selectedStation={selectedStation}
            trucks={visibleTrucks}
          />
          {/* Active zone overlay badge */}
          {selectedStation && (
            <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm border border-emerald-200 rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Zone {selectedStation} — {zones.find(z => z.id === selectedStation)?.name}
              </span>
              <span className="text-[9px] text-slate-400 ml-1">
                {visibleTrucks.length} trucks active
              </span>
              <button
                onClick={() => setSelectedStation(null)}
                className="text-slate-400 hover:text-red-500 transition-colors ml-1 text-sm"
              >×</button>
            </div>
          )}
        </div>

        {/* Truck Footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          {truckStats.map(s => (
            <div key={s.type} className="text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">{s.type}</p>
              <p className="text-xl font-bold text-slate-800">{s.active}<span className="text-xs text-slate-300 ml-1">/ {s.total}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Toggle Switch */}
        <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex">
          <button 
            onClick={() => setViewType('stations')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewType === 'stations' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Stations
          </button>
          <button 
            onClick={() => setViewType('hotspots')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewType === 'hotspots' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Hotspots
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Station Directory</h3>
            <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">
              {selectedStation ? `Zone ${selectedStation} Selected — Click to deselect` : 'Click a zone to see its coverage area'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {zones.map(z => {
              const isSelected = selectedStation === z.id;
              const zoneTruckCount = trucks.filter(t => t.zone === z.id).length;
              return (
                <div 
                  key={z.id} 
                  onClick={() => handleStationClick(z.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-md' 
                      : z.highlight 
                        ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900/5 hover:shadow-md' 
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-xs font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                      {z.name} <span className="text-[9px] text-slate-400 ml-1">Zone {z.id}</span>
                    </h4>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${z.contractor === 'AG Enviro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {z.contractor}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">{z.features}</span>
                    <span className="font-bold text-slate-700">{z.load}</span>
                  </div>
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Coverage Active
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold">
                        {zoneTruckCount} truck{zoneTruckCount !== 1 ? 's' : ''} deployed
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500 italic">Target: 150 MT capacity/station with solar hoppers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tickets Tab ──
function TicketsTab({ tickets, setTickets, readOnly }) {
  return <TicketBoard tickets={tickets} setTickets={setTickets} readOnly={readOnly} />;
}

// ── Alerts Tab ──
function AlertsTab({ alerts, onAcknowledge }) {
  const [filter, setFilter] = useState('ALL');
  
  const stats = {
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => a.severity === 'HIGH').length,
    MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
    LOW: alerts.filter(a => a.severity === 'LOW').length,
  };

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter);
  const sorted = [...filtered].sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4) || b.timestamp - a.timestamp;
  });

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Alert Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0 w-full">
        {[
          { label: 'Critical', count: stats.CRITICAL, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100', id: 'CRITICAL' },
          { label: 'High', count: stats.HIGH, color: 'text-red-500', bg: 'bg-red-50/50', border: 'border-red-100/50', id: 'HIGH' },
          { label: 'Medium', count: stats.MEDIUM, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100', id: 'MEDIUM' },
          { label: 'Low', count: stats.LOW, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', id: 'LOW' },
        ].map(s => (
          <button 
            key={s.label}
            onClick={() => setFilter(filter === s.id ? 'ALL' : s.id)}
            className={`p-3 rounded-xl border transition-all text-left group ${s.bg} ${s.border} ${filter === s.id ? 'ring-2 ring-slate-900 shadow-md' : 'hover:shadow-sm'} min-w-0`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-[9px] font-black uppercase tracking-widest ${s.color} mb-0.5 truncate`}>{s.label}</p>
                <p className="text-xl font-black text-slate-900 leading-none">{s.count}</p>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity ${s.bg} border ${s.border} flex-shrink-0`}>
                {s.id === 'CRITICAL' && '⚡'}
                {s.id === 'HIGH' && '🔥'}
                {s.id === 'MEDIUM' && '🔔'}
                {s.id === 'LOW' && 'ℹ️'}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-base font-black text-slate-800 tracking-tight">Active Incident Log</h3>
          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">{filtered.length} Results</span>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
          {['ALL', 'CRITICAL', 'HIGH'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-all ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 border-dashed p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-2xl mb-4 grayscale">🛡️</div>
          <p className="text-sm font-bold text-slate-800">Clear Skies</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">No alerts matching your current filter</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {sorted.map(a => (
            <div key={a.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden flex">
              <div className={`w-1.5 flex-shrink-0 ${
                a.severity === 'CRITICAL' ? 'bg-red-700' :
                a.severity === 'HIGH' ? 'bg-red-500' :
                a.severity === 'MEDIUM' ? 'bg-orange-500' : 'bg-yellow-500'
              }`}></div>
              <div className="flex-1 p-5 flex items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${
                    a.severity === 'CRITICAL' ? 'bg-red-50' : 'bg-slate-50'
                  }`}>
                    {a.type === 'GARBAGE_DETECTED' ? '🗑️' : '⚠️'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                        a.severity === 'CRITICAL' ? 'bg-red-700 text-white' :
                        a.severity === 'HIGH' ? 'bg-red-500 text-white' :
                        a.severity === 'MEDIUM' ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-slate-900'
                      }`}>{a.severity}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(a.timestamp * 1000).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 leading-snug">{a.message}</p>
                    {a.ticket_id && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ticket: {a.ticket_id}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-[10px] font-bold text-slate-400">Automatic AI Generation</span>
                      </div>
                    )}
                  </div>
                </div>
                {!a.acknowledged && (
                  <button 
                    className="flex-shrink-0 px-4 py-2 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Workers Tab ──
function WorkersTab({ workers, setWorkers, tickets }) {
  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);

  const handleSave = async (workerData) => {
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, workerData);
        setWorkers(prev => prev.map(w => w.id === editingWorker.id ? { ...w, ...workerData } : w));
        toast.success('Worker updated successfully');
      } else {
        const newWorker = await createWorker(workerData);
        setWorkers(prev => [...prev, newWorker]);
        toast.success('New worker added');
      }
      setShowModal(false);
      setEditingWorker(null);
    } catch (err) {
      toast.error('Failed to save worker');
    }
  };

  const handleDelete = async (workerId) => {
    if (!window.confirm('Are you sure you want to delete this worker account?')) return;
    try {
      await deleteWorker(workerId);
      setWorkers(prev => prev.filter(w => w.id !== workerId));
      toast.success('Worker deleted');
    } catch (err) {
      toast.error('Failed to delete worker');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-base font-black text-slate-800 tracking-tight">Personnel Directory</h3>
          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">{workers.length} Total</span>
        </div>
        <button 
          onClick={() => { setEditingWorker(null); setShowModal(true); }}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-100"
        >
          Add New Worker
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {workers.map(w => {
          const wTickets = tickets.filter(t => t.assigned_worker?.id === w.id);
          const active = wTickets.filter(t => t.status !== 'RESOLVED');
          const resolved = wTickets.filter(t => t.status === 'RESOLVED');
          return (
            <div key={w.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden flex flex-col aspect-square">
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center text-xs font-black shadow-sm flex-shrink-0">
                      {w.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-900 leading-none truncate">{w.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase tracking-tighter truncate">{w.id}</p>
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'} shadow-sm`}></span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 text-center">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Active</p>
                    <p className="text-xs font-black text-orange-600">{active.length}</p>
                  </div>
                  <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 text-center">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Done</p>
                    <p className="text-xs font-black text-green-600">{resolved.length}</p>
                  </div>
                </div>

                <div className="space-y-1 mt-auto pt-2 border-t border-slate-50">
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <span className="text-slate-400 uppercase tracking-widest">Zone</span>
                    <span className="text-slate-800 truncate ml-2">{w.zone?.split('(')[0]}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold">
                    <span className="text-slate-400 uppercase tracking-widest">Phone</span>
                    <span className="text-slate-800">{w.phone}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex gap-2 flex-shrink-0">
                <button 
                  onClick={() => { setEditingWorker(w); setShowModal(true); }}
                  className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(w.id)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 hover:border-red-200 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <WorkerModal 
          worker={editingWorker} 
          onClose={() => { setShowModal(false); setEditingWorker(null); }} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
}

function WorkerModal({ worker, onClose, onSave }) {
  const [formData, setFormData] = useState(worker || {
    name: '',
    id: '',
    zone: 'Laxmi Nagar (Zone 1)',
    phone: '',
    status: 'available'
  });

  const ZONES = [
    'Laxmi Nagar (Zone 1)', 'Dharampeth (Zone 2)', 'Hanuman Nagar (Zone 3)', 
    'Dhantoli (Zone 4)', 'Nehru Nagar (Zone 5)', 'Gandhi Mahal (Zone 6)', 
    'Satranjipura (Zone 7)', 'Lakadganj (Zone 8)', 'Ashi Nagar (Zone 9)', 
    'Mangalwari (Zone 10)'
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-900"></div>
        <div className="mb-8">
          <h3 className="text-2xl font-black text-slate-900 leading-none">{worker ? 'Edit Profile' : 'New Personnel'}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Field Operations Access Control</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Rahul Sharma"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Worker ID</label>
              <input 
                type="text" 
                disabled={!!worker}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all ${worker ? 'opacity-50' : ''}`}
                value={formData.id}
                onChange={e => setFormData({...formData, id: e.target.value})}
                placeholder="WKR-000"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone</label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="98XXXXXXXX"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Operational Zone</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all appearance-none"
              value={formData.zone}
              onChange={e => setFormData({...formData, zone: e.target.value})}
            >
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-100"
          >
            Save Record
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ──
function SeverityBadge({ severity }) {
  const colors = {
    LOW: 'bg-yellow-500/20 text-yellow-400',
    MEDIUM: 'bg-orange-500/20 text-orange-400',
    HIGH: 'bg-red-500/20 text-red-400',
    CRITICAL: 'bg-red-700/20 text-red-300',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[severity] || 'bg-gray-600 text-gray-300'}`}>{severity}</span>;
}

function StatusBadge({ status }) {
  const colors = {
    OPEN: 'bg-blue-500/20 text-blue-400',
    ASSIGNED: 'bg-purple-500/20 text-purple-400',
    IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400',
    RESOLVED: 'bg-green-500/20 text-green-400',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-600 text-gray-300'}`}>{status}</span>;
}
