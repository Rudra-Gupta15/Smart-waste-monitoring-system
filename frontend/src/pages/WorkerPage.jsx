import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWorkers, fetchWorkerTickets, acceptTicket, resolveTicket } from '../services/api';

const severityColors = {
  LOW: 'bg-yellow-400', MEDIUM: 'bg-orange-400', HIGH: 'bg-red-500', CRITICAL: 'bg-red-700',
};

export default function WorkerPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
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

  if (!selectedWorker) {
    return (
      <div className="min-h-screen bg-[#f1f3f5] flex items-center justify-center p-6">
        <Toaster position="top-center" />
        <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black shadow-lg shadow-green-100 animate-bounce-slow">W</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Worker Portal</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Nagpur Municipal Corporation</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1 col-span-full">Identify Yourself</p>
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w)}
                className="group bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-green-500 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center text-lg font-black group-hover:bg-green-600 transition-colors">
                  {w.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{w.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{w.zone} Zone • {w.id}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-green-500 transition-colors">
                  &rarr;
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f3f5] text-slate-800 pb-20">
      <Toaster position="top-center" />

      {/* Modern App Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedWorker(null)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
            >
              &larr;
            </button>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-none">{selectedWorker.name}</h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{selectedWorker.zone} Operation</p>
            </div>
          </div>
          <div className="bg-green-50 px-3 py-1 rounded-full border border-green-100">
            <span className="text-[11px] font-black text-green-700 uppercase tracking-widest">{activeTickets.length} Active</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Tab Control */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
              activeTab === 'active' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
              activeTab === 'resolved' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            History
          </button>
        </div>

        {/* Task Grid Control */}
        <div className="space-y-8">
          {displayTickets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm border-dashed">
              <p className="text-sm font-bold text-slate-800">No tasks</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* If in 'active' tab, we can split by status for better clarity on laptop */}
              {activeTab === 'active' ? (
                <>
                  <div className="col-span-full mb-1">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">New Dispatch</h3>
                  </div>
                  {activeTickets.filter(t => t.status === 'OPEN' || t.status === 'ASSIGNED').length > 0 ? (
                    activeTickets.filter(t => t.status === 'OPEN' || t.status === 'ASSIGNED').map(ticket => (
                      <WorkerTicketCard 
                        key={ticket.id} 
                        ticket={ticket} 
                        onAccept={() => handleAccept(ticket.id)}
                        onComplete={() => handleResolve(ticket.id)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-4 text-center text-[9px] font-bold text-slate-300 uppercase">Empty</div>
                  )}

                  <div className="col-span-full mt-4 mb-1">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ongoing</h3>
                  </div>
                  {activeTickets.filter(t => t.status === 'IN_PROGRESS').length > 0 ? (
                    activeTickets.filter(t => t.status === 'IN_PROGRESS').map(ticket => (
                      <WorkerTicketCard 
                        key={ticket.id} 
                        ticket={ticket} 
                        startTime={timers[ticket.id]}
                        onAccept={() => handleAccept(ticket.id)}
                        onComplete={() => handleResolve(ticket.id)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-4 text-center text-[9px] font-bold text-slate-300 uppercase">Empty</div>
                  )}
                </>
              ) : (
                displayTickets.map(ticket => (
                  <WorkerTicketCard 
                    key={ticket.id} 
                    ticket={ticket} 
                    onAccept={() => handleAccept(ticket.id)}
                    onComplete={() => handleResolve(ticket.id)}
                  />
                ))
              )}
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col aspect-square group hover:shadow-md transition-all">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-mono text-slate-300 uppercase">{ticket.id}</span>
          <span className={`w-2.5 h-2.5 rounded-full ${severityColors[ticket.severity] || 'bg-slate-400'}`}></span>
        </div>
        
        <h3 className="text-sm font-black text-slate-900 leading-tight mb-1 line-clamp-2">{ticket.location.address}</h3>
        <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{ticket.location.zone}</p>

        <div className="mt-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-2.5 rounded-lg text-center border border-slate-100">
              <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-tighter">Load</p>
              <p className="text-sm font-black text-slate-700">{ticket.object_count}</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg text-center overflow-hidden border border-slate-100">
              <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-tighter">Type</p>
              <p className="text-[11px] font-black text-slate-700 truncate">{ticket.categories?.[0] || 'Waste'}</p>
            </div>
          </div>

          <a
            href={`https://www.google.com/maps?q=${ticket.location.lat},${ticket.location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors"
          >
            Maps &rarr;
          </a>
        </div>
      </div>

      {/* Action Zone */}
      <div className="mt-auto">
        {(ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
          <button 
            onClick={onAccept}
            className="w-full bg-slate-900 text-white text-[11px] font-black py-4 hover:bg-blue-600 transition-all uppercase tracking-widest"
          >
            ACCEPT
          </button>
        )}

        {ticket.status === 'IN_PROGRESS' && (
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            {!canComplete ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                  <span>Progress</span>
                  <span className="text-orange-600">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-100" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button 
                onClick={onComplete}
                className="w-full bg-green-600 text-white text-[11px] font-black py-3 rounded-lg hover:bg-green-700 transition-all animate-pulse"
              >
                COMPLETE
              </button>
            )}
          </div>
        )}

        {ticket.status === 'RESOLVED' && (
          <div className="bg-green-50 py-4 text-center border-t border-green-100">
            <span className="text-[11px] font-black text-green-700 uppercase tracking-widest">Resolved</span>
          </div>
        )}
      </div>
    </div>
  );
}
