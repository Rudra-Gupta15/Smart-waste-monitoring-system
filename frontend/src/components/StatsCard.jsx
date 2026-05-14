import React from 'react';

const colorMap = {
  blue: {
    gradient: 'from-blue-600 to-blue-700',
    bg: 'bg-blue-50/50',
    text: 'text-blue-700',
    shadow: 'shadow-blue-200/50',
    border: 'border-blue-100'
  },
  green: {
    gradient: 'from-emerald-600 to-emerald-700',
    bg: 'bg-emerald-50/50',
    text: 'text-emerald-700',
    shadow: 'shadow-emerald-200/50',
    border: 'border-emerald-100'
  },
  orange: {
    gradient: 'from-orange-500 to-orange-600',
    bg: 'bg-orange-50/50',
    text: 'text-orange-700',
    shadow: 'shadow-orange-200/50',
    border: 'border-orange-100'
  },
  red: {
    gradient: 'from-rose-600 to-rose-700',
    bg: 'bg-rose-50/50',
    text: 'text-rose-700',
    shadow: 'shadow-rose-200/50',
    border: 'border-rose-100'
  },
  purple: {
    gradient: 'from-violet-600 to-violet-700',
    bg: 'bg-violet-50/50',
    text: 'text-violet-700',
    shadow: 'shadow-violet-200/50',
    border: 'border-violet-100'
  },
  cyan: {
    gradient: 'from-cyan-600 to-cyan-700',
    bg: 'bg-cyan-50/50',
    text: 'text-cyan-700',
    shadow: 'shadow-cyan-200/50',
    border: 'border-cyan-100'
  },
};

export default function StatsCard({ title, value, subtitle, color = 'blue' }) {
  const styles = colorMap[color] || colorMap.blue;
  
  return (
    <div className={`
      relative overflow-hidden bg-white rounded-md p-3 border ${styles.border} 
      shadow-sm hover:shadow-lg hover:${styles.shadow} transition-all duration-300 
      group hover:-translate-y-0.5 flex flex-col justify-between h-full
    `}>
      {/* Decorative Gradient Background Blur */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br ${styles.gradient} opacity-[0.03] rounded-full blur-2xl group-hover:opacity-10 transition-opacity`}></div>
      
      {/* Accent Line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${styles.gradient}`}></div>
      
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{title}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        </div>
      </div>
      
      {subtitle && (
        <div className={`mt-2 flex items-center gap-1.5 px-2 py-1 ${styles.bg} rounded-md border border-transparent group-hover:${styles.border} transition-colors`}>
          <span className={`w-1 h-1 rounded-full bg-current ${styles.text}`}></span>
          <p className={`text-[9px] font-bold uppercase tracking-wide ${styles.text}`}>{subtitle}</p>
        </div>
      )}
    </div>
  );
}



