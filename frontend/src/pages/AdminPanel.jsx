import React, { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  fetchAdminStats, fetchTickets, fetchAlerts, fetchNotifications,
  fetchRecentEvents, fetchWorkers, fetchCollectionPoints,
  markNotificationRead, createDetectionWebSocket, getVideoFeedUrl,
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
  { id: 'map', label: 'Nagpur Map', icon: '◎' },
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' },
      }} />

      {/* Sidebar */}
      <aside className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col fixed h-full z-10">
        <div className="px-4 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center font-bold text-sm">W</div>
            <div>
              <h1 className="text-sm font-bold">Smart Waste</h1>
              <p className="text-[10px] text-gray-400">Admin Panel - Nagpur</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                ${tab === t.id ? 'bg-green-600/20 text-green-400 border-r-2 border-green-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
              {t.id === 'alerts' && alerts.filter(a => !a.acknowledged).length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {alerts.filter(a => !a.acknowledged).length}
                </span>
              )}
              {t.id === 'tickets' && stats?.open_tickets > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {stats.open_tickets}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-gray-700 p-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full alert-pulse"></span>
            <span className="text-xs text-gray-400">System Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-56">
        {/* Top Bar */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-lg font-semibold">{TABS.find(t => t.id === tab)?.label}</h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">Nagpur Municipal Corporation</span>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 hover:bg-gray-700 rounded-lg"
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

        <div className="p-6">
          {tab === 'overview' && <OverviewTab stats={stats} tickets={tickets} events={wsEvents.length > 0 ? wsEvents : events} alerts={alerts} />}
          {tab === 'monitor' && <MonitorTab events={wsEvents.length > 0 ? wsEvents : events} />}
          {tab === 'map' && <MapTab tickets={tickets} collectionPoints={collectionPoints} workers={workers} />}
          {tab === 'tickets' && <TicketsTab tickets={tickets} />}
          {tab === 'alerts' && <AlertsTab alerts={alerts} />}
          {tab === 'workers' && <WorkersTab workers={workers} tickets={tickets} />}
        </div>
      </main>
    </div>
  );
}

// ── Overview Tab ──
function OverviewTab({ stats, tickets, events, alerts }) {
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
        <div className="lg:col-span-2 bg-gray-800 rounded-xl overflow-hidden shadow-lg" style={{ height: '400px' }}>
          <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Nagpur - Live Garbage Hotspots</h3>
            <span className="text-xs text-gray-400">{tickets.filter(t => t.status !== 'RESOLVED').length} active incidents</span>
          </div>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <NagpurMap tickets={tickets} showWorkers={false} height="100%" />
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <AlertFeed events={events.slice(0, 15)} />
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
        <h3 className="text-sm font-semibold mb-3">Recent Auto-Generated Tickets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
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
                <tr key={t.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 font-mono text-xs">{t.id}</td>
                  <td className="py-2 px-3 text-xs">{t.location.address}</td>
                  <td className="py-2 px-3">
                    <SeverityBadge severity={t.severity} />
                  </td>
                  <td className="py-2 px-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2 px-3 text-xs">{t.assigned_worker?.name}</td>
                  <td className="py-2 px-3 text-xs text-gray-400">{new Date(t.created_at * 1000).toLocaleTimeString()}</td>
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
function MonitorTab({ events }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VideoFeed />
        </div>
        <div>
          <AlertFeed events={events} />
        </div>
      </div>
    </div>
  );
}

// ── Map Tab ──
function MapTab({ tickets, collectionPoints, workers }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Garbage Hotspot</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Collected</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Pending</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Worker</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500"></span> Missed Pickup</span>
      </div>
      <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg" style={{ height: '600px' }}>
        <NagpurMap
          tickets={tickets}
          collectionPoints={collectionPoints}
          workers={workers}
          showWorkers={true}
          height="100%"
        />
      </div>
    </div>
  );
}

// ── Tickets Tab ──
function TicketsTab({ tickets }) {
  return <TicketBoard tickets={tickets} />;
}

// ── Alerts Tab ──
function AlertsTab({ alerts }) {
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">All Alerts ({alerts.length})</h3>
        <span className="text-xs text-gray-400">{alerts.filter(a => !a.acknowledged).length} unacknowledged</span>
      </div>
      {sorted.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center text-gray-500">
          <p>No alerts yet</p>
          <p className="text-xs mt-1">Alerts appear when AI detects garbage anomalies</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(a => (
            <div key={a.id} className={`bg-gray-800 rounded-lg p-4 border-l-4 ${
              a.severity === 'CRITICAL' ? 'border-red-700' :
              a.severity === 'HIGH' ? 'border-red-500' :
              a.severity === 'MEDIUM' ? 'border-orange-500' : 'border-yellow-500'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs text-gray-400">{a.type}</span>
                  </div>
                  <p className="text-sm">{a.message}</p>
                  {a.ticket_id && <p className="text-xs text-blue-400 mt-1">Ticket: {a.ticket_id}</p>}
                </div>
                <span className="text-xs text-gray-500">{new Date(a.timestamp * 1000).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Workers Tab ──
function WorkersTab({ workers, tickets }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Field Workers ({workers.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {workers.map(w => {
          const wTickets = tickets.filter(t => t.assigned_worker?.id === w.id);
          const active = wTickets.filter(t => t.status !== 'RESOLVED');
          const resolved = wTickets.filter(t => t.status === 'RESOLVED');
          return (
            <div key={w.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {w.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-[10px] text-gray-400">{w.id}</p>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${w.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Zone</span><span>{w.zone}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Active</span><span className="text-orange-400">{active.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Resolved</span><span className="text-green-400">{resolved.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Phone</span><span>{w.phone}</span></div>
              </div>
            </div>
          );
        })}
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
