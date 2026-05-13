import React, { useState } from 'react';

const STATUS_COLUMNS = [
  { id: 'OPEN', label: 'Open', color: 'border-blue-500', bg: 'bg-blue-500/10' },
  { id: 'ASSIGNED', label: 'Assigned', color: 'border-purple-500', bg: 'bg-purple-500/10' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'RESOLVED', label: 'Resolved', color: 'border-green-500', bg: 'bg-green-500/10' },
];

const severityColors = {
  LOW: 'bg-yellow-500', MEDIUM: 'bg-orange-500', HIGH: 'bg-red-500', CRITICAL: 'bg-red-700',
};

export default function TicketBoard({ tickets }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ticket Board ({tickets.length} total)</h3>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map(col => {
          const colTickets = tickets.filter(t => {
            if (col.id === 'OPEN') return t.status === 'OPEN' || t.status === 'ASSIGNED';
            return t.status === col.id;
          }).sort((a, b) => a.priority - b.priority);

          if (col.id === 'ASSIGNED') return null; // merged into OPEN

          return (
            <div key={col.id} className="bg-gray-800/50 rounded-xl p-3">
              <div className={`flex items-center justify-between mb-3 pb-2 border-b ${col.color}`}>
                <span className="text-sm font-medium">{col.label}</span>
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">{colTickets.length}</span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {colTickets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`${col.bg} border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gray-500 transition-colors`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono">{t.id}</span>
                      <span className={`w-2 h-2 rounded-full ${severityColors[t.severity]}`}></span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2 line-clamp-1">{t.location.address}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityColors[t.severity]}/20 text-white`}>
                        {t.severity} - P{t.priority}
                      </span>
                      <span className="text-[10px] text-gray-400">{t.object_count} obj</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[8px]">
                        {t.assigned_worker?.name?.charAt(0)}
                      </div>
                      <span className="text-[10px] text-gray-400">{t.assigned_worker?.name}</span>
                    </div>
                  </div>
                ))}
                {colTickets.length === 0 && (
                  <div className="text-center py-6 text-gray-600 text-xs">Empty</div>
                )}
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>

      {/* Ticket Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-lg">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded text-xs text-white ${severityColors[selected.severity]}`}>{selected.severity}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{selected.status}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-gray-700">Priority {selected.priority}</span>
              </div>

              <div>
                <p className="text-gray-400 text-xs">Location</p>
                <p>{selected.location.address}</p>
                <p className="text-xs text-gray-500">{selected.location.ward} - {selected.location.zone}</p>
                <p className="text-xs text-gray-500">GPS: {selected.location.lat}, {selected.location.lng}</p>
              </div>

              <div>
                <p className="text-gray-400 text-xs">Assigned Worker</p>
                <p>{selected.assigned_worker?.name} ({selected.assigned_worker?.zone})</p>
                <p className="text-xs text-gray-500">{selected.assigned_worker?.phone}</p>
              </div>

              <div>
                <p className="text-gray-400 text-xs">Detection Details</p>
                <p>{selected.object_count} objects detected | {selected.detection_count} sighting(s)</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.categories?.map((c, i) => (
                    <span key={i} className="text-xs bg-gray-700 px-2 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs">Timeline</p>
                <div className="text-xs space-y-1">
                  <p>Created: {new Date(selected.created_at * 1000).toLocaleString()}</p>
                  {selected.accepted_at && <p>Accepted: {new Date(selected.accepted_at * 1000).toLocaleString()}</p>}
                  {selected.resolved_at && <p>Resolved: {new Date(selected.resolved_at * 1000).toLocaleString()}</p>}
                  <p>SLA: {selected.sla_hours} hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
