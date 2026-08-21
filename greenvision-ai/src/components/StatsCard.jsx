export default function StatsCard({ icon: Icon, label, value, unit, accent = 'text-canopy', accentBg = 'bg-canopy/10', trend }) {
  return (
    <div className="group relative bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-default">
      
      {/* Gradient top edge accent line */}
      <div className={`absolute top-0 left-6 right-6 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent ${accent.replace('text-', 'via-')} to-transparent`} />
      
      {/* Icon + Label row */}
      <div className="flex items-center justify-between">
        <span className="text-mist-dim light:text-ink/55 text-xs font-mono uppercase tracking-widest font-medium">{label}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl ${accentBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon size={18} className={accent} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="font-display font-bold text-3xl md:text-4xl text-mist light:text-ink leading-none">
        {value}
        {unit && <span className="text-mist-dim light:text-ink/50 text-lg ml-1.5 font-medium">{unit}</span>}
      </div>

      {/* Optional trend label */}
      {trend && (
        <p className="text-[11px] font-mono text-mist-dim light:text-ink/50">{trend}</p>
      )}
    </div>
  );
}
