import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  TreePine, Leaf, Wind, Cloud, AlertTriangle, MapPin, Sprout,
  ArrowRight, CheckCircle2, FileText, Factory,
} from 'lucide-react';
import StatsCard from '../components/StatsCard';
import Sidebar from '../components/Sidebar';
import MapView from '../components/MapView';
import ExecutiveBanner from '../components/ExecutiveBanner';
import InsightFeed from '../components/InsightFeed';
import RecommendationCard from '../components/RecommendationCard';
import { CoverPieChart } from '../components/Charts';
import ProgressRing from '../components/ProgressRing';
import ClimateGPTWidget from '../components/ClimateGPTWidget';
import EnvironmentalContext from '../components/EnvironmentalContext';
import HeatmapOverlay from '../components/HeatmapOverlay';
import ImpactSimulator from '../components/ImpactSimulator';
import CitizenArea from '../components/CitizenArea';
import { getCurrentScene } from '../utils/sceneStore';
import { getUserLocation } from '../utils/locationStore';
import { computeTargetGap, buildSceneBaseline } from '../utils/sceneMath';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

function confTier(v) {
  if (v == null) return 'N/A';
  return v >= 80 ? 'High' : v >= 60 ? 'Medium' : 'Low';
}

function confLabel(v) {
  return v != null ? `${v}% ${confTier(v)}` : 'N/A';
}


/* ------------------------------------------------------------------ */
/* Municipal - full Command Center (decision-support)                  */
/* ------------------------------------------------------------------ */
function MunicipalDashboard({ r }) {
  const sceneClassification = r.aiConfidence?.sceneClassification;
  const gap = useMemo(() => computeTargetGap(r, buildSceneBaseline(r)), [r]);

  return (
    <div className="flex flex-1 w-full relative">
      <Sidebar sceneId={r.sceneId} />
      <main className="flex-1 w-full lg:w-[calc(100%-18rem)] overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <span className="text-xs font-mono text-canopy font-semibold uppercase tracking-wider bg-canopy/10 px-3 py-1 rounded-full border border-canopy/20">
                MUNICIPAL GREEN ASSESSMENT
              </span>
              <h1 className="font-display text-2xl md:text-4xl font-bold text-mist light:text-ink mt-2">
                Green Cover Diagnosis
              </h1>
              <p className="text-mist-dim light:text-ink/55 text-xs font-mono mt-1">
                Scene ID: <span className="text-mist light:text-ink font-bold">{r.sceneId}</span> &middot; {r.locationName}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 px-3 py-1.5 rounded-xl font-mono text-xs shadow-sm">
                <span className="text-mist-dim light:text-ink/50 block text-[9px]">SCENE CLASSIFIER</span>
                <span className="text-canopy font-bold">{confLabel(sceneClassification)}</span>
              </div>
              {r.detectedTrees != null && r.treeDetectionConfidence != null && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 px-3 py-1.5 rounded-xl font-mono text-xs shadow-sm">
                  <span className="text-mist-dim light:text-ink/50 block text-[9px]">TRUNK DETECTOR</span>
                  <span className="text-databue font-bold">{r.treeDetectionConfidence}% {confTier(r.treeDetectionConfidence)}</span>
                </div>
              )}
            </div>
          </div>

          <ExecutiveBanner cityHealth={r.cityHealth} />

          {r.vegetationGate && (
            <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200/90 light:text-red-700 leading-relaxed">
                <span className="font-bold">Vegetation cannot be measured reliably from this image.</span>{' '}
                Upload a top-down aerial/satellite/GeoTIFF image or provide a location.
              </p>
            </div>
          )}

          {gap && gap.trees_needed > 0 && (
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4 bg-gradient-to-r from-canopy/15 via-panel to-panel light:from-canopy/10 light:via-white light:to-white border border-canopy/25 rounded-3xl p-5 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-canopy text-white shrink-0">
                  <TreePine size={26} />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest">
                    Planting gap - the headline answer
                  </p>
                  <p className="font-display font-bold text-2xl text-mist light:text-ink">
                    ~{gap.trees_needed.toLocaleString()}{' '}
                    <span className="text-base font-semibold text-mist-dim light:text-ink/70">additional trees estimated to reach the {gap.target_green_cover}% canopy target</span>
                  </p>
                  <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-1">
                    From current {gap.current_green_cover}% canopy &middot; same transparent arithmetic as the Planting Plan &middot; assumes canopy density is maintained
                  </p>
                </div>
              </div>
              <Link to="/planting" className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20 shrink-0">
                <Sprout size={14} /> Open Planting Plan <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {gap && gap.trees_needed === 0 && (
            <div className="mb-6 flex items-start gap-3 bg-canopy/10 border border-canopy/25 rounded-2xl p-4">
              <CheckCircle2 size={18} className="text-canopy shrink-0 mt-0.5" />
              <p className="text-xs text-mist light:text-ink leading-relaxed">
                <span className="font-bold">Canopy target met.</span> Current cover is {gap.current_green_cover}%, meeting the{' '}
                {gap.target_green_cover}% target - no new planting required. Focus maintenance on existing stock.
              </p>
            </div>
          )}

          {r.vegetation_warning && (
            <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 light:text-amber-700 leading-relaxed">
                <span className="font-bold">Measurement confidence reduced.</span> {r.vegetation_warning}
              </p>
            </div>
          )}

          <InsightFeed insights={r.insights} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatsCard icon={Leaf} label="Green Cover" value={r.greenCover != null ? `${r.greenCover}%` : 'N/A'} trend={r.greenCover != null ? 'Target: 60%' : undefined} />
            <StatsCard icon={TreePine} label="Trees Detected" value={r.treeCount ?? 'N/A'} trend={r.treeDetectionConfidence != null ? `Confidence ${r.treeDetectionConfidence}%` : undefined} />
            <StatsCard icon={Cloud} label="CO2 Offset" value={r.carbonOffset ?? 'N/A'} unit="t/yr" accent="text-canopy" accentBg="bg-canopy/10" />
            <StatsCard icon={Wind} label="Oxygen" value={r.oxygenProduction ?? 'N/A'} unit="t/yr" accent="text-databue" accentBg="bg-databue/10" />
            <StatsCard icon={MapPin} label="Area" value={r.forestAreaHectares != null ? `${r.forestAreaHectares} ha` : 'N/A'} trend={r.totalAreaHectares ? `of ${r.totalAreaHectares} ha total` : undefined} accent="text-earth" accentBg="bg-earth/10" />
          </div>

          {/* Tree species — trunk-level identification (street scenes only) */}
          {(r.species != null || r.detectedTrees != null) && (
            <div className="mb-8 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-mono text-canopy font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <TreePine size={13} /> TREE SPECIES
              </p>
              {Array.isArray(r.species) && r.species.length > 0 ? (
                <>
                  <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mb-2">
                    {r.detectedTrees} trunk{r.detectedTrees === 1 ? '' : 's'} detected &middot; {r.treeDetectionMethod || 'trunk detector'} &middot; per-tree confidence shown
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.species.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-canopy/10 text-canopy border border-canopy/25 rounded-full px-3 py-1 text-[11px] font-mono">
                        <TreePine size={12} /> {s.species}
                        {s.confidence != null && (
                          <span className="text-mist-dim light:text-ink/50">· {Math.round(s.confidence * 100)}%</span>
                        )}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">
                  {r.detectedTrees === 0
                    ? 'No tree trunks were detected in this image, so no species could be identified. Upload a street-level photo where individual trunks are clearly visible to identify species.'
                    : 'This image type (aerial / drone view) does not run the trunk–species analysis. Upload a street-level photo of trees to identify their species.'}
                </p>
              )}
            </div>
          )}

          <div className="mb-8">
            <ImpactSimulator scene={r} />
          </div>

          <HeatmapOverlay heatmapUrl={r.heatmapUrl} />

          {r.gps && (
            <p className="text-[10px] font-mono text-mist-dim light:text-ink/40 mb-4">
              Georeferenced location extracted from image metadata: {r.gps.lat.toFixed(5)}, {r.gps.lng.toFixed(5)}
            </p>
          )}

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="h-full">
              <MapView scene={r} />
            </div>
            <div className="flex flex-col gap-6">
              <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-3">CANOPY PROGRESS</p>
                <div className="flex items-center justify-center">
                  <ProgressRing percentage={r.greenCover ?? 0} label="Target: 60%" />
                </div>
                {gap && gap.trees_needed > 0 && (
                  <Link to="/planting" className="mt-4 flex items-center justify-center gap-1.5 bg-canopy/15 text-canopy text-[11px] font-mono font-semibold px-4 py-2 rounded-full hover:bg-canopy/25 transition-colors">
                    <Sprout size={13} /> See planting plan for this scene
                  </Link>
                )}
              </div>
              {r.vegetation_warning && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-earth" />
                    <span className="text-[10px] font-mono text-earth uppercase tracking-widest font-semibold">Measurement caveat</span>
                  </div>
                  <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">{r.vegetation_warning}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <RecommendationCard recommendations={r.recommendations} greenCover={r.greenCover} targetGreenCover={60} />
            <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-3">LAND COVER SPLIT</p>
              <div className="h-[220px]">
                <CoverPieChart scene={r} />
              </div>
            </div>
          </div>

          <EnvironmentalContext scene={r} location={r.userLocation ?? r.gps} />

          {/* Decision Summary */}
          <div className="mt-8 bg-gradient-to-br from-canopy/10 via-panel to-panel light:from-canopy/5 light:via-white light:to-white border border-canopy/20 rounded-3xl p-6 shadow-lg">
            <p className="text-[10px] font-mono text-canopy font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={13} /> DECISION SUMMARY
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase mb-1">Current status</p>
                <p className="text-xs text-mist light:text-ink font-semibold">{r.greenCover != null ? `${r.greenCover}% canopy cover` : 'Awaiting measurement'}</p>
                {gap && <p className="text-[10px] text-mist-dim light:text-ink/60 mt-0.5">Gap: {gap.trees_needed.toLocaleString()} trees to {gap.target_green_cover}%</p>}
              </div>
              <div>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase mb-1">Annual carbon offset</p>
                <p className="text-xs text-mist light:text-ink font-semibold">{r.carbonOffset != null ? `${r.carbonOffset} t CO₂/yr` : 'Not modeled'}</p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase mb-1">Priority</p>
                <p className="text-xs text-mist light:text-ink font-semibold">{r.plantation_priority ?? 'Unknown'}</p>
              </div>
            </div>
            <p className="text-[10px] text-mist-dim light:text-ink/50 leading-relaxed">
              Use the simulator above to explore planting scenarios. All figures are transparent planning estimates — not regulatory guarantees.
            </p>
          </div>

          {r.methodologyNotes && (
            <div className="mt-8 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FileText size={13} /> METHODOLOGY & TRANSPARENCY
              </p>
              <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">{r.methodologyNotes}</p>
            </div>
          )}

          <ClimateGPTWidget />
        </div>
      </main>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Industrial - site environmental compliance dashboard                */
/* ------------------------------------------------------------------ */
function IndustrialSite({ r }) {
  const sceneClassification = r.aiConfidence?.sceneClassification;
  const industrialContext = r.aiConfidence?.industrialContext;
  const gap = useMemo(() => computeTargetGap(r, buildSceneBaseline(r)), [r]);

  const complianceStatus = r.greenCover != null
    ? r.greenCover < 20 ? 'critical'
      : r.greenCover < 40 ? 'below'
      : 'acceptable'
    : null;

  const complianceLabel = {
    critical: 'Below Threshold',
    below: 'Needs Improvement',
    acceptable: 'Acceptable',
  };

  const complianceColor = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    below: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    acceptable: 'bg-canopy/15 text-canopy border-canopy/30',
  };

  return (
    <div className="flex flex-1 w-full relative">
      <Sidebar sceneId={r.sceneId} />
      <main className="flex-1 w-full lg:w-[calc(100%-18rem)] overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
          {/* Industrial header — compliance framing */}
          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider bg-databue/10 text-databue border-databue/20 px-3 py-1 rounded-full border">
                ENVIRONMENTAL COMPLIANCE ASSESSMENT
              </span>
              <h1 className="font-display text-2xl md:text-4xl font-bold text-mist light:text-ink mt-2">
                Site Green Buffer Status
              </h1>
              <p className="text-mist-dim light:text-ink/55 text-xs font-mono mt-1">
                Site ID: <span className="text-mist light:text-ink font-bold">{r.sceneId}</span> &middot; {r.locationName}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {complianceStatus && (
                <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border ${complianceColor[complianceStatus]}`}>
                  {complianceLabel[complianceStatus]}
                </span>
              )}
              <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 px-3 py-1.5 rounded-xl font-mono text-xs shadow-sm">
                <span className="text-mist-dim light:text-ink/50 block text-[9px]">SCENE CLASSIFIER</span>
                <span className="text-databue font-bold">{confLabel(sceneClassification)}</span>
              </div>
              {industrialContext && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 px-3 py-1.5 rounded-xl font-mono text-xs shadow-sm">
                  <span className="text-mist-dim light:text-ink/50 block text-[9px]">INDUSTRIAL CONTEXT</span>
                  <span className="text-earth font-bold">{confLabel(industrialContext)}</span>
                </div>
              )}
            </div>
          </div>

          {r.vegetationGate && (
            <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200/90 light:text-red-700 leading-relaxed">
                <span className="font-bold">Vegetation cannot be measured reliably from this image.</span>{' '}
                Upload a top-down aerial/satellite image of the industrial site or provide a location.
              </p>
            </div>
          )}

          {/* Buffer gap banner — industrial framing */}
          {gap && gap.trees_needed > 0 && (
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4 bg-gradient-to-r from-databue/15 via-panel to-panel light:from-databue/10 light:via-white light:to-white border border-databue/25 rounded-3xl p-5 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-databue text-white shrink-0">
                  <Factory size={26} />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest">
                    Green buffer intervention required
                  </p>
                  <p className="font-display font-bold text-2xl text-mist light:text-ink">
                    ~{gap.trees_needed.toLocaleString()}{' '}
                    <span className="text-base font-semibold text-mist-dim light:text-ink/70">trees to establish a {gap.target_green_cover}% green buffer zone</span>
                  </p>
                  <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-1">
                    From current {gap.current_green_cover}% cover &middot; for regulatory compliance, ESG reporting and worker well-being
                  </p>
                </div>
              </div>
              <Link to="/planting" className="inline-flex items-center gap-2 bg-databue text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-databue/20 shrink-0">
                <Sprout size={14} /> Develop Buffer Plan <ArrowRight size={13} />
              </Link>
            </div>
          )}

          <HeatmapOverlay heatmapUrl={r.heatmapUrl} />

          {r.vegetation_warning && (
            <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 light:text-amber-700 leading-relaxed">
                <span className="font-bold">Measurement confidence reduced.</span> {r.vegetation_warning}
              </p>
            </div>
          )}

          {/* Site Diagnosis — compliance-oriented */}
          <div className="mb-6 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest flex items-center gap-1.5">
                <Factory size={13} className="text-databue" /> SITE ENVIRONMENTAL STATUS
              </p>
              {complianceStatus && (
                <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${complianceColor[complianceStatus]}`}>
                  {r.greenCover != null ? `${r.greenCover}% COVER` : 'UNMEASURED'}
                </span>
              )}
            </div>
            <p className="text-xs text-mist light:text-ink leading-relaxed">
              {r.greenCover != null
                ? `This industrial site has ${r.greenCover}% green canopy cover. ${
                    r.greenCover < 20
                      ? 'Coverage is critically low. Establishing a minimum 15m green buffer along site perimeters is strongly recommended for regulatory compliance and worker well-being.'
                      : r.greenCover < 40
                      ? 'Coverage is below recommended levels for industrial zones. A phased green buffer plan can improve compliance posture and ESG metrics.'
                      : 'Coverage meets baseline requirements. Focus on maintaining existing vegetation and selective enhancement of buffer zones.'
                  }`
                : 'Upload a top-down aerial image of the industrial site to assess green buffer coverage and plan environmental interventions.'}
            </p>
          </div>

          {/* Industrial-specific KPI grid — compliance + investment framing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard icon={Leaf} label="Green Cover" value={r.greenCover != null ? `${r.greenCover}%` : 'N/A'} trend={r.greenCover != null ? `Buffer target: ${gap?.target_green_cover ?? 60}%` : undefined} accent="text-databue" accentBg="bg-databue/10" />
            <StatsCard icon={TreePine} label="Trees on Site" value={r.treeCount ?? 'N/A'} trend={r.treeDetectionConfidence != null ? `Confidence ${r.treeDetectionConfidence}%` : undefined} />
            <StatsCard icon={Cloud} label="CO\u2082 Offset" value={r.carbonOffset ?? 'N/A'} unit="t/yr" accent="text-canopy" accentBg="bg-canopy/10" />
            <StatsCard icon={MapPin} label="Site Area" value={r.forestAreaHectares != null ? `${r.forestAreaHectares} ha` : 'N/A'} trend={r.totalAreaHectares ? `of ${r.totalAreaHectares} ha total` : undefined} accent="text-earth" accentBg="bg-earth/10" />
          </div>

          <div className="mb-8">
            <ImpactSimulator scene={r} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="h-full">
              <MapView scene={r} />
            </div>
            <div className="flex flex-col gap-6">
              {/* Buffer progress ring — industrial framing */}
              <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-3">BUFFER COVERAGE</p>
                <div className="flex items-center justify-center">
                  <ProgressRing percentage={r.greenCover ?? 0} label={`Target: ${gap?.target_green_cover ?? 60}%`} />
                </div>
                {gap && gap.trees_needed > 0 && (
                  <Link to="/planting" className="mt-4 flex items-center justify-center gap-1.5 bg-databue/15 text-databue text-[11px] font-mono font-semibold px-4 py-2 rounded-full hover:bg-databue/25 transition-colors">
                    <Sprout size={13} /> See green buffer plan
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Green Responsibility Plan — ESG/compliance focused */}
          <div className="mt-8 bg-white/5 light:bg-white border border-databue/15 light:border-databue/10 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Factory size={13} className="text-databue" /> ENVIRONMENTAL RESPONSIBILITY PLAN
            </p>
            <div className="space-y-3">
              {r.greenCover != null && r.greenCover < 60 && (
                <div className="bg-white/5 light:bg-black/5 border border-white/5 light:border-black/5 rounded-xl p-3">
                  <p className="text-xs font-mono text-mist light:text-ink font-semibold mb-1">Priority: Perimeter Green Buffer</p>
                  <p className="text-[11px] text-mist-dim light:text-ink/60 leading-relaxed">
                    Establish a minimum 15m vegetation buffer along site perimeters using pollution-tolerant species. This supports noise reduction, particulate interception and visual screening.
                  </p>
                </div>
              )}
              {r.greenCover != null && r.greenCover < 40 && (
                <div className="bg-white/5 light:bg-black/5 border border-white/5 light:border-black/5 rounded-xl p-3">
                  <p className="text-xs font-mono text-mist light:text-ink font-semibold mb-1">Regulatory Compliance</p>
                  <p className="text-[11px] text-mist-dim light:text-ink/60 leading-relaxed">
                    Current coverage falls below typical industrial zoning green cover requirements. A phased planting plan achieves compliance while managing capital expenditure.
                  </p>
                </div>
              )}
              {r.carbonOffset && (
                <div className="bg-white/5 light:bg-black/5 border border-white/5 light:border-black/5 rounded-xl p-3">
                  <p className="text-xs font-mono text-mist light:text-ink font-semibold mb-1">Carbon Credit & ESG Potential</p>
                  <p className="text-[11px] text-mist-dim light:text-ink/60 leading-relaxed">
                    Existing vegetation offsets ~{r.carbonOffset} t CO\u2082/year. Expanding canopy increases carbon credit value and improves ESG reporting metrics for stakeholders.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {gap && gap.trees_needed > 0 && (
                <div className="bg-databue/10 border border-databue/20 rounded-xl p-3 text-center">
                  <p className="text-lg font-display font-bold text-databue">{`~${gap.trees_needed.toLocaleString()}`}</p>
                  <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">Trees for Buffer</p>
                </div>
              )}
              <div className="bg-canopy/10 border border-canopy/20 rounded-xl p-3 text-center">
                <p className="text-lg font-display font-bold text-canopy">{r.carbonOffset ?? 'N/A'}</p>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">t CO\u2082/yr Offset</p>
              </div>
              <div className="bg-earth/10 border border-earth/20 rounded-xl p-3 text-center">
                <p className="text-lg font-display font-bold text-earth">{r.greenCover != null ? `${r.greenCover}%` : 'N/A'}</p>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">Current Cover</p>
              </div>
            </div>

            <Link to="/planting" className="mt-4 flex items-center justify-center gap-2 bg-databue text-white text-xs font-mono font-semibold px-5 py-2.5 rounded-full hover:scale-105 transition-transform shadow-lg shadow-databue/20">
              <Sprout size={14} /> Develop Green Buffer Plan <ArrowRight size={13} />
            </Link>
          </div>

          {/* Industrial Decision Summary */}
          <div className="mt-8 bg-gradient-to-br from-databue/10 via-panel to-panel light:from-databue/5 light:via-white light:to-white border border-databue/20 rounded-3xl p-6 shadow-lg">
            <p className="text-[10px] font-mono text-databue font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Factory size={13} /> EXECUTIVE DECISION SUMMARY
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase mb-1">Compliance status</p>
                <p className="text-xs text-mist light:text-ink font-semibold">{complianceStatus ? complianceLabel[complianceStatus] : 'Awaiting measurement'}</p>
                {gap && <p className="text-[10px] text-mist-dim light:text-ink/60 mt-0.5">Buffer gap: {gap.trees_needed.toLocaleString()} trees to {gap.target_green_cover}%</p>}
              </div>
              <div>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase mb-1">Carbon credit potential</p>
                <p className="text-xs text-mist light:text-ink font-semibold">{r.carbonOffset != null ? `~${r.carbonOffset} t CO₂/yr` : 'Not modeled'}</p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase mb-1">Investment range</p>
                <p className="text-xs text-mist light:text-ink font-semibold">Use simulator above for estimates</p>
              </div>
            </div>
            <p className="text-[10px] text-mist-dim light:text-ink/50 leading-relaxed">
              Use the impact simulator above to explore green buffer scenarios. All figures are planning estimates — not regulatory guarantees.
            </p>
          </div>

          {/* Honesty disclaimer */}
          <div className="mt-6 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
            <p className="text-[9px] font-mono text-mist-dim light:text-ink/40 leading-relaxed">
              GreenVision industrial assessment &middot; Species conditioned on local weather, soil and elevation &middot; Figures are planning estimates, not regulatory guarantees &middot; GreenVision does not model pollutant reduction — buffer planting is recommended as a planning heuristic for environmental responsibility
            </p>
          </div>

          <ClimateGPTWidget />
        </div>
      </main>
    </div>
  );
}


export default function Dashboard() {
  const location = useLocation();
  const { mode } = useMode();
  const isMunicipal = mode === MODES.MUNICIPAL;
  const isIndustrial = mode === MODES.INDUSTRIAL;
  const r = location.state?.result || getCurrentScene();
  const storedLoc = getUserLocation();
  const loc = r?.gps ?? r?.userLocation ?? storedLoc;

  if (isMunicipal || isIndustrial) {
    if (!r) {
      return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">
          <div>
            <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${isIndustrial ? 'text-databue bg-databue/10 border-databue/20' : 'text-canopy bg-canopy/10 border-canopy/20'} px-3 py-1 rounded-full border`}>
              {isIndustrial ? 'INDUSTRIAL SITE' : 'MUNICIPAL GREEN ASSESSMENT'}
            </span>
            <h1 className="font-display text-2xl md:text-4xl font-bold text-mist light:text-ink mt-2">
              {isIndustrial ? 'Site Assessment Dashboard' : 'Green Cover Diagnosis'}
            </h1>
            <p className="text-mist-dim light:text-ink/60 text-sm mt-1 max-w-2xl">
              Upload an aerial or satellite image to start analysis.
            </p>
          </div>
          <Link to="/upload" className={`inline-flex items-center gap-2 text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg ${isIndustrial ? 'bg-databue shadow-databue/20' : 'bg-canopy shadow-canopy/20'}`}>
            <ArrowRight size={14} /> Upload an image to analyze
          </Link>
        </div>
      );
    }
    if (isIndustrial) return <IndustrialSite r={r} />;
    return <MunicipalDashboard r={r} />;
  }
  return <CitizenArea scene={r} location={loc} />;
}

