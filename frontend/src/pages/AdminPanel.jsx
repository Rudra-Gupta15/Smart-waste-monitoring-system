import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  fetchAdminStats, fetchTickets, fetchAlerts, fetchNotifications,
  fetchRecentEvents, fetchWorkers, fetchCollectionPoints,
  markNotificationRead, createDetectionWebSocket, getVideoFeedUrl,
  createWorker, updateWorker, deleteWorker, updateCameraLocation,
  acknowledgeAlert,
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
  { id: 'monitor', label: 'Live Monitor', icon: '◎' },
  { id: 'map', label: 'Garbage Station', icon: '◉' },
  { id: 'tickets', label: 'Tickets', icon: '▤' },
  { id: 'alerts', label: 'Alerts', icon: '△' },
  { id: 'workers', label: 'Workers', icon: '◇' },
];

const HOTSPOTS_LIST = [
  { "id": 1, "area": "Bhandewadi Dump Yard", "zone": "Lakadganj", "risk": "Extreme", "pos": [21.1975, 79.0779] },
  { "id": 2, "area": "Wadi Flyover Service Road", "zone": "Dharampeth", "risk": "High", "pos": [21.1992, 79.0936] },
  { "id": 3, "area": "Sitabuldi Shani Mandir Road", "zone": "Dharampeth", "risk": "High", "pos": [21.1103, 79.0396] },
  { "id": 4, "area": "Ganesh Nagar", "zone": "Hanuman Nagar", "risk": "Medium", "pos": [21.0951, 79.0499] },
  { "id": 5, "area": "Sakkardara Market Area", "zone": "Hanuman Nagar", "risk": "High", "pos": [21.1302, 79.0331] },
  { "id": 6, "area": "Taj Bagh Road", "zone": "Nehru Nagar", "risk": "High", "pos": [21.0949, 79.0401] },
  { "id": 7, "area": "Gangabai Ghat Area", "zone": "Lakadganj", "risk": "High", "pos": [21.1671, 79.1073] },
  { "id": 8, "area": "Gokulpeth Nawab Kua Area", "zone": "Dharampeth", "risk": "Medium", "pos": [21.1333, 79.0839] },
  { "id": 9, "area": "Rahul Nagar", "zone": "Ashi Nagar", "risk": "Medium", "pos": [21.1272, 79.0696] },
  { "id": 10, "area": "Urvela Colony", "zone": "Ashi Nagar", "risk": "Medium", "pos": [21.1102, 79.0863] },
  { "id": 11, "area": "Yashodhara Nagar", "zone": "Satranjipura", "risk": "High", "pos": [21.1365, 79.0792] },
  { "id": 12, "area": "Mominpura Back Lanes", "zone": "Gandhibagh", "risk": "High", "pos": [21.1676, 79.1368] },
  { "id": 13, "area": "Cotton Market Area", "zone": "Gandhibagh", "risk": "High", "pos": [21.0943, 79.0595] },
  { "id": 14, "area": "Itwari Railway Surroundings", "zone": "Gandhibagh", "risk": "High", "pos": [21.1633, 79.0515] },
  { "id": 15, "area": "Kalamna Market Yard", "zone": "Lakadganj", "risk": "High", "pos": [21.1629, 79.1296] },
  { "id": 16, "area": "Automotive Square", "zone": "Mangalwari", "risk": "Medium", "pos": [21.1240, 79.1036] },
  { "id": 17, "area": "Indora Chowk", "zone": "Mangalwari", "risk": "Medium", "pos": [21.1302, 79.0513] },
  { "id": 18, "area": "Chaoni Chowk", "zone": "Mangalwari", "risk": "Medium", "pos": [21.1733, 79.1264] },
  { "id": 19, "area": "Sonegaon Lake Side", "zone": "Dhantoli", "risk": "Medium", "pos": [21.1577, 79.0308] },
  { "id": 20, "area": "Pratap Nagar Open Plot Area", "zone": "Laxmi Nagar", "risk": "Medium", "pos": [21.1045, 79.0460] },
  { "id": 21, "area": "Ambazari Back Road", "zone": "Dharampeth", "risk": "Medium", "pos": [21.1777, 79.0503] },
  { "id": 22, "area": "Dharampeth Commercial Lanes", "zone": "Dharampeth", "risk": "Medium", "pos": [21.1175, 79.0714] },
  { "id": 23, "area": "Medical Square Surroundings", "zone": "Hanuman Nagar", "risk": "Medium", "pos": [21.1294, 79.1426] },
  { "id": 24, "area": "Ajni Railway Yard Area", "zone": "Dhantoli", "risk": "High", "pos": [21.1230, 79.1163] },
  { "id": 25, "area": "Manewada Road Corners", "zone": "Hanuman Nagar", "risk": "Medium", "pos": [21.1220, 79.0691] },
  { "id": 26, "area": "Nandanvan Main Road", "zone": "Hanuman Nagar", "risk": "Medium", "pos": [21.1435, 79.0606] },
  { "id": 27, "area": "Jaripatka Market Area", "zone": "Mangalwari", "risk": "Medium", "pos": [21.1902, 79.1260] },
  { "id": 28, "area": "Kamptee Road Slum Pockets", "zone": "Mangalwari", "risk": "High", "pos": [21.1842, 79.0702] },
  { "id": 29, "area": "Wardhaman Nagar Empty Plots", "zone": "Lakadganj", "risk": "Medium", "pos": [21.1998, 79.0811] },
  { "id": 30, "area": "Swawlambi Nagar Ground Area", "zone": "Laxmi Nagar", "risk": "Medium", "pos": [21.1123, 79.0903] }
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
          toast.success(areaName, {
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
      toast.success(areaName, {
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
        w-[15.5rem] bg-white border-r border-slate-200 flex flex-col fixed h-full z-50 transition-transform duration-300
        ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        <div className="px-4 py-[1.125rem] border-b border-slate-200 flex items-center justify-between">


          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-none flex items-center justify-center font-bold text-white shadow-lg shadow-green-100">W</div>
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
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-none">
            <span className="w-2 h-2 bg-green-500 rounded-none alert-pulse"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Active</span>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden md:ml-[15.5rem]">


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
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95"
            >
              <span>📍</span> Sync GPS
            </button>

            {/* Live location name pill */}
            {userLocation && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-sm animate-pulse"></span>
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest truncate max-w-[180px]">{currentAreaName}</span>
              </div>
            )}

            <span className="text-xs text-slate-500">Nagpur Municipal Corporation</span>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 hover:bg-slate-100 rounded-none text-slate-600"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-none">
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
              setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            }}
          />
        )}

        <div className={`flex-1 overflow-hidden h-full ${['monitor', 'map'].includes(tab) ? 'p-0' : 'p-4 md:p-6'}`}>
          <div className={`h-full ${['monitor', 'map'].includes(tab) ? 'max-w-none' : 'max-w-[1600px] mx-auto'}`}>

            {!stats ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Initializing Dashboard...</p>
                </div>
              </div>
            ) : (
              <>
                {tab === 'overview' && <div className="h-full overflow-y-auto pr-2"><OverviewTab stats={stats} tickets={tickets} events={wsEvents.length > 0 ? wsEvents : events} alerts={alerts} userLocation={userLocation} currentAreaName={currentAreaName} onLocationSelect={handleManualLocationSync} onTabChange={setTab} /></div>}
                {tab === 'monitor' && <div className="h-full overflow-y-auto pr-2"><MonitorTab events={wsEvents.length > 0 ? wsEvents : events} currentAreaName={currentAreaName} /></div>}
                {tab === 'map' && <MapTab tickets={tickets} collectionPoints={collectionPoints} workers={workers} liveDetections={wsEvents.filter(e => (Date.now() / 1000 - e.timestamp) < 30)} userLocation={userLocation} onLocationSelect={handleManualLocationSync} />}
                {tab === 'tickets' && <TicketsTab tickets={tickets} setTickets={setTickets} readOnly={true} />}
                {tab === 'alerts' && <AlertsTab alerts={alerts} setAlerts={setAlerts} />}
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
function OverviewTab({ stats, tickets, events, alerts, userLocation, currentAreaName, onLocationSelect, onTabChange }) {
  if (!stats) return <div className="text-gray-500">Loading...</div>;

  const recentTickets = [...tickets].sort((a, b) => b.created_at - a.created_at).slice(0, 5);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 pb-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Operational Analytics</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h2>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-md border border-slate-200 shadow-sm">
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Current Session</p>
            <p className="text-xs font-black text-slate-700 leading-none">{today}</p>
          </div>
          <div className="w-8 h-8 bg-slate-50 rounded-md flex items-center justify-center text-lg">📅</div>
        </div>


      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">

        <StatsCard title="Total Tickets" value={stats.total_tickets} subtitle="Auto-generated" color="blue" />
        <StatsCard title="Open Tickets" value={stats.open_tickets + stats.assigned_tickets} subtitle="Needs attention" color="orange" />
        <StatsCard title="In Progress" value={stats.in_progress_tickets} subtitle="Workers active" color="green" />
        <StatsCard title="Resolved" value={stats.resolved_tickets} subtitle="Cleaned up" color="purple" />
        <StatsCard title="Pickup Rate" value={`${stats.pickup_rate}%`} subtitle={`${stats.pickups_completed}/${stats.collection_points_total}`} color="cyan" />
        <StatsCard title="Active Alerts" value={stats.active_alerts} subtitle="Unacknowledged" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Mini Map Container */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-md overflow-hidden shadow-sm border border-slate-200" style={{ height: '480px' }}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Live Garbage Hotspots</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-xs">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-sm animate-pulse"></span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{tickets.filter(t => t.status !== 'RESOLVED').length} Active Incidents</span>
              </div>
            </div>
          </div>


          <div className="flex-1 relative">
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

        {/* Recent Alerts Feed Container */}
        <div style={{ height: '480px' }}>
          <AlertFeed events={events.slice(0, 15)} currentAreaName={currentAreaName} />
        </div>
      </div>

      {/* Recent Tickets Table Section */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Recent Auto-Generated Tickets</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">LATEST SYSTEM-GENERATED TASKS FROM COMPUTER VISION DETECTIONS</p>
          </div>
          <button
            className="text-[10px] font-black text-green-600 hover:text-green-700 uppercase tracking-[0.1em] px-3 py-1.5 bg-green-50 rounded-md transition-colors border border-green-100"
            onClick={() => onTabChange && onTabChange('tickets')}
          >
            View All Tickets
          </button>
        </div>


        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="text-left py-4 px-6">ID</th>
                <th className="text-left py-4 px-6">Location Address</th>
                <th className="text-left py-4 px-6">Severity Level</th>
                <th className="text-left py-4 px-6">Current Status</th>
                <th className="text-left py-4 px-6">Assigned Personnel</th>
                <th className="text-left py-4 px-6">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentTickets.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-500 font-bold">#{t.id.slice(-6)}</td>
                  <td className="py-4 px-6">
                    <p className="text-xs font-black text-slate-700 leading-tight">{t.location.address}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.location.area || 'Unknown Zone'}</p>
                  </td>
                  <td className="py-4 px-6">
                    <SeverityBadge severity={t.severity} />
                  </td>
                  <td className="py-4 px-6">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-4 px-6">
                    {t.assigned_worker ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px]">👤</div>
                        <span className="text-xs font-bold text-slate-600">{t.assigned_worker.name}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                    {new Date(t.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {recentTickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl grayscale opacity-20">🤖</div>
                      <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Awaiting Vision Detections...</p>
                    </div>
                  </td>
                </tr>
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
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2" style={{ height: 'calc(100vh - 65px)' }}>
        <div className="lg:col-span-3 flex flex-col h-full bg-black">
          <VideoFeed />
        </div>
        <div className="h-full overflow-hidden bg-white border-l border-slate-200">
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
  const [selectedHotspot, setSelectedHotspot] = useState(null);

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
    <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-65px)]">

      {/* Map Side */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-4 flex-wrap text-[10px] font-medium uppercase tracking-wider text-slate-500 p-4 bg-slate-50/50 border-b border-slate-200">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-none bg-red-500"></span> Garbage Hotspot</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-none bg-green-500"></span> Station (Active)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-none bg-amber-500"></span> Auto Tipper</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-none bg-blue-500"></span> Tata 407</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-none bg-emerald-500"></span> Electric</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-none bg-purple-500"></span> Heavy Tipper</span>
        </div>

        <div className="flex-1 bg-white rounded-none overflow-hidden relative flex">

          <div className="flex-1 relative">
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
              staticHotspots={HOTSPOTS_LIST}
              selectedStaticHotspot={selectedHotspot}
            />
            {/* Active zone overlay badge */}
            {selectedStation && (
              <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm border border-emerald-200 rounded-none px-4 py-2 shadow-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-none animate-pulse"></span>

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

            {/* Google Maps Style Floating Left Panel */}
            <div className={`absolute top-0 left-0 h-full w-80 bg-white z-[1000] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col border-r border-slate-200 ${selectedStation ? 'translate-x-0' : '-translate-x-full'}`}>
              {selectedStation && (
                <>
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=600&q=80"
                      alt="Station Facility"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      onClick={() => handleStationClick(selectedStation)}
                      className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-none flex items-center justify-center text-slate-700 shadow-sm z-10 hover:bg-white transition-colors"
                    >

                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
                    <div className="p-5 border-b border-slate-100">
                      <h2 className="text-2xl font-bold text-slate-800 mb-1">{zones.find(z => z.id === selectedStation)?.name} Station</h2>
                      <p className="text-sm text-slate-500 mb-3">Solid Waste Management Facility</p>
                      <div className="flex items-center text-sm text-slate-600">
                        <span className="font-semibold mr-1">4.8</span>
                        <span className="text-amber-500 tracking-widest mr-2 text-base">★★★★★</span>
                        <span className="text-slate-400">(124)</span>
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="text-emerald-600 font-bold">Active</span>
                      </div>
                    </div>

                    <div className="flex justify-around p-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                        <div className="w-10 h-10 rounded-none bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-bold tracking-wide">Directions</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                        <div className="w-10 h-10 rounded-none bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors border border-slate-200">

                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                        </div>
                        <span className="text-[11px] text-slate-600 font-medium">Save</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                        <div className="w-10 h-10 rounded-none bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors border border-slate-200">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                        </div>
                        <span className="text-[11px] text-slate-600 font-medium">Nearby</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                        <div className="w-10 h-10 rounded-none bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors border border-slate-200">

                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
                        </div>
                        <span className="text-[11px] text-slate-600 font-medium">Share</span>
                      </div>
                    </div>

                    <div className="p-5 space-y-5">
                      <div className="flex items-start gap-4">
                        <div className="text-emerald-600 mt-0.5">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                        </div>
                        <div>
                          <p className="text-sm text-slate-800 font-medium">Zone {selectedStation}, Nagpur, Maharashtra 440022</p>
                          <p className="text-[13px] text-slate-500 mt-1">Capacity: {zones.find(z => z.id === selectedStation)?.load}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="text-emerald-600 mt-0.5">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </div>
                        <div>
                          <span className="text-sm font-bold text-emerald-600">Open 24 hours</span>
                          <span className="text-sm text-slate-500"> • Smart City Operations</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="text-emerald-600 mt-0.5">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        </div>
                        <div>
                          <p className="text-sm text-slate-800 font-medium">Solar Hoppers Equipped</p>
                          <a href="#" className="text-[13px] text-sky-600 hover:underline cursor-pointer">nmc.gov.in/solid-waste</a>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="text-emerald-600 mt-0.5">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>
                        </div>
                        <div>
                          <p className="text-sm text-slate-800 font-medium">Contractor</p>
                          <p className="text-[13px] text-slate-500">{zones.find(z => z.id === selectedStation)?.contractor}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Truck Footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white py-8 px-6 rounded-none border-t border-slate-200">
          {truckStats.map(s => (
            <div key={s.type} className="text-center">
              <p className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-1">{s.type}</p>
              <p className="text-2xl font-black text-slate-900 leading-none">
                {s.active}
                <span className="text-sm text-slate-300 font-bold ml-1.5 tracking-tighter">/ {s.total}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-0 border-l border-slate-200 bg-white">
        {/* Toggle Switch */}
        <div className="bg-slate-50 p-1 border-b border-slate-200 flex">
          <button
            onClick={() => setViewType('stations')}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-none transition-all ${viewType === 'stations' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Stations
          </button>
          <button
            onClick={() => setViewType('hotspots')}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-none transition-all ${viewType === 'hotspots' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Hotspots
          </button>
        </div>


        {/* Info Card */}
        <div className="bg-white rounded-none flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{viewType === 'stations' ? 'Station Directory' : 'Identified Hotspots'}</h3>
            <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
              {viewType === 'stations' ? 'Click a zone to see its coverage area' : 'Frequent unauthorized dumping zones'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {viewType === 'stations' ? (
              zones.map(z => {
                const isSelected = selectedStation === z.id;
                const zoneTruckCount = trucks.filter(t => t.zone === z.id).length;
                return (
                  <div
                    key={z.id}
                    onClick={() => handleStationClick(z.id)}
                    className={`p-3 rounded-none border transition-all cursor-pointer ${isSelected
                        ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                        : z.highlight
                          ? 'bg-slate-50 border-slate-900 hover:bg-slate-100'
                          : 'bg-white border-slate-100 hover:border-slate-300'
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
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none animate-pulse"></span>
                          Coverage Active
                        </span>

                        <span className="text-[9px] text-slate-500 font-bold">
                          {zoneTruckCount} truck{zoneTruckCount !== 1 ? 's' : ''} deployed
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              HOTSPOTS_LIST.map(h => {
                const isSelected = selectedHotspot === h.id;
                const getRiskStyles = (risk) => {
                  switch (risk) {
                    case 'Extreme': return 'bg-red-50 text-red-700 border-red-200';
                    case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
                    case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
                    default: return 'bg-slate-50 text-slate-700 border-slate-200';
                  }
                };
                return (
                  <div
                    key={`hs-${h.id}`}
                    onClick={() => setSelectedHotspot(h.id)}
                    className={`p-3 border rounded-none cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden group ${isSelected
                        ? 'bg-red-50/50 border-red-400 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${isSelected ? 'bg-red-500' : 'bg-slate-200 group-hover:bg-slate-400'}`}></div>
                    <div className="flex justify-between items-start pl-2">
                      <div>
                        <h4 className={`text-xs font-black ${isSelected ? 'text-red-900' : 'text-slate-800 uppercase tracking-tight'}`}>{h.area}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{h.zone} Zone</p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-none font-bold uppercase border ${getRiskStyles(h.risk)}`}>
                        {h.risk} Risk
                      </span>
                    </div>
                  </div>

                );
              })
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500 italic">
              {viewType === 'stations' ? 'Target: 150 MT capacity/station with solar hoppers.' : 'Hotspots require increased surveillance.'}
            </p>
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
function AlertsTab({ alerts, setAlerts }) {
  const [filter, setFilter] = useState('ALL');

  const handleAcknowledge = (alertId) => {
    // Optimistic update — mark alert acknowledged in local state
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
    toast.success('Alert acknowledged');
  };

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
    <div className="space-y-6 h-full flex flex-col pb-6">
      {/* Alert Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0 w-full">
        {[
          { label: 'Critical', count: stats.CRITICAL, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100', id: 'CRITICAL' },
          { label: 'High', count: stats.HIGH, countColor: 'text-rose-600', color: 'text-rose-500', bg: 'bg-rose-50/50', border: 'border-rose-100/50', id: 'HIGH' },
          { label: 'Medium', count: stats.MEDIUM, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100', id: 'MEDIUM' },
          { label: 'Low', count: stats.LOW, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', id: 'LOW' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilter(filter === s.id ? 'ALL' : s.id)}
            className={`p-4 rounded-md border transition-all text-left group ${s.bg} ${s.border} ${filter === s.id ? 'ring-2 ring-slate-900 shadow-sm' : 'hover:shadow-sm'} min-w-0`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-black uppercase tracking-widest ${s.color} mb-1 truncate`}>{s.label}</p>
                <p className={`text-2xl font-black text-slate-900 leading-none ${s.countColor || ''}`}>{s.count}</p>
              </div>
              <div className={`w-8 h-8 rounded-md flex items-center justify-center opacity-20 group-hover:opacity-50 transition-opacity ${s.bg} border ${s.border} flex-shrink-0 text-lg`}>
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
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Active Incident Log</h3>
          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-tighter">{filtered.length} Results</span>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-md p-0.5 shadow-sm">
          {['ALL', 'CRITICAL', 'HIGH'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${filter === f ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-md border border-slate-200 border-dashed p-12 text-center">
          <div className="w-16 h-16 bg-white border border-slate-200 rounded-md flex items-center justify-center text-2xl mb-4 grayscale shadow-sm">🛡️</div>
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Clear Skies</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">No alerts matching your current filter</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {sorted.map(a => (
            <div key={a.id} className="group bg-white rounded-md border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden flex">
              <div className={`w-1.5 flex-shrink-0 ${a.severity === 'CRITICAL' ? 'bg-red-700' :
                  a.severity === 'HIGH' ? 'bg-rose-500' :
                    a.severity === 'MEDIUM' ? 'bg-orange-500' : 'bg-amber-500'
                }`}></div>
              <div className="flex-1 p-4 flex items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center text-lg shadow-sm border border-slate-100 ${a.severity === 'CRITICAL' ? 'bg-red-50' : 'bg-slate-50'
                    }`}>
                    {a.type === 'GARBAGE_DETECTED' ? '🗑️' : '⚠️'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${a.severity === 'CRITICAL' ? 'bg-red-700 text-white' :
                          a.severity === 'HIGH' ? 'bg-rose-500 text-white' :
                            a.severity === 'MEDIUM' ? 'bg-orange-500 text-white' : 'bg-amber-400 text-slate-900'
                        }`}>{a.severity}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(a.timestamp * 1000).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[13px] font-black text-slate-800 leading-snug uppercase tracking-tight">{a.message}</p>
                    {a.ticket_id && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ticket: {a.ticket_id}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-sm"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Automatic AI Generation</span>
                      </div>
                    )}
                  </div>
                </div>
                {!a.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(a.id)}
                    className="flex-shrink-0 px-5 py-2.5 bg-slate-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md hover:bg-blue-600"
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
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Personnel Directory</h3>
          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md uppercase tracking-tighter">{workers.length} Total</span>
        </div>
        <button
          onClick={() => { setEditingWorker(null); setShowModal(true); }}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md"
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
            <div key={w.id} className="group bg-white rounded-none border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden flex flex-col">
              <div className="p-4 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-none flex items-center justify-center text-xs font-black border border-slate-100 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-800 transition-all">
                      {w.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-slate-900 leading-none uppercase tracking-tight">{w.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-black text-orange-600 uppercase tracking-tighter">{active.length} Active</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-none"></span>
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter">{resolved.length} Done</span>
                      </div>
                    </div>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-none ${w.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></span>
                </div>

                <div className="space-y-1 pt-3 border-t border-slate-50">
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Operation Zone</span>
                    <span className="text-slate-700 font-black uppercase">{w.zone?.split('(')[0]}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Direct Phone</span>
                    <span className="text-slate-700 font-black tracking-widest">{w.phone}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 px-4 py-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => { setEditingWorker(w); setShowModal(true); }}
                  className="flex-1 py-2 bg-white border border-slate-200 rounded-none text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:border-slate-900 transition-all active:scale-95 shadow-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-none text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-red-600 hover:border-red-200 transition-all active:scale-95 shadow-sm"
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
  )
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
      <div className="bg-white rounded-md p-8 max-w-md w-full shadow-2xl border border-slate-200 relative overflow-hidden" onClick={e => e.stopPropagation()}>

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
              onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                onChange={e => setFormData({ ...formData, id: e.target.value })}
                placeholder="WKR-000"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="98XXXXXXXX"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Operational Zone</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all appearance-none"
              value={formData.zone}
              onChange={e => setFormData({ ...formData, zone: e.target.value })}
            >

              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="flex-1 py-4 bg-slate-900 text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-100"
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
    LOW: 'bg-amber-50 text-amber-600 border-amber-200',
    MEDIUM: 'bg-orange-50 text-orange-600 border-orange-200',
    HIGH: 'bg-rose-50 text-rose-600 border-rose-200',
    CRITICAL: 'bg-red-50 text-red-700 border-red-300 animate-pulse',
  };
  return (
    <span className={`
      text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border 
      ${colors[severity] || 'bg-slate-50 text-slate-400 border-slate-200'}
    `}>
      {severity}
    </span>
  );
}



function StatusBadge({ status }) {
  const colors = {
    OPEN: 'bg-blue-50 text-blue-600 border-blue-200',
    ASSIGNED: 'bg-violet-50 text-violet-600 border-violet-200',
    IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-200',
    RESOLVED: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };
  return (
    <span className={`
      text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border 
      ${colors[status] || 'bg-slate-50 text-slate-400 border-slate-200'}
    `}>
      {status?.replace('_', ' ')}
    </span>
  );
}


