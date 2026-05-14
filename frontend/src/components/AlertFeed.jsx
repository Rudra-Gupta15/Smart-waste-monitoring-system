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

export default function AlertFeed({ events, currentAreaName }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 h-full flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-slate-800 font-semibold text-sm">
          Live Feed {events && events.length > 0 ? `(${events.length})` : ''}
        </h3>

        {/* Live location pill — shows real GPS area name */}
        {currentAreaName && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-[9px] font-black text-green-700 uppercase tracking-wider truncate max-w-[130px]">
              {currentAreaName}
            </span>
          </div>
        )}
      </div>

      {/* ── Empty State ── */}
      {(!events || events.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <p className="text-sm">Monitoring active...</p>
          <p className="text-xs mt-1">Events appear when waste is detected</p>
        </div>
      ) : (
        /* ── Event Cards ── */
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {events.map((evt, i) => {
            // Use the geocoded name from backend; fall back to currentAreaName
            const areaLabel =
              evt.area && evt.area !== 'Unknown' && evt.area !== 'Nagpur Central'
                ? evt.area
                : (currentAreaName || evt.area || 'Nagpur Central');

            return (
              <div
                key={`${evt.timestamp}-${i}`}
                className={`border-l-3 rounded-r-lg px-2.5 py-2 border-l-4 shadow-sm ${severityStyle[evt.severity] || 'border-slate-300 bg-slate-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${
                      evt.severity === 'CRITICAL' ? 'bg-red-700' :
                      evt.severity === 'HIGH'     ? 'bg-red-500' :
                      evt.severity === 'MEDIUM'   ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}>{evt.severity}</span>
                    <span className="text-slate-700 text-xs font-medium">
                      {evt.object_count} object{evt.object_count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[9px]">{formatTime(evt.timestamp)}</div>
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
