import React from 'react';

const severityStyle = {
  LOW: 'border-amber-400 bg-amber-50/50 text-amber-900 shadow-amber-100/50',
  MEDIUM: 'border-orange-500 bg-orange-50/50 text-orange-900 shadow-orange-100/50',
  HIGH: 'border-rose-500 bg-rose-50/50 text-rose-900 shadow-rose-100/50',
  CRITICAL: 'border-red-600 bg-red-50/50 text-red-900 shadow-red-200/50 alert-pulse',
};

const categoryColor = {
  'Paper/Stationery': 'bg-amber-100 text-amber-700 border-amber-200',
  'Food Waste': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Container/Utensil': 'bg-blue-100 text-blue-700 border-blue-200',
  'Abandoned Item': 'bg-violet-100 text-violet-700 border-violet-200',
  'E-Waste': 'bg-orange-100 text-orange-700 border-orange-200',
  'Household Waste': 'bg-rose-100 text-rose-700 border-rose-200',
  'Misc Waste': 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AlertFeed({ events, currentAreaName }) {
  return (
    <div className="bg-white rounded-md p-3 h-full flex flex-col transition-all">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-rose-500 rounded-sm animate-pulse"></div>
          <h3 className="text-slate-900 font-black text-xs uppercase tracking-widest">
            Live Intelligence {events && events.length > 0 ? `(${events.length})` : ''}
          </h3>
        </div>

        {/* Live location pill */}
        {currentAreaName && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md shadow-sm">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px]">
              {currentAreaName}
            </span>
          </div>
        )}
      </div>

      {/* ── Empty State ── */}
      {(!events || events.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-md border border-dashed border-slate-200">
          <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center mb-3">
            <span className="text-xl">📡</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest">Scanning Nagpur...</p>
          <p className="text-[9px] mt-1 opacity-60">No active detections in last 30s</p>
        </div>
      ) : (
        /* ── Event Cards ── */
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
          {events.map((evt, i) => {
            const style = severityStyle[evt.severity] || 'border-slate-200 bg-slate-50 text-slate-800';

            return (
              <div
                key={`${evt.timestamp}-${i}`}
                className={`
                  relative border-l-4 rounded-md p-3 shadow-sm transition-all hover:shadow-md 
                  hover:scale-[1.01] active:scale-95 cursor-default border ${style}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`
                      text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter
                      ${evt.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 
                        evt.severity === 'HIGH' ? 'bg-rose-500 text-white' : 
                        evt.severity === 'MEDIUM' ? 'bg-orange-500 text-white' : 'bg-amber-500 text-white'}
                    `}>
                      {evt.severity}
                    </span>
                    <span className="text-slate-900 text-xs font-black tracking-tight">
                      {evt.object_count} Object{evt.object_count > 1 ? 's' : ''} Identified
                    </span>
                  </div>
                  <div className="text-slate-400 text-[9px] font-mono font-bold tracking-tighter">
                    {formatTime(evt.timestamp)}
                  </div>
                </div>

                {/* Categories & Classes */}
                <div className="space-y-1.5">
                  {evt.categories && (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(evt.categories)].map((cat, j) => (
                        <span key={j} className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${categoryColor[cat] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {evt.classes && (
                    <div className="flex flex-wrap gap-1">
                      {evt.classes.slice(0, 4).map((cls, j) => (
                        <span key={j} className="text-[8px] bg-white/60 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200/50 uppercase font-black tracking-widest">
                          {cls}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Decorative background icon */}
                <div className="absolute right-2 bottom-2 text-2xl opacity-[0.05] pointer-events-none grayscale">
                  {evt.categories?.includes('Food Waste') ? '🍎' : 
                   evt.categories?.includes('E-Waste') ? '💻' : 
                   evt.categories?.includes('Abandoned Item') ? '📦' : '🗑️'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


