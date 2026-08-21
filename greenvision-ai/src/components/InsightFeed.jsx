import { AlertCircle, BellRing, Sparkles, CheckCircle2 } from 'lucide-react';

const iconMap = {
  critical: <AlertCircle size={16} className="text-red-400" />,
  warning: <BellRing size={16} className="text-earth" />,
  alert: <AlertCircle size={16} className="text-databue" />,
  success: <CheckCircle2 size={16} className="text-canopy" />,
};

export default function InsightFeed({ insights = [] }) {
  if (!insights.length) return null;

  return (
    <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 mb-8 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-canopy" />
        <h4 className="font-mono text-xs uppercase tracking-wider text-mist-dim light:text-ink/60 font-semibold">
          AI INSIGHT FEED
        </h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {insights.map((item) => (
          <div key={item.id} className="bg-white/5 light:bg-black/5 border border-white/5 light:border-black/5 rounded-xl p-3.5 flex flex-col justify-between gap-2 hover:border-canopy/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {iconMap[item.type] || <Sparkles size={16} className="text-canopy" />}
                <span className="font-display font-semibold text-xs text-mist light:text-ink">{item.title}</span>
              </div>
              <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">{item.time}</span>
            </div>
            <p className="text-xs text-mist-dim light:text-ink/70 leading-relaxed">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
