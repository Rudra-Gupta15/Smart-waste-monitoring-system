import React from 'react';

const typeIcons = {
  TICKET_ACCEPTED: { icon: '✓', color: 'text-green-400' },
  TICKET_RESOLVED: { icon: '★', color: 'text-blue-400' },
};

export default function NotificationPanel({ notifications, onClose, onMarkRead }) {
  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 z-50 shadow-2xl slide-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
      </div>
      <div className="overflow-y-auto h-[calc(100%-48px)] p-3 space-y-2">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <p>No notifications yet</p>
            <p className="text-xs mt-1">You'll be notified when workers accept tickets</p>
          </div>
        ) : (
          notifications.map(n => {
            const t = typeIcons[n.type] || { icon: '●', color: 'text-gray-400' };
            return (
              <div
                key={n.id}
                className={`p-3 rounded-lg border ${n.read ? 'bg-slate-50 border-slate-100' : 'bg-white border-blue-100 shadow-sm'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm ${t.color}`}>{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${n.read ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>{n.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">
                        {new Date(n.timestamp * 1000).toLocaleTimeString()}
                      </span>
                      {!n.read && (
                        <button
                          onClick={() => onMarkRead(n.id)}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
