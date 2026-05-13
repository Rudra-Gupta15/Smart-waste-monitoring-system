import React, { useState, useEffect, useRef } from 'react';
import { acceptTicket, resolveTicket } from '../services/api';
import { toast } from 'react-hot-toast';

const STATUS_COLUMNS = [
  { id: 'OPEN', label: 'Open', color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'RESOLVED', label: 'Resolved', color: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50' },
];

const severityColors = {
  LOW: 'bg-yellow-400', MEDIUM: 'bg-orange-400', HIGH: 'bg-red-500', CRITICAL: 'bg-red-700',
};

export default function TicketBoard({ tickets, setTickets, readOnly = false }) {
  const [selected, setSelected] = useState(null);
  const [timers, setTimers] = useState({}); // ticketId -> startTime

  // Cleanup expired timers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          // Keep timers for 1 hour then cleanup
          if (now - next[id] > 3600000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (ticketId, workerId) => {
    try {
      const res = await acceptTicket(ticketId, workerId);
      if (res.status === 'accepted') {
        setTimers(prev => ({ ...prev, [ticketId]: Date.now() }));
        // Optimistic update
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'IN_PROGRESS', accepted_at: Date.now()/1000 } : t));
        toast.success(`Ticket ${ticketId} accepted. Processing...`);
      }
    } catch (err) {
      toast.error("Failed to accept ticket");
    }
  };

  const handleResolve = async (ticketId) => {
    try {
      await resolveTicket(ticketId);
      setTimers(prev => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      // Optimistic update
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'RESOLVED', resolved_at: Date.now()/1000 } : t));
      toast.success(`Ticket ${ticketId} resolved and completed!`);
    } catch (err) {
      toast.error("Failed to resolve ticket");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">AI Dispatch Board</h3>
        <div className="flex gap-2">
          {STATUS_COLUMNS.map(col => (
            <div key={col.id} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
              <span className={`w-2 h-2 rounded-full ${col.color}`}></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{col.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 h-full">
        {STATUS_COLUMNS.map(col => {
          const colTickets = tickets.filter(t => {
            if (col.id === 'OPEN') return t.status === 'OPEN' || t.status === 'ASSIGNED';
            return t.status === col.id;
          }).sort((a, b) => a.priority - b.priority);

          return (
            <div key={col.id} className="flex flex-col h-full bg-slate-100/50 rounded-2xl border border-slate-200/60 overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-white/50 backdrop-blur-sm border-b border-slate-200/60 flex-shrink-0">
                <h4 className={`text-sm font-black uppercase tracking-[0.2em] ${col.text}`}>{col.label}</h4>
                <span className="bg-white border border-slate-200 px-2.5 py-0.5 rounded-full text-xs font-black text-slate-500 shadow-sm">
                  {colTickets.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar">
                {colTickets.map(t => (
                  <TicketCard 
                    key={t.id} 
                    ticket={t} 
                    startTime={timers[t.id]} 
                    onAccept={() => handleAccept(t.id, t.assigned_worker?.id)}
                    onComplete={() => handleResolve(t.id)}
                    onSelect={() => setSelected(t)}
                    readOnly={readOnly}
                  />
                ))}
                {colTickets.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 opacity-40">
                    <span className="text-3xl mb-2">▤</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest">Queue Clear</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ticket Detail Modal (Existing logic preserved, styled improved) */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-slate-200 text-slate-800 overflow-hidden relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">{selected.id}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Maintenance Record</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all text-xl">&times;</button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Status & Priority</p>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold text-white ${severityColors[selected.severity]}`}>{selected.severity}</span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">{selected.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Location</p>
                  <p className="text-sm font-bold text-slate-800 leading-snug">{selected.location.address}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.location.ward} • {selected.location.zone}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Assigned Agent</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
                      {selected.assigned_worker?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{selected.assigned_worker?.name}</p>
                      <p className="text-[10px] text-slate-500">{selected.assigned_worker?.phone}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">AI Insights</p>
                  <p className="text-xs font-medium text-slate-700">{selected.object_count} items • {selected.categories?.join(', ')}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Audit Logs</p>
              <div className="space-y-2.5">
                <LogEntry label="Detected" time={selected.created_at} active />
                {selected.accepted_at && <LogEntry label="In Progress" time={selected.accepted_at} active />}
                {selected.resolved_at && <LogEntry label="Resolved" time={selected.resolved_at} active />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, startTime, onAccept, onComplete, onSelect, readOnly }) {
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
    <div 
      className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
    >
      <div className="p-4 flex-1 cursor-pointer" onClick={onSelect}>
        <div className="flex justify-between items-start mb-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{ticket.id}</span>
          <span className={`w-2.5 h-2.5 rounded-full ${severityColors[ticket.severity]} shadow-sm`}></span>
        </div>
        
        <h5 className="text-sm font-bold text-slate-800 leading-tight mb-1 group-hover:text-blue-600 transition-colors">{ticket.location.address}</h5>
        <p className="text-[10px] text-slate-400 font-medium">{ticket.location.zone} • {ticket.object_count} obj</p>
        
        <div className="mt-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500">
            {ticket.assigned_worker?.name?.charAt(0)}
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{ticket.assigned_worker?.name}</span>
        </div>
      </div>

      {/* Dynamic Action Zone - Only show if NOT read-only */}
      {!readOnly && (
        <div className="bg-slate-50 border-t border-slate-100 p-3">
          {(ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              className="w-full bg-slate-900 text-white text-xs font-black py-2.5 rounded-xl hover:bg-blue-600 transition-all active:scale-95 shadow-sm"
            >
              ACCEPT TASK
            </button>
          )}

          {ticket.status === 'IN_PROGRESS' && (
            <div className="space-y-3">
              {!canComplete ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Processing</span>
                    <span>{Math.round(progress)}%</span>
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
                  onClick={(e) => { e.stopPropagation(); onComplete(); }}
                  className="w-full bg-green-600 text-white text-xs font-black py-2.5 rounded-xl hover:bg-green-700 transition-all animate-bounce shadow-md"
                >
                  COMPLETE WORK
                </button>
              )}
            </div>
          )}

          {ticket.status === 'RESOLVED' && (
            <div className="flex items-center justify-center gap-2 py-1 text-green-600">
              <span className="text-xs font-black uppercase tracking-widest italic">✓ Resolved</span>
            </div>
          )}
        </div>
      )}

      {readOnly && ticket.status === 'RESOLVED' && (
        <div className="bg-green-50 border-t border-green-100 p-3 flex items-center justify-center gap-2 text-green-600">
          <span className="text-xs font-black uppercase tracking-widest italic">✓ Resolved</span>
        </div>
      )}
    </div>
  );
}

function LogEntry({ label, time, active }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-300'}`}></div>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${active ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
      </div>
      <span className="text-[10px] font-mono text-slate-400">{new Date(time * 1000).toLocaleTimeString()}</span>
    </div>
  );
}
