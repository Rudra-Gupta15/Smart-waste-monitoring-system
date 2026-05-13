import React from 'react';

const colorMap = {
  blue: 'from-blue-600 to-blue-800',
  green: 'from-green-600 to-green-800',
  orange: 'from-orange-500 to-orange-700',
  red: 'from-red-600 to-red-800',
  purple: 'from-purple-600 to-purple-800',
  cyan: 'from-cyan-600 to-cyan-800',
};

export default function StatsCard({ title, value, subtitle, color = 'blue' }) {
  return (
    <div className="bg-white rounded-xl p-4 text-slate-800 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${colorMap[color] || colorMap.blue}`}></div>
      <p className="text-[11px] text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-bold mt-1 text-slate-900">{value}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
