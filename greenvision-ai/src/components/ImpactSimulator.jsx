import { useState, useEffect, useMemo } from 'react';
import { TreePine, Cloud, Wind, MapPin, Target, DollarSign, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { simulateClimate, extractError } from '../api/api';
import { computeTargetGap, buildSceneBaseline } from '../utils/sceneMath';


function SourceTag({ level }) {
  const s = { MEASURED: 'bg-canopy/15 text-canopy border-canopy/25', CALCULATED: 'bg-databue/15 text-databue border-databue/25', ESTIMATED: 'bg-amber-500/15 text-amber-400 border-amber-500/25', UNAVAILABLE: 'bg-red-500/15 text-red-400 border-red-500/25', PLANNED: 'bg-purple-500/15 text-purple-400 border-purple-500/25' };
  return <span className={`text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded border ${s[level] || s.CALCULATED}`}>{level}</span>;
}

function ProgressBar({ value, max = 100, color = 'bg-canopy', label }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (<div className="w-full"><div className="w-full h-2.5 bg-white/10 light:bg-black/10 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} /></div>{label && <p className="text-[9px] font-mono text-mist-dim light:text-ink/40 mt-1">{label}</p>}</div>);
}

export default function ImpactSimulator({ scene }) {
  const baseline = useMemo(() => buildSceneBaseline(scene), [scene]);
  const gap = useMemo(() => computeTargetGap(scene, baseline), [scene, baseline]);
  const presets = [100, 250, 500, 1000];
  const [treeCount, setTreeCount] = useState(500);
  const [sim, setSim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const t = setTimeout(() => {
      simulateClimate(treeCount, baseline)
        .then(r => { if (!cancelled) setSim(r); })
        .catch(e => { if (!cancelled) setError(extractError(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [treeCount, baseline]);

  const projected = sim?.projected;
  const budget = sim?.budget;
  const canopyData = sim?.canopy;
  const baseCanopy = baseline?.canopy_percentage ?? null;
  const baseTrees = baseline?.estimated_trees ?? null;
  const baseCarbon = scene?.carbon_tonnes_per_year ?? scene?.carbon ?? null;
  const baseOxygen = scene?.oxygen_tonnes_per_year ?? scene?.oxygen ?? null;
  const target = 60;
  const afterCarbon = projected?.carbon_tonnes_per_year ?? null;
  const afterOxygen = projected?.oxygen_tonnes_per_year ?? null;
  const afterCanopy = canopyData?.modeled ? canopyData.projected_canopy_percentage : null;
  const remainingGap = gap ? Math.max(0, gap.trees_needed - treeCount) : null;
  const invFmt = budget?.available ? budget.total_estimate_inr_formatted : null;

  return (
    <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 md:p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b border-white/10 light:border-black/10 pb-6">
        <div>
          <span className="text-[10px] font-mono text-canopy font-semibold uppercase tracking-wider">IMPACT SIMULATOR</span>
          <h2 className="font-display text-xl md:text-2xl font-bold text-mist light:text-ink flex items-center gap-2 mt-1">
            <TreePine size={20} className="text-canopy" /> What Happens If We Plant?
          </h2>
        </div>
        <div className="bg-canopy/15 text-canopy font-mono text-[10px] font-semibold px-3 py-1.5 rounded-full border border-canopy/25">Instant calculation</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin size={11} /> WHERE?</p>
          <p className="text-xs text-mist light:text-ink leading-relaxed">{scene?.locationName || scene?.image_name || 'Priority area identified from the analyzed scene.'}</p>
          {scene?.gps && <p className="text-[9px] font-mono text-mist-dim light:text-ink/40 mt-1">{scene.gps.lat?.toFixed(4)}, {scene.gps.lng?.toFixed(4)}</p>}
        </div>
        <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><AlertTriangle size={11} /> WHY?</p>
          <p className="text-xs text-mist light:text-ink leading-relaxed">
            {baseCanopy != null ? `Current green cover is ${baseCanopy}% — ${baseCanopy < target ? `${target - baseCanopy} points below` : 'at or above'} the ${target}% target.${scene?.plantation_priority === 'High' ? ' High plantation priority.' : ''}` : 'Green cover analysis needed for priority assessment.'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label className="font-display font-semibold text-sm text-mist light:text-ink flex items-center gap-2 mb-3">
          <TreePine size={16} className="text-canopy" /> Trees to Plant: <span className="text-canopy font-bold text-xl font-mono">{treeCount.toLocaleString()}</span>
        </label>
        <input type="range" min={100} max={10000} step={50} value={treeCount} onChange={e => setTreeCount(parseInt(e.target.value))} className="w-full h-2.5 bg-white/10 light:bg-black/10 rounded-lg appearance-none cursor-pointer accent-canopy" />
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map(p => (<button key={p} onClick={() => setTreeCount(p)} className={`text-[11px] font-mono px-3 py-1.5 rounded-full border transition-all duration-200 ${treeCount === p ? 'bg-canopy/20 text-canopy border-canopy/40 scale-105' : 'bg-white/5 light:bg-black/5 text-mist-dim light:text-ink/60 border-white/10 light:border-black/10 hover:border-canopy/30'}`}>{p.toLocaleString()}</button>))}
        </div>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3"><AlertTriangle size={14} className="text-red-400 shrink-0" /><p className="text-xs text-red-200/90 light:text-red-700">Simulator unavailable: {error}</p></div>}

      {gap && (
        <div className="mb-6 bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
          <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Target size={11} /> CANOPY TARGET PROGRESS</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1"><span className="text-mist-dim light:text-ink/50">Current</span><span className="text-mist light:text-ink font-semibold">{baseCanopy != null ? `${baseCanopy}%` : '—'}</span></div>
              <ProgressBar value={baseCanopy ?? 0} max={target} color="bg-mist-dim/50" />
            </div>
            {afterCanopy != null && (<div>
              <div className="flex justify-between text-[10px] font-mono mb-1"><span className="text-canopy font-semibold">After planting {treeCount.toLocaleString()}</span><span className="text-canopy font-bold">{loading ? '…' : `${afterCanopy.toFixed(1)}%`}</span></div>
              <ProgressBar value={afterCanopy} max={target} color="bg-canopy" />
            </div>)}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1"><span className="text-mist-dim light:text-ink/40">Target</span><span className="text-mist-dim light:text-ink/40">{target}%</span></div>
              <ProgressBar value={target} max={target} color="bg-white/20" label={`${gap.trees_needed.toLocaleString()} trees needed to reach target`} />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          [TreePine, 'text-canopy', loading ? '…' : `+${treeCount.toLocaleString()}`, 'Trees Added', 'PLANNED'],
          [MapPin, 'text-earth', baseCanopy != null ? `${baseCanopy}%${afterCanopy && !loading ? ` → ${afterCanopy.toFixed(1)}%` : ''}` : '—', 'Green Cover', 'MEASURED'],
          [Cloud, 'text-canopy', loading ? '…' : `${(afterCarbon ?? (treeCount * 22 / 1000)).toFixed(1)}`, 'CO₂ t/yr', 'ESTIMATED'],
          [Wind, 'text-databue', loading ? '…' : `${(afterOxygen ?? (treeCount * 118 / 1000)).toFixed(1)}`, 'O₂ t/yr', 'ESTIMATED'],
          [DollarSign, 'text-amber-400', loading ? '…' : (invFmt || '—'), 'Investment', 'ESTIMATED'],
          [Target, remainingGap != null && remainingGap === 0 ? 'text-canopy' : 'text-earth', loading ? '…' : (remainingGap != null ? `${remainingGap.toLocaleString()} left` : '—'), 'Target Gap', 'CALCULATED'],
        ].map(([Icon, cls, val, lbl, tag], i) => (
          <div key={i} className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-3 text-center">
            <Icon size={16} className={`${cls} mx-auto mb-1`} />
            <p className={`font-display font-bold text-xl ${cls}`}>{val}</p>
            <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">{lbl}</p>
            <div className="mt-1"><SourceTag level={tag} /></div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3">What planting {treeCount.toLocaleString()} trees does here</p>
        <div className="grid grid-cols-3 gap-px bg-white/10 light:bg-black/10 border border-white/10 light:border-black/10 rounded-2xl overflow-hidden">
          <div className="bg-panel light:bg-white px-4 py-2 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase">Metric</div>
          <div className="bg-panel light:bg-white px-4 py-2 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase">Current</div>
          <div className="bg-panel light:bg-white px-4 py-2 text-[10px] font-mono text-canopy uppercase font-semibold">After planting</div>
          {[
            ['Trees', baseTrees?.toLocaleString() ?? '—', projected?.trees?.toLocaleString() ?? '—'],
            ['Canopy', baseCanopy != null ? `${baseCanopy}%` : '—', afterCanopy != null ? `${afterCanopy.toFixed(1)}%` : '—'],
            ['Gap to 60%', gap ? `${gap.trees_needed.toLocaleString()} trees` : '—', remainingGap != null ? (remainingGap > 0 ? `${remainingGap.toLocaleString()} left` : 'Met!') : '—'],
            ['CO₂/yr', baseCarbon != null ? `${baseCarbon} t` : '—', afterCarbon != null ? `${afterCarbon} t` : '—'],
            ['O₂/yr', baseOxygen != null ? `${baseOxygen} t` : '—', afterOxygen != null ? `${afterOxygen} t` : '—'],
            ['Target status', baseCanopy != null ? (baseCanopy >= target ? 'At target' : 'Below target') : '—', remainingGap != null ? (remainingGap === 0 ? 'Target reached' : 'Still below target') : '—'],
          ].map(([label, cur, after], i) => (
            <div key={i} className="contents">
              <div className="bg-panel light:bg-white px-4 py-2 text-[11px] font-mono text-mist-dim light:text-ink/60">{label}</div>
              <div className="bg-panel light:bg-white px-4 py-2 text-xs font-mono font-semibold text-mist light:text-ink">{cur}</div>
              <div className="bg-panel light:bg-white px-4 py-2 text-xs font-mono font-semibold text-canopy">{loading ? '…' : after}</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setShowMethod(!showMethod)} className="mb-4 flex items-center gap-2 text-[11px] font-mono text-mist-dim light:text-ink/50 hover:text-canopy transition-colors">
        {showMethod ? <ChevronUp size={14} /> : <ChevronDown size={14} />} How are these numbers calculated?
      </button>
      {showMethod && (
        <div className="mb-6 bg-white/3 light:bg-black/3 border border-white/8 light:border-black/8 rounded-2xl p-4">
          <ul className="text-xs font-mono text-mist-dim light:text-ink/50 space-y-1">
            <li>• CO₂/O₂: +{treeCount.toLocaleString()} trees × 22/118 kg per tree per year (backend estimator).</li>
            {canopyData?.modeled ? <li>• Projected canopy: {canopyData.assumption}</li> : <li>• Projected canopy: not modeled — a measured baseline scene is required.</li>}
          </ul>
        </div>
      )}

      <div className="bg-gradient-to-r from-canopy/10 via-panel to-panel light:from-canopy/5 light:via-white light:to-white border border-canopy/20 rounded-2xl p-5">
        <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3">RECOMMENDED INTERVENTION</p>
        <p className="text-xs text-mist light:text-ink/70 mb-3">To move this area toward the {target}% canopy target:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 text-center"><p className="font-display font-bold text-lg text-canopy">{gap ? `~${gap.trees_needed.toLocaleString()}` : '—'}</p><p className="text-[9px] font-mono text-mist-dim light:text-ink/50">Trees required</p></div>
          <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 text-center"><p className="font-display font-bold text-lg text-amber-400">{invFmt || '—'}</p><p className="text-[9px] font-mono text-mist-dim light:text-ink/50">Planning investment</p></div>
          <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 text-center"><p className="font-display font-bold text-lg text-canopy">{afterCarbon != null ? `${afterCarbon} t` : '—'}</p><p className="text-[9px] font-mono text-mist-dim light:text-ink/50">Additional CO₂/yr</p></div>
          <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 text-center"><p className="font-display font-bold text-lg text-databue">{afterOxygen != null ? `${afterOxygen} t` : '—'}</p><p className="text-[9px] font-mono text-mist-dim light:text-ink/50">Additional O₂/yr</p></div>
        </div>
      </div>
    </div>
  );
}