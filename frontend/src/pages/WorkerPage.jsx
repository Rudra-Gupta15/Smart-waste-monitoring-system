import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWorkers, fetchWorkerTickets, acceptTicket, resolveTicket } from '../services/api';

const severityColors = {
  LOW: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' },
  MEDIUM: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500' },
  HIGH: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500' },
  CRITICAL: { bg: 'bg-red-700/20', text: 'text-red-300', border: 'border-red-700' },
};

const statusConfig = {
  OPEN: { label: 'New', bg: 'bg-blue-500', action: 'Accept' },
  ASSIGNED: { label: 'Assigned', bg: 'bg-purple-500', action: 'Accept' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-yellow-500', action: 'Mark Resolved' },
  RESOLVED: { label: 'Resolved', bg: 'bg-green-500', action: null },
};

export default function WorkerPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  // Load workers
  useEffect(() => {
    fetchWorkers().then(data => {
      setWorkers(data.workers || []);
    }).catch(() => {});
  }, []);

  // Load tickets for selected worker
  useEffect(() => {
    if (!selectedWorker) return;
    const load = () => {
      fetchWorkerTickets(selectedWorker.id).then(data => {
        setTickets(data.tickets || []);
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [selectedWorker]);

  const handleAccept = async (ticket) => {
    setLoading(true);
    try {
      const res = await acceptTicket(ticket.id, selectedWorker.id);
      if (res.status === 'accepted') {
        toast.success(`Ticket ${ticket.id} accepted! Head to ${ticket.location.address}`);
        // Refresh
        const data = await fetchWorkerTickets(selectedWorker.id);
        setTickets(data.tickets || []);
      } else {
        toast.error(res.error || 'Failed to accept');
      }
    } catch {
      toast.error('Network error');
    }
    setLoading(false);
  };

  const handleResolve = async (ticket) => {
    setLoading(true);
    try {
      const res = await resolveTicket(ticket.id);
      if (res.status === 'resolved') {
        toast.success(`Ticket ${ticket.id} resolved! Great work!`);
        const data = await fetchWorkerTickets(selectedWorker.id);
        setTickets(data.tickets || []);
      } else {
        toast.error(res.error || 'Failed to resolve');
      }
    } catch {
      toast.error('Network error');
    }
    setLoading(false);
  };

  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED');
  const resolvedTickets = tickets.filter(t => t.status === 'RESOLVED');
  const displayTickets = activeTab === 'active' ? activeTickets : resolvedTickets;

  // Worker selection screen
  if (!selectedWorker) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Toaster position="top-center" />
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">W</div>
            <h1 className="text-xl font-bold">Smart Waste Worker</h1>
            <p className="text-sm text-gray-400 mt-1">Select your profile to continue</p>
          </div>
          <div className="space-y-3">
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4 hover:border-green-500 transition-colors text-left"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {w.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-gray-400">{w.zone} Zone | {w.id}</p>
                </div>
                <div className="text-right">
                  <span className={`block w-2 h-2 rounded-full ml-auto ${w.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-[10px] text-gray-500">{w.active_tickets} active</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-center" toastOptions={{
        style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' },
      }} />

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedWorker(null)}
              className="text-gray-400 hover:text-white text-sm"
            >
              &larr;
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              {selectedWorker.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{selectedWorker.name}</p>
              <p className="text-[10px] text-gray-400">{selectedWorker.zone} Zone</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-400">{activeTickets.length}</p>
            <p className="text-[10px] text-gray-400">Active Tasks</p>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-400">{tickets.length}</p>
            <p className="text-[10px] text-gray-400">Total</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-orange-400">{activeTickets.length}</p>
            <p className="text-[10px] text-gray-400">Active</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-400">{resolvedTickets.length}</p>
            <p className="text-[10px] text-gray-400">Done</p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="max-w-lg mx-auto px-4">
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'active' ? 'bg-green-600 text-white' : 'text-gray-400'
            }`}
          >
            Active ({activeTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'resolved' ? 'bg-green-600 text-white' : 'text-gray-400'
            }`}
          >
            Resolved ({resolvedTickets.length})
          </button>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-20">
        {displayTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-3">{activeTab === 'active' ? '✓' : '□'}</p>
            <p className="text-sm">{activeTab === 'active' ? 'No active tasks!' : 'No resolved tasks yet'}</p>
            <p className="text-xs mt-1 text-gray-600">
              {activeTab === 'active' ? 'New tickets will appear here automatically' : 'Completed work will show here'}
            </p>
          </div>
        ) : (
          displayTickets.sort((a, b) => a.priority - b.priority).map(ticket => {
            const sev = severityColors[ticket.severity] || severityColors.MEDIUM;
            const status = statusConfig[ticket.status] || statusConfig.OPEN;
            return (
              <div key={ticket.id} className={`bg-gray-800 rounded-xl border-l-4 ${sev.border} overflow-hidden`}>
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-gray-400">{ticket.id}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>
                        {ticket.severity}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${status.bg}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <h3 className="text-sm font-medium mb-1">{ticket.location.address}</h3>
                  <p className="text-xs text-gray-400">{ticket.location.ward} | {ticket.location.zone}</p>

                  {/* Details */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ticket.categories?.map((c, i) => (
                      <span key={i} className="text-[10px] bg-gray-700 px-2 py-0.5 rounded">{c}</span>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{ticket.object_count} objects | P{ticket.priority}</span>
                    <span>SLA: {ticket.sla_hours}h</span>
                  </div>

                  {/* Navigation link */}
                  <a
                    href={`https://www.google.com/maps?q=${ticket.location.lat},${ticket.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
                  >
                    Open in Google Maps &rarr;
                  </a>
                </div>

                {/* Action Button */}
                {status.action && (
                  <button
                    onClick={() => ticket.status === 'IN_PROGRESS' ? handleResolve(ticket) : handleAccept(ticket)}
                    disabled={loading}
                    className={`w-full py-3 text-sm font-medium transition-colors ${
                      ticket.status === 'IN_PROGRESS'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } ${loading ? 'opacity-50' : ''}`}
                  >
                    {loading ? 'Processing...' : status.action}
                  </button>
                )}

                {ticket.status === 'RESOLVED' && (
                  <div className="bg-green-600/10 px-4 py-2 text-center">
                    <span className="text-xs text-green-400">
                      Resolved at {new Date(ticket.resolved_at * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
