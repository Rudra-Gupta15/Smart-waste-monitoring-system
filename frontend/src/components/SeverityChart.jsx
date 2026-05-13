import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = { LOW: '#facc15', MEDIUM: '#f97316', HIGH: '#ef4444', CRITICAL: '#dc2626' };

export default function SeverityChart({ severityCounts }) {
  const data = Object.entries(severityCounts || {}).map(([name, value]) => ({
    name, value, fill: COLORS[name] || '#6b7280',
  }));

  if (data.every(d => d.value === 0)) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
        <h3 className="text-white font-semibold text-sm mb-3">Severity Distribution</h3>
        <div className="text-gray-500 text-center py-8 text-sm">No data yet</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
      <h3 className="text-white font-semibold text-sm mb-3">Severity Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
