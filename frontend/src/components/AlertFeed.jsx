import React from 'react';

const severityStyle = {
  LOW: 'border-yellow-500 bg-yellow-500/10',
  MEDIUM: 'border-orange-500 bg-orange-500/10',
  HIGH: 'border-red-500 bg-red-500/10',
  CRITICAL: 'border-red-700 bg-red-700/10 alert-pulse',
};

const categoryColor = {
  'Paper/Stationery': 'bg-amber-600',
  'Food Waste': 'bg-green-600',
  'Container/Utensil': 'bg-blue-600',
  'Abandoned Item': 'bg-purple-600',
  'E-Waste': 'bg-orange-600',
  'Household Waste': 'bg-red-500',
  'Misc Waste': 'bg-cyan-600',
};

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString();
}

export default function AlertFeed({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 h-full">
        <h3 className="text-slate-800 font-semibold text-sm mb-4">Live Detection Feed</h3>
        <div className="text-slate-400 text-center py-8">
          <p className="text-sm">Monitoring active...</p>
          <p className="text-xs mt-1">Events appear when waste is detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 h-full">
      <h3 className="text-slate-800 font-semibold text-sm mb-2">Live Feed ({events.length})</h3>
      <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
        {events.map((evt, i) => (
          <div
            key={i}
            className={`border-l-3 rounded-r-lg px-2.5 py-2 border-l-4 shadow-sm ${severityStyle[evt.severity] || 'border-slate-300 bg-slate-50'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${
                  evt.severity === 'CRITICAL' ? 'bg-red-700' :
                  evt.severity === 'HIGH' ? 'bg-red-500' :
                  evt.severity === 'MEDIUM' ? 'bg-orange-500' : 'bg-yellow-500'
                }`}>{evt.severity}</span>
                <span className="text-slate-700 text-xs font-medium">
                  {evt.object_count} object{evt.object_count > 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-slate-400 text-[10px]">{formatTime(evt.timestamp)}</span>
            </div>
            {evt.categories && (
              <div className="flex flex-wrap gap-1 mt-1">
                {[...new Set(evt.categories)].map((cat, j) => (
                  <span key={j} className={`text-[9px] px-1.5 py-0.5 rounded text-white ${categoryColor[cat] || 'bg-gray-600'}`}>{cat}</span>
                ))}
              </div>
            )}
            {evt.classes && (
              <div className="flex flex-wrap gap-1 mt-1">
                {evt.classes.map((cls, j) => (
                  <span key={j} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{cls}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
