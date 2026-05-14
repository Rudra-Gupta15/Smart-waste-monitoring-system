import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWorkers, fetchWorkerTickets, acceptTicket, resolveTicket } from '../services/api';
import NagpurMap from '../components/NagpurMap';

const severityColors = {
  LOW: 'bg-yellow-400', MEDIUM: 'bg-orange-400', HIGH: 'bg-red-500', CRITICAL: 'bg-red-700',
};

export default function WorkerPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [tempWorker, setTempWorker] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  // Initialize timers from localStorage to prevent "stopping" on refresh
  const [timers, setTimers] = useState(() => {
    const saved = localStorage.getItem('worker_timers');
    return saved ? JSON.parse(saved) : {};
  });

  // Save timers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('worker_timers', JSON.stringify(timers));
  }, [timers]);

  // Load workers
  useEffect(() => {
    fetchWorkers().then(data => {
      setWorkers(data.workers || []);
    });
  }, []);

  // Load tickets for selected worker
  useEffect(() => {
    if (!selectedWorker) return;
    const load = () => {
      fetchWorkerTickets(selectedWorker.id).then(data => {
        const fetchedTickets = data.tickets || [];
        setTickets(fetchedTickets);

        // Auto-recover timers for IN_PROGRESS tickets if they aren't in state
        setTimers(prev => {
          let hasChange = false;
          const next = { ...prev };
          fetchedTickets.forEach(t => {
            if (t.status === 'IN_PROGRESS' && !next[t.id]) {
              next[t.id] = Date.now();
              hasChange = true;
            }
          });
          return hasChange ? next : prev;
        });
      });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [selectedWorker]);

  const [shiftTimer, setShiftTimer] = useState("00:00:00");
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setShiftTimer(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(t);
  }, [selectedWorker]);

  const handleAccept = async (ticketId) => {
    try {
      const res = await acceptTicket(ticketId, selectedWorker.id);
      if (res.status === 'accepted') {
        setTimers(prev => ({ ...prev, [ticketId]: Date.now() }));
        // Optimistic update
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'IN_PROGRESS' } : t));
        toast.success(`Task accepted! Starting processing timer...`);
      }
    } catch (err) {
      toast.error("Failed to accept task");
    }
  };

  const handleResolve = async (ticketId) => {
    try {
      await resolveTicket(ticketId);
      // Clean up timer on resolution
      setTimers(prev => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'RESOLVED' } : t));
      toast.success(`Task completed!`);
    } catch (err) {
      toast.error("Failed to resolve task");
    }
  };

  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED');
  const resolvedTickets = tickets.filter(t => t.status === 'RESOLVED');
  const displayTickets = activeTab === 'active' ? activeTickets : resolvedTickets;

  const [householdPoints] = useState(() => Array.from({ length: 13 }).map((_, i) => ({
    id: `house-${101 + i}`,
    name: `House #${101 + i}`,
    status: i % 4 === 0 ? 'collected' : 'pending',
    zone: `ZONE BLOCK ${String.fromCharCode(65 + (i % 4))}`,
    lat: 21.1458 + (Math.random() * 0.04 - 0.02),
    lng: 79.0882 + (Math.random() * 0.04 - 0.02),
  })));

  const [stationHotspotsData] = useState(() => [
    { id: 'hs1', area: 'Shivaji Square Corner', risk: 'Medium', pos: [21.1420, 79.0820], zone: 'Central' },
    { id: 'hs2', area: 'IT Park Back Gate', risk: 'High', pos: [21.1245, 79.0521], zone: 'West' },
    { id: 'hs3', area: 'Central Mall Lane', risk: 'Low', pos: [21.1458, 79.0882], zone: 'North' }
  ]);

  const [ROUTE_POINTS] = useState(() => [
    { id: 1, name: 'Point 01', lat: 21.1400, lng: 79.0800 },
    { id: 2, name: 'Point 02', lat: 21.1410, lng: 79.0810 },
    { id: 3, name: 'Point 03', lat: 21.1420, lng: 79.0815 },
    { id: 4, name: 'Point 04', lat: 21.1430, lng: 79.0825 },
    { id: 5, name: 'Point 05', lat: 21.1435, lng: 79.0840 },
    { id: 6, name: 'Point 06', lat: 21.1445, lng: 79.0850 },
    { id: 7, name: 'Point 07', lat: 21.1450, lng: 79.0865 },
    { id: 8, name: 'Point 08', lat: 21.1455, lng: 79.0880 },
    { id: 9, name: 'Point 09', lat: 21.1450, lng: 79.0895 },
    { id: 10, name: 'Point 10', lat: 21.1440, lng: 79.0905 },
    { id: 11, name: 'Point 11', lat: 21.1430, lng: 79.0910 },
    { id: 12, name: 'Point 12', lat: 21.1420, lng: 79.0900 },
    { id: 13, name: 'Point 13', lat: 21.1410, lng: 79.0890 },
    { id: 14, name: 'Point 14', lat: 21.1400, lng: 79.0870 },
  ]);

  const [truckPos, setTruckPos] = useState({ lat: 21.1400, lng: 79.0800 });
  const [targetIndex, setTargetIndex] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (activeTab !== 'active' || !selectedWorker) return;

    if (isPaused) {
      const timer = setTimeout(() => {
        setIsPaused(false);
      }, 2000);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setTruckPos(prev => {
        const target = ROUTE_POINTS[targetIndex];
        if (!target) return prev;

        const distLat = target.lat - prev.lat;
        const distLng = target.lng - prev.lng;
        const dist = Math.sqrt(distLat * distLat + distLng * distLng);
        
        const speed = 0.0002;
        if (dist < speed) {
          if (targetIndex < ROUTE_POINTS.length - 1) {
            setTargetIndex(i => i + 1);
            setIsPaused(true);
          } else {
            setTargetIndex(0);
          }
          return { lat: target.lat, lng: target.lng };
        }

        return {
          lat: prev.lat + (distLat / dist) * speed,
          lng: prev.lng + (distLng / dist) * speed,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [targetIndex, isPaused, activeTab, ROUTE_POINTS, selectedWorker]);

  const routePath = ROUTE_POINTS.map(p => [p.lat, p.lng]);
  const simulatedTruck = [{
    id: 't1', 
    label: 'Daily Route Truck', 
    typeName: 'Garbage Truck', 
    zone: 'Sector Alpha', 
    status: isPaused ? 'Collecting' : 'Moving', 
    speed: isPaused ? 0 : 25,
    type: 'heavy',
    color: '#3b82f6',
    lat: truckPos.lat, 
    lng: truckPos.lng 
  }];

  if (!selectedWorker) {
    // Login Screen remains same
    return (
      <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-hidden">
        <Toaster position="top-center" />
        {/* Left Panel: Operational Branding */}
        <div className="md:w-[45%] bg-slate-900 relative flex flex-col justify-center p-12 lg:p-20 overflow-hidden border-b-[6px] md:border-b-0 md:border-r-[6px] border-blue-600">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white text-slate-900 flex items-center justify-center font-black text-xl mb-8 shadow-2xl">W</div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-3">Nagpur Municipal Corporation</p>
            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter leading-none mb-6">WELCOME<br />BACK.</h1>
            <div className="w-12 h-1 bg-blue-600 mb-8"></div>
            <p className="text-xs text-slate-400 font-bold max-w-xs leading-relaxed uppercase tracking-wider">Secure access terminal for field operations and waste management logistics.</p>
          </div>
        </div>
        {/* Right Panel: Authentication Form */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 bg-[#f8fafc]">
          <div className="max-w-sm w-full text-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-10">Login Account</h2>
            <div className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5">Operator ID</label>
                <select
                  onChange={(e) => {
                    const worker = workers.find(w => w.id === e.target.value);
                    if (worker) setTempWorker(worker);
                  }}
                  value={tempWorker?.id || ''}
                  className="w-full bg-white border border-slate-200 rounded-none px-4 py-4 text-xs font-black text-slate-700 uppercase tracking-tight focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="" disabled>--- SELECT YOUR ID ---</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.id} • {w.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5">Access Password</label>
                <input type="password" value="12345678" readOnly className="w-full bg-slate-100 border border-slate-200 rounded-none px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-[0.4em] focus:outline-none" />
              </div>
              <button
                onClick={() => { if (tempWorker) setSelectedWorker(tempWorker); }}
                disabled={!tempWorker}
                className={`w-full py-5 text-[11px] font-black uppercase tracking-[0.4em] transition-all shadow-xl
                  ${tempWorker ? 'bg-blue-600 text-white hover:bg-slate-900 active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                `}
              >
                LOGIN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f3f5] text-slate-800 pb-20 font-sans">
      <Toaster position="top-center" />

      {/* Modern App Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedWorker(null)}
              className="w-10 h-10 flex items-center justify-center rounded-none bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 transition-all hover:bg-white"
            >
              &larr;
            </button>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-none tracking-tight">{selectedWorker.name}</h2>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5">{selectedWorker.zone} Operation • {selectedWorker.id}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Shift Timer</p>
              <p className="text-sm font-black text-slate-700 font-mono tracking-wider">{shiftTimer}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolved Today</p>
              <p className="text-sm font-black text-green-600 font-mono">{resolvedTickets.length}</p>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-4 py-2 border border-green-100 rounded-none ml-4">
              <span className="w-2 h-2 bg-green-500 rounded-none animate-pulse"></span>
              <span className="text-[10px] font-black text-green-700 uppercase tracking-[0.2em]">Live Status</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Tab Control */}
        <div className="flex bg-white p-1 rounded-none border border-slate-200 shadow-sm max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.3em] rounded-none transition-all ${activeTab === 'active' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            Mission Board
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.3em] rounded-none transition-all ${activeTab === 'resolved' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            Mission Log
          </button>
        </div>

        {/* Operational Rows (Only show on Mission Board) */}
        {activeTab === 'active' && (
          <>
            {/* Row 1: Map Overview */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Row 01 // Sector Map Overview</h3>
                <span className="text-[9px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-none uppercase">Live Tracking</span>
              </div>
              <div className="bg-white border border-slate-200 p-2 shadow-sm relative z-0 h-[450px]">
                <NagpurMap 
                  tickets={displayTickets}
                  collectionPoints={householdPoints}
                  staticHotspots={stationHotspotsData}
                  viewType="hotspots"
                  height="100%"
                  routePath={routePath}
                  trucks={simulatedTruck}
                />
              </div>
            </section>

            {/* Row 2: Collection Points Tracker */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Row 02 // Daily Collection Route Tracker</h3>
                <span className="text-[9px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-none uppercase">14 Points</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                {ROUTE_POINTS.map((point, index) => {
                  let status = 'PENDING';
                  let boxClass = 'bg-white border-slate-200 text-slate-400';
                  let statusClass = 'text-slate-400 border-slate-100';
                  
                  if (index < targetIndex || (index === ROUTE_POINTS.length - 1 && targetIndex === 0)) {
                    status = 'COMPLETED';
                    boxClass = 'bg-green-50 border-green-200';
                    statusClass = 'text-green-600 bg-green-100 border-green-200';
                  } else if (index === targetIndex) {
                    status = isPaused ? 'STOPPED' : 'ARRIVING';
                    boxClass = 'bg-blue-50 border-blue-400 ring-2 ring-blue-200 ring-offset-1';
                    statusClass = 'text-blue-600 bg-blue-100 border-blue-200 animate-pulse';
                  }

                  return (
                    <div key={point.id} className={`flex-shrink-0 w-32 border p-4 rounded-none transition-all group ${boxClass}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${index <= targetIndex ? 'text-slate-800' : 'text-slate-400'}`}>
                        {point.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 mb-4 truncate">
                        Loc: {point.lat.toFixed(3)}
                      </p>
                      <div className={`w-full py-1.5 border text-center text-[8px] font-black uppercase tracking-tighter ${statusClass}`}>
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Row 3: Active AI Missions */}
        <div className="space-y-4">
          {activeTab === 'active' && (
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Row 03 // Real-time AI Missions</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-none animate-pulse"></span>
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Active Link</span>
              </div>
            </div>
          )}

          {displayTickets.length === 0 ? (
            <div className="bg-white rounded-none p-16 text-center border border-slate-200 shadow-sm border-dashed flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-none flex items-center justify-center text-3xl mb-6 grayscale opacity-30">🛡️</div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.3em] mb-2">Sector Status: CLEAR</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">No active incidents detected in your patrol zone</p>

              {selectedWorker.id === 'WKR-001' && (
                <button
                  onClick={() => {
                    const demoMissions = [
                      {
                        id: 'DEMO-8821',
                        status: 'OPEN',
                        severity: 'CRITICAL',
                        created_at: Math.floor(Date.now() / 1000) - 300,
                        object_count: 14,
                        location: { address: 'Plot 42, IT Park Road, Nagpur', zone: 'DHARAMPETH', lat: 21.1245, lng: 79.0521 },
                        categories: ['Plastic Waste', 'Construction Debris']
                      },
                      {
                        id: 'DEMO-9902',
                        status: 'OPEN',
                        severity: 'HIGH',
                        created_at: Math.floor(Date.now() / 1000) - 1200,
                        object_count: 8,
                        location: { address: 'Nagpur Central Metro Plaza', zone: 'DHARAMPETH', lat: 21.1458, lng: 79.0882 },
                        categories: ['General Waste']
                      }
                    ];
                    setTickets(demoMissions);
                    toast.success("SIMULATED MISSION DATA RECEIVED", {
                      style: { borderRadius: '0', background: '#1e293b', color: '#fff', fontSize: '10px', fontWeight: 'bold' }
                    });
                  }}
                  className="px-8 py-3 bg-white border-2 border-slate-900 text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] hover:bg-slate-900 hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(30,41,59,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Simulate Mission Data
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayTickets.map(ticket => (
                <WorkerTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  startTime={timers[ticket.id]}
                  onAccept={() => handleAccept(ticket.id)}
                  onComplete={() => handleResolve(ticket.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkerTicketCard({ ticket, startTime, onAccept, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [canComplete, setCanComplete] = useState(false);

  useEffect(() => {
    if (!startTime || ticket.status !== 'IN_PROGRESS') {
      setProgress(0);
      setCanComplete(false);
      return;
    }

    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const p = Math.min(100, (elapsed / 10) * 100);
      setProgress(p);
      if (p >= 100) {
        setCanComplete(true);
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [startTime, ticket.status]);

  const timeAgo = Math.floor((Date.now() / 1000 - ticket.created_at) / 60);

  return (
    <div className={`bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-xl ${ticket.status === 'IN_PROGRESS' ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Card Header: Metadata */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{ticket.id}</span>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{timeAgo}m AGO</span>
          <div className={`w-2 h-2 rounded-none ${severityColors[ticket.severity] || 'bg-slate-400'} animate-pulse`}></div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <h3 className="text-[14px] font-black text-slate-900 leading-tight mb-2 uppercase tracking-tight line-clamp-1">{ticket.location.address}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-none uppercase tracking-widest">{ticket.location.zone} Sector</span>
            <span className="text-[10px] font-black text-slate-300">|</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Lat: {ticket.location.lat.toFixed(4)} Lng: {ticket.location.lng.toFixed(4)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 border border-slate-100">
            <p className="text-[9px] text-slate-400 font-black uppercase mb-1.5 tracking-[0.1em]">Target Load</p>
            <p className="text-xl font-black text-slate-800 leading-none">{ticket.object_count}<span className="text-[10px] text-slate-400 ml-1 font-bold">UNITS</span></p>
          </div>
          <div className="bg-slate-50 p-4 border border-slate-100">
            <p className="text-[9px] text-slate-400 font-black uppercase mb-1.5 tracking-[0.1em]">AI Confidence</p>
            <p className="text-xl font-black text-slate-800 leading-none">{(90 + Math.random() * 8).toFixed(1)}<span className="text-[10px] text-slate-400 ml-1 font-bold">%</span></p>
          </div>
        </div>

        <div className="pt-2">
          <a
            href={`https://www.google.com/maps?q=${ticket.location.lat},${ticket.location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-slate-200 text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] hover:bg-slate-50 transition-all"
          >
            <span>📍</span> Pinpoint on maps
          </a>
        </div>
      </div>

      {/* Action Zone */}
      <div className="mt-auto border-t border-slate-100">
        {(ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
          <button
            onClick={onAccept}
            className="w-full bg-slate-900 text-white text-[11px] font-black py-5 hover:bg-blue-600 transition-all uppercase tracking-[0.3em]"
          >
            INITIALIZE MISSION
          </button>
        )}

        {ticket.status === 'IN_PROGRESS' && (
          <div className="p-6 bg-blue-50/50">
            {!canComplete ? (
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-black text-blue-600 uppercase tracking-widest">
                  <span className="animate-pulse">Processing...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                onClick={onComplete}
                className="w-full bg-green-600 text-white text-[11px] font-black py-4 hover:bg-green-700 transition-all uppercase tracking-[0.3em] animate-pulse shadow-lg"
              >
                CONFIRM RESOLUTION
              </button>
            )}
          </div>
        )}

        {ticket.status === 'RESOLVED' && (
          <div className="bg-green-50 py-5 text-center flex items-center justify-center gap-2">
            <span className="text-green-500 text-sm">✓</span>
            <span className="text-[11px] font-black text-green-700 uppercase tracking-[0.3em]">Mission Accomplished</span>
          </div>
        )}
      </div>
    </div>
  );
}
