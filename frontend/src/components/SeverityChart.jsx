import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = { LOW: '#facc15', MEDIUM: '#f97316', HIGH: '#ef4444', CRITICAL: '#dc2626' };

export default function SeverityChart({ severityCounts }) {
  const data = Object.entries(severityCounts || {}).map(([name, value]) => ({
    name, value, fill: COLORS[name] || '#6b7280',
  }));

  if (data.every(d => d.value === 0)) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="text-slate-800 font-semibold text-sm mb-3">Severity Distribution</h3>
        <div className="text-slate-400 text-center py-8 text-sm">No data yet</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-slate-800 font-semibold text-sm mb-3">Severity Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
          <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }} labelStyle={{ color: '#0f172a' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
