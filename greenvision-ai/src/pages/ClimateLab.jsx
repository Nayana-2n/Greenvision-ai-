import { useState, useEffect, useMemo } from 'react';
import { Sliders, AlertTriangle, Info, TreePine, Target } from 'lucide-react';
import { getCurrentScene } from '../utils/sceneStore';
import { simulateClimate, extractError } from '../api/api';
import CountUp from '../components/CountUp';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';
import { computeTargetGap, buildSceneBaseline } from '../utils/sceneMath';

// Friendly environment descriptor for the scene classifier's labels.
function environmentLabel(scene) {
  const map = {
    dense: 'Dense forest canopy',
    sparse: 'Sparse vegetation',
    street: 'Street / urban',
  };
  return map[scene] || (scene ? `${scene} scene` : '—');
}

export default function ClimateLab() {
  const { mode } = useMode();
  const isMunicipal = mode === MODES.MUNICIPAL;
  const isIndustrial = mode === MODES.INDUSTRIAL;
  const plannerMode = isMunicipal || isIndustrial;

  // Hydrate the analyzed scene ONCE at mount. getCurrentScene() parses
  // sessionStorage and returns a NEW object on every call, so holding it in
  // state keeps the baseline reference stable (avoids re-triggering the
  // simulator effect in an endless loop).
  const [scene] = useState(() => getCurrentScene());
  const baseline = useMemo(() => buildSceneBaseline(scene), [scene]);
  const gap = useMemo(() => computeTargetGap(scene, baseline), [scene, baseline]);

  // Simulator State — "Trees to Plant" (intervention size).
  const range = plannerMode
    ? (isIndustrial ? { min: 10, max: 2000, step: 5 } : { min: 100, max: 10000, step: 50 })
    : { min: 1, max: 100, step: 1 };
  const presets = isIndustrial ? [10, 50, 100, 500] : isMunicipal ? [100, 500, 1000, 5000] : [1, 3, 5, 10, 25];
  const [treeCount, setTreeCount] = useState(range.min);
  const [sim, setSim] = useState(null);
  const [simLoading, setSimLoading] = useState(true);
  const [simError, setSimError] = useState(null);

  // Run the scene-aware estimator math on the backend whenever the slider
  // changes (debounced, no page refresh).
  useEffect(() => {
    let cancelled = false;
    setSimLoading(true);
    setSimError(null);
    const timer = setTimeout(() => {
      simulateClimate(treeCount, baseline)
        .then((res) => { if (!cancelled) setSim(res); })
        .catch((err) => { if (!cancelled) setSimError(extractError(err)); })
        .finally(() => { if (!cancelled) setSimLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [treeCount, baseline]);

  const additional = sim?.additional;
  const projectedTrees = sim?.projected?.trees ?? treeCount;
  const projectedCanopy = sim?.projected?.canopy_percentage ?? null;
  const canopyModeled = sim?.canopy?.modeled ?? false;
  const canopyAssumption = sim?.canopy?.assumption ?? null;
  const canopyM2PerTree = sim?.canopy?.canopy_m2_per_tree ?? null;
  const recommendation = sim?.recommendation ?? null;
  const baselineApplied = sim?.baseline_applied ?? false;
  const budget = sim?.budget ?? null;

  const envLabel = environmentLabel(scene?.scene);
  const baseTrees = baseline?.estimated_trees ?? null;
  const baseCanopy = baseline?.canopy_percentage ?? null;
  const basePriority = baseline?.plantation_priority ?? null;

  // Target attainment after this intervention (vs the 60% canopy target).
  const targetAttainment =
    gap && projectedCanopy != null
      ? Math.min(100, (projectedCanopy / gap.target_green_cover) * 100)
      : null;
  const remainingToTarget =
    gap != null ? Math.max(0, gap.trees_needed - treeCount) : null;

  // Current vs after-planting comparison (scene-aware).
  const currentCarbon = scene?.carbon_tonnes_per_year ?? scene?.carbon ?? null;
  const currentOxygen = scene?.oxygen_tonnes_per_year ?? scene?.oxygen ?? null;
  const afterCarbon = sim?.projected?.carbon_tonnes_per_year ?? null;
  const afterOxygen = sim?.projected?.oxygen_tonnes_per_year ?? null;
  const currentStatus =
    baseCanopy != null
      ? baseCanopy >= gap?.target_green_cover
        ? 'At target'
        : 'Below target'
      : null;
  const afterStatus =
    remainingToTarget != null
      ? remainingToTarget === 0
        ? 'Target reached'
        : 'Still below target'
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16 space-y-12">

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-databue bg-databue/10 border border-databue/20 px-3 py-1.5 rounded-full mb-3">
          <Sliders size={14} /> {isMunicipal ? 'CLIMATE SIMULATION LAB' : isIndustrial ? 'INVESTMENT & IMPACT' : 'MY TREE IMPACT'}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
          {isMunicipal ? 'Climate Impact Simulator' : isIndustrial ? 'Green Buffer — Investment & Impact' : 'What planting a tree does for you'}
        </h1>
        <p className="text-mist-dim light:text-ink/60 text-sm mt-1 max-w-2xl">
          {isMunicipal
            ? 'Simulate a planting intervention on your analyzed scene and see how the environmental indicators change — toward the 60% canopy target.'
            : isIndustrial
            ? 'Size your green-buffer intervention: slide the tree count and see the calculated CO₂ / O₂ impact and the estimated investment (planning estimate).'
            : 'Slide the number of trees you could plant and see their real annual carbon and oxygen contribution — plus how far your area is from the 60% canopy target.'}
        </p>
      </div>

      {/* CLIMATE IMPACT SIMULATOR */}
      <section className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b border-white/10 light:border-black/10 pb-6">
          <div>
            <span className="text-xs font-mono text-canopy font-semibold uppercase tracking-wider">WHAT-IF INTERVENTION</span>
            <h2 className="font-display text-2xl font-bold text-mist light:text-ink flex items-center gap-2">
              <TreePine size={22} className="text-canopy" /> Trees to Plant
            </h2>
          </div>
          <div className="bg-canopy/15 text-canopy font-mono text-xs font-semibold px-4 py-2 rounded-full border border-canopy/25">
            Instant estimator (22 kg CO₂, 118 kg O₂ per tree/yr)
          </div>
        </div>

        {/* Current Scene Summary */}
        <div className="mb-8">
          <span className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Target size={12} /> {isMunicipal ? 'SIMULATING' : isIndustrial ? 'SITE SCENARIO' : 'YOUR AREA'}
          </span>

          {baseline ? (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
                  <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Scene</span>
                  <p className="font-display font-bold text-lg text-mist light:text-ink mt-1 capitalize">{envLabel}</p>
                </div>
                <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
                  <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Current canopy</span>
                  <p className="font-display font-bold text-lg text-canopy mt-1">{baseCanopy != null ? `${baseCanopy}%` : '—'}</p>
                </div>
                <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
                  <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Estimated trees</span>
                  <p className="font-display font-bold text-lg text-mist light:text-ink mt-1">{baseTrees != null ? baseTrees.toLocaleString() : '—'}</p>
                  {scene?.detected_trees != null && (
                    <span className="text-[10px] font-mono text-mist-dim light:text-ink/40 block mt-1">
                      + {scene.detected_trees.toLocaleString()} trunks detected (street detector)
                    </span>
                  )}
                  {Array.isArray(scene?.species) && scene.species.length > 0 && (
                    <span className="text-[10px] font-mono text-mist-dim light:text-ink/40 block mt-1">
                      Species: {scene.species.map((s) => s.species).join(', ')}
                    </span>
                  )}
                </div>
                <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
                  <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Plantation priority</span>
                  <p className={`font-display font-bold text-lg mt-1 ${basePriority === 'High' ? 'text-red-400' : basePriority === 'Medium' ? 'text-earth' : 'text-canopy'}`}>
                    {basePriority || '—'}
                  </p>
                </div>
              </div>
              {scene?.vegetation_warning && (
                <div className="mt-3 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90 light:text-amber-700 leading-relaxed">
                    <span className="font-bold">Low-reliability baseline.</span> {scene.vegetation_warning}
                  </p>
                </div>
              )}
              {scene?.vegetationGate && (
                <div className="mt-3 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200/90 light:text-red-700 leading-relaxed">
                    <span className="font-bold">Vegetation cannot be measured reliably from this image.</span>{' '}
                    Upload a top-down aerial/satellite/GeoTIFF image or provide a location. The carbon / oxygen math
                    below still works as a standalone calculator.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-2xl p-4">
              <Info size={18} className="text-databue shrink-0 mt-0.5" />
              <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">
                {isMunicipal
                  ? 'No analyzed scene loaded — the simulator currently runs as a standalone calculator. Upload and analyze an image to contextualize interventions around that scene\'s actual canopy, tree estimate and plantation priority.'
                  : isIndustrial
                  ? 'No analyzed scene loaded — the carbon / oxygen math still works for any tree count. Analyze a site image to add measured canopy and a target-anchored buffer plan.'
                  : 'No analyzed scene loaded — the carbon / oxygen math still works for any number of trees. Analyze an aerial image of your area to add measured canopy and target progress.'}
              </p>
            </div>
          )}

          {/* Target gap (measured scene) */}
          {gap && (
            <div className="mt-3 bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4 text-xs font-mono text-mist-dim light:text-ink/60 leading-relaxed">
              <span className="text-mist light:text-ink font-semibold">
                {gap.current_green_cover}% canopy → {gap.target_green_cover}% target.
              </span>{' '}
              About <span className="text-mist light:text-ink font-bold">{gap.trees_needed.toLocaleString()}</span> additional trees are
              estimated to close the gap (same arithmetic as the Planting Plan; assumes canopy density is maintained).
            </div>
          )}
        </div>

        {/* Tree Count Slider */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <label className="font-display font-semibold text-lg text-mist light:text-ink">
              Trees to Plant: <span className="text-canopy font-bold text-2xl font-mono">{treeCount.toLocaleString()}</span>
            </label>
            <span className="font-mono text-xs text-mist-dim light:text-ink/50">
              Range: {range.min.toLocaleString()} — {range.max.toLocaleString()} Trees
            </span>
          </div>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={treeCount}
            onChange={(e) => setTreeCount(parseInt(e.target.value))}
            className="w-full h-3 bg-white/10 light:bg-black/10 rounded-lg appearance-none cursor-pointer accent-canopy"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setTreeCount(p)}
                className={`text-[11px] font-mono px-3 py-1.5 rounded-full border transition-colors ${
                  treeCount === p
                    ? 'bg-canopy/20 text-canopy border-canopy/40'
                    : 'bg-white/5 light:bg-black/5 text-mist-dim light:text-ink/60 border-white/10 light:border-black/10 hover:border-canopy/30'
                }`}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Projected Scenario Outputs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Projected Trees</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-mist light:text-ink mt-1 animate-pulse">…</p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist light:text-ink mt-1">
                <CountUp end={projectedTrees} suffix="" />
              </p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">
              {baseTrees != null ? `+${treeCount.toLocaleString()} on current ${baseTrees.toLocaleString()}` : `+${treeCount.toLocaleString()} planted`}
            </span>
          </div>

          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Projected Canopy</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-canopy mt-1 animate-pulse">…</p>
            ) : canopyModeled ? (
              <p className="font-display font-bold text-2xl text-canopy mt-1">
                <CountUp end={projectedCanopy} decimals={1} suffix="%" />
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist-dim light:text-ink/40 mt-1">—</p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">
              {canopyModeled
                ? `@ ${canopyM2PerTree} m²/tree (documented)`
                : 'Canopy projection needs a measured baseline scene'}
            </span>
          </div>

          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">CO₂ Sequestration</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-databue mt-1 animate-pulse">…</p>
            ) : additional ? (
              <p className="font-display font-bold text-2xl text-databue mt-1">
                +<CountUp end={additional.carbon_tonnes_per_year} decimals={1} suffix="t/yr" />
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist-dim light:text-ink/40 mt-1">—</p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">Additional annual absorption</span>
          </div>

          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Oxygen Output</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-earth mt-1 animate-pulse">…</p>
            ) : additional ? (
              <p className="font-display font-bold text-2xl text-earth mt-1">
                +<CountUp end={additional.oxygen_tonnes_per_year} decimals={1} suffix="t/yr" />
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist-dim light:text-ink/40 mt-1">—</p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">Additional annual O₂</span>
          </div>

          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">People Offset</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-canopy mt-1 animate-pulse">…</p>
            ) : additional ? (
              <p className="font-display font-bold text-2xl text-canopy mt-1">
                +<CountUp end={additional.equivalent_people_offset} decimals={1} suffix=" pp" />
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist-dim light:text-ink/40 mt-1">—</p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">Annual emissions @ 4.7 t CO₂</span>
          </div>

          {/* Target attainment — replaces the old "Not modeled" temp/AQI/budget tiles */}
          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Target Attainment</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-canopy mt-1 animate-pulse">…</p>
            ) : targetAttainment != null ? (
              <p className="font-display font-bold text-2xl text-canopy mt-1">
                <CountUp end={targetAttainment} decimals={1} suffix="%" />
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist-dim light:text-ink/40 mt-1">—</p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">
              {gap ? `of ${gap.target_green_cover}% target after planting` : 'needs a measured baseline scene'}
            </span>
          </div>

          <div className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono text-mist-dim light:text-ink/50 uppercase">Gap to Target</span>
            {simLoading ? (
              <p className="font-display font-bold text-2xl text-mist light:text-ink mt-1 animate-pulse">…</p>
            ) : remainingToTarget != null ? (
              <p className={`font-display font-bold text-2xl mt-1 ${remainingToTarget > 0 ? 'text-earth' : 'text-canopy'}`}>
                {remainingToTarget > 0 ? (
                  <><CountUp end={remainingToTarget} /> <span className="text-sm">more</span></>
                ) : (
                  'Met!'
                )}
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-mist-dim light:text-ink/40 mt-1">—</p>
            )}
            <span className="text-[10px] font-mono text-mist-dim light:text-ink/40">
              {gap ? `trees still needed after planting ${treeCount.toLocaleString()}` : 'needs a measured baseline scene'}
            </span>
          </div>
        </div>

        {/* Budget (planning estimate from configurable per-tree costs) */}
        {plannerMode && budget?.available && (
          <div className="mt-6 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-mist light:text-ink">
                Estimated investment · {budget.formula}
              </span>
              <span className="font-display font-bold text-2xl text-canopy">{budget.total_estimate_inr_formatted}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Sapling cost', budget.line_items?.sapling_cost_inr, '₹ per-tree sapling'],
                ['Planting labour', budget.line_items?.planting_labour_inr, 'per-tree labour'],
                [`Maintenance × ${budget.maintenance_years ?? 1} yr`, budget.line_items?.maintenance_inr, 'water / care'],
              ].map(([label, value, note]) => (
                <div key={label} className="bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-xl px-3 py-2.5">
                  <span className="block text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">{label}</span>
                  <span className="block text-sm font-mono font-semibold text-mist light:text-ink mt-0.5">₹{Number(value ?? 0).toLocaleString('en-IN')}</span>
                  <span className="block text-[9px] font-mono text-mist-dim light:text-ink/40 mt-0.5">{note}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-mono text-amber-400 light:text-amber-600 flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {budget.disclosure}
            </p>
          </div>
        )}

        {/* Current vs After-planting comparison (the slider's effect, made explicit) */}
        {baseline && (
          <div className="mt-6">
            <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3">
              What planting {treeCount.toLocaleString()} trees does here
            </p>
            <div className="grid grid-cols-3 gap-px bg-white/10 light:bg-black/10 border border-white/10 light:border-black/10 rounded-2xl overflow-hidden">
              <div className="bg-panel light:bg-white px-4 py-2.5 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">Metric</div>
              <div className="bg-panel light:bg-white px-4 py-2.5 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">Current</div>
              <div className="bg-panel light:bg-white px-4 py-2.5 text-[10px] font-mono text-canopy uppercase tracking-wider font-semibold">After planting</div>
              {[
                ['Trees', baseTrees != null ? baseTrees.toLocaleString() : '—', projectedTrees != null ? projectedTrees.toLocaleString() : '—'],
                ['Canopy cover', baseCanopy != null ? `${baseCanopy}%` : '—', canopyModeled && projectedCanopy != null ? `${projectedCanopy}%` : '—'],
                ['Gap to 60% target', gap ? `${gap.trees_needed.toLocaleString()} trees` : '—', remainingToTarget != null ? (remainingToTarget > 0 ? `${remainingToTarget.toLocaleString()} trees left` : 'Closed') : '—'],
                ['CO₂ / year', currentCarbon != null ? `${currentCarbon} t` : '—', afterCarbon != null ? `${afterCarbon} t` : '—'],
                ['O₂ / year', currentOxygen != null ? `${currentOxygen} t` : '—', afterOxygen != null ? `${afterOxygen} t` : '—'],
                ['Target status', currentStatus ?? '—', afterStatus ?? '—'],
              ].map(([label, cur, after], i) => (
                <div key={i} className="contents">
                  <div className="bg-panel light:bg-white px-4 py-2.5 text-[11px] font-mono text-mist-dim light:text-ink/60">{label}</div>
                  <div className="bg-panel light:bg-white px-4 py-2.5 text-xs font-mono font-semibold text-mist light:text-ink">{cur}</div>
                  <div className="bg-panel light:bg-white px-4 py-2.5 text-xs font-mono font-semibold text-canopy">
                    {simLoading ? '…' : after}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {recommendation && (
          <div className={`mt-6 flex items-start gap-3 p-4 rounded-2xl border ${baselineApplied ? 'bg-canopy/10 border-canopy/25' : 'bg-white/5 light:bg-black/5 border-white/10 light:border-black/10'}`}>
            <TreePine size={18} className={`shrink-0 mt-0.5 ${baselineApplied ? 'text-canopy' : 'text-mist-dim'}`} />
            <div>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-mist light:text-ink">Recommended intervention</span>
              <p className="text-sm text-mist light:text-ink/80 leading-relaxed mt-0.5">{recommendation}</p>
            </div>
          </div>
        )}

        {/* Why did this change? — transparent calculation */}
        {(canopyModeled || baseline) && (
          <div className="mt-5 bg-white/3 light:bg-black/3 border border-white/8 light:border-black/8 rounded-2xl p-4">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-mist-dim light:text-ink/50 flex items-center gap-1.5">
              <Info size={12} /> Why did this change?
            </span>
            <ul className="mt-2 text-xs font-mono text-mist-dim light:text-ink/50 space-y-1 leading-relaxed">
              <li>• CO₂ / O₂: +{treeCount.toLocaleString()} trees × 22 / 118 kg per tree per year (backend estimator).</li>
              {canopyModeled ? (
                <li>• Projected canopy: {canopyAssumption}</li>
              ) : (
                <li>• Projected canopy: not modeled — a measured baseline scene is required to project canopy area.</li>
              )}
            </ul>
          </div>
        )}

        {simError && (
          <p className="mt-4 text-xs font-mono text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Simulator unavailable: {simError}
          </p>
        )}
      </section>

    </div>
  );
}
