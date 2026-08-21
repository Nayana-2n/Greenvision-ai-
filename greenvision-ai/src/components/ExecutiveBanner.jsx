import { ShieldAlert, Activity } from 'lucide-react';
import CountUp from './CountUp';

export default function ExecutiveBanner({ cityHealth }) {
  if (!cityHealth) return null;

  const score = cityHealth.score ?? null;

  return (
    <div className="bg-gradient-to-r from-panel via-panel/90 to-canopy/10 light:from-white light:via-white light:to-canopy/5 border border-white/10 light:border-black/10 rounded-3xl p-6 md:p-8 shadow-xl mb-8 relative overflow-hidden">
      {/* Background glow circle */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-canopy/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="grid lg:grid-cols-12 gap-6 items-center relative z-10">
        
        {/* Canopy Attainment Dial */}
        <div className="lg:col-span-4 flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-white/10 light:border-black/10 pb-6 lg:pb-0 lg:pr-6">
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="38" className="stroke-white/10 light:stroke-black/10" strokeWidth="8" fill="none" />
              {score != null && (
                <circle 
                  cx="48" cy="48" r="38" 
                  className="stroke-earth transition-all duration-1000" 
                  strokeWidth="8" fill="none"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={2 * Math.PI * 38 * (1 - score / 100)}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-display font-bold text-2xl text-mist light:text-ink">
                {score != null ? <CountUp end={score} /> : '—'}
              </span>
              <span className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">/100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={16} className="text-earth" />
              <span className="text-xs font-mono uppercase tracking-wider text-mist-dim light:text-ink/60">CANOPY ATTAINMENT</span>
            </div>
            <h3 className="font-display text-xl font-semibold text-mist light:text-ink flex items-center gap-2">
              Status: <span className={cityHealth.statusColor}>{cityHealth.status}</span>
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cityHealth.topRisks.map((risk, i) => (
                <span key={i} className="text-[10px] font-mono bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 px-2 py-0.5 rounded-md text-mist-dim light:text-ink/70">
                  {risk}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Priority Action */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-3 bg-earth/10 border border-earth/20 rounded-2xl p-4">
            <ShieldAlert size={20} className="text-earth shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs font-mono font-bold text-earth uppercase tracking-wider">
                RECOMMENDED INTERVENTION
              </span>
              <p className="text-sm font-medium text-mist light:text-ink mt-1">
                {cityHealth.immediateAction}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
