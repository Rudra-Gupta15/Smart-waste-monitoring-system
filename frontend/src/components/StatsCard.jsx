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
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.blue} rounded-xl p-4 text-white shadow-lg`}>
      <p className="text-[11px] opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
      {subtitle && <p className="text-[10px] opacity-70 mt-0.5">{subtitle}</p>}
    </div>
  );
}
