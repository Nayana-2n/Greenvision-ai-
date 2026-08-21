import { Link } from 'react-router-dom';
import { ArrowUpRight, TreePine, MapPin, Sprout, Factory, Building2, User } from 'lucide-react';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

// Municipal: generic illustration of the analysis workflow — no fabricated
// metrics, no "live" claims. The pipeline runs after a real upload.
function PipelinePreview() {
  return (
    <div className="relative w-full max-w-md mx-auto md:mx-0">
      <div className="absolute -inset-4 bg-canopy/15 blur-3xl rounded-full pointer-events-none" />

      <div className="relative bg-panel/90 light:bg-white/90 backdrop-blur-xl border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-mono text-mist-dim light:text-ink/50 tracking-wider mb-0.5">UPLOADED SCENE</p>
            <p className="font-display font-semibold text-mist light:text-ink">Aerial / drone imagery</p>
          </div>
          <div className="flex items-center gap-1.5 bg-canopy/15 text-canopy text-xs font-mono font-semibold px-3 py-1.5 rounded-full border border-canopy/25">
            <TreePine size={14} />
            ANALYSIS PIPELINE
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden aspect-video bg-ink border border-white/10 mb-5">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(63,163,77,0.5) 0 12%, transparent 13%), radial-gradient(circle at 62% 55%, rgba(63,163,77,0.4) 0 9%, transparent 10%), radial-gradient(circle at 74% 32%, rgba(63,163,77,0.45) 0 7%, transparent 8%), radial-gradient(circle at 44% 70%, rgba(63,163,77,0.35) 0 6%, transparent 7%)' }} />
          <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur px-4 py-2 rounded-xl text-white font-mono text-xs flex justify-between">
            <span>Canopy segmentation mask</span>
            <span className="text-canopy font-bold">MODEL OUTPUT</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Trees estimated' },
            { label: 'Canopy cover' },
            { label: 'CO₂ per year' },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 light:bg-black/5 rounded-xl p-3 border border-white/8 light:border-black/8">
              <div className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">{s.label}</div>
              <div className="mt-1.5 text-[11px] font-mono text-canopy">rendered after analysis</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-5 -right-3 md:-right-6 bg-canopy text-white text-xs font-mono font-bold px-4 py-2.5 rounded-xl shadow-xl shadow-canopy/30 flex items-center gap-2">
        <TreePine size={14} />
        Your diagnosis lands here
      </div>
    </div>
  );
}

// Industrial: green-buffer planning around an industrial site — no pollution
// claims, only a vegetation-buffer intervention.
function BufferPlan() {
  return (
    <div className="relative w-full max-w-md mx-auto md:mx-0">
      <div className="absolute -inset-4 bg-canopy/15 blur-3xl rounded-full pointer-events-none" />
      <div className="relative bg-panel/90 light:bg-white/90 backdrop-blur-xl border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 tracking-wider">INDUSTRIAL SITE</p>
          <div className="flex items-center gap-1.5 bg-canopy/15 text-canopy text-xs font-mono font-semibold px-3 py-1.5 rounded-full border border-canopy/25">
            <Factory size={14} />
            GREEN-BUFFER PLAN
          </div>
        </div>

        {[
          { icon: Factory, t: 'Site green diagnosis', d: 'Canopy cover, priority and planting target' },
          { icon: Sprout, t: 'Buffer species', d: 'Pollution-tolerant species, rule-based ranking' },
          { icon: TreePine, t: 'Calculated impact', d: 'CO₂ / O₂ / canopy — pollutant reduction not quantified' },
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-3 bg-white/5 light:bg-black/5 rounded-2xl p-4 border border-white/8 light:border-black/8">
            <span className="w-8 h-8 rounded-full bg-canopy/15 text-canopy flex items-center justify-center shrink-0"><s.icon size={16} /></span>
            <div>
              <p className="text-sm font-semibold text-mist light:text-ink">{s.t}</p>
              <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-0.5">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Citizen: the location-first flow — where you live → real environment → best trees.
function LocationFlow() {
  return (
    <div className="relative w-full max-w-md mx-auto md:mx-0">
      <div className="absolute -inset-4 bg-canopy/15 blur-3xl rounded-full pointer-events-none" />
      <div className="relative bg-panel/90 light:bg-white/90 backdrop-blur-xl border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 tracking-wider">YOUR NEIGHBOURHOOD</p>
          <div className="flex items-center gap-1.5 bg-canopy/15 text-canopy text-xs font-mono font-semibold px-3 py-1.5 rounded-full border border-canopy/25">
            <MapPin size={14} />
            REAL CONTEXT
          </div>
        </div>

        {[
          { icon: MapPin, t: 'Where you live', d: 'Pick your area — no image upload needed' },
          { icon: Sprout, t: 'What to plant', d: 'Species ranked with an honest rule-based score' },
          { icon: TreePine, t: 'One-tree impact', d: '22 kg CO₂ absorbed · 118 kg O₂ per year' },
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-3 bg-white/5 light:bg-black/5 rounded-2xl p-4 border border-white/8 light:border-black/8">
            <span className="w-8 h-8 rounded-full bg-canopy/15 text-canopy flex items-center justify-center shrink-0"><s.icon size={16} /></span>
            <div>
              <p className="text-sm font-semibold text-mist light:text-ink">{s.t}</p>
              <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-0.5">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  const { mode } = useMode();
  const isMunicipal = mode === MODES.MUNICIPAL;
  const isIndustrial = mode === MODES.INDUSTRIAL;

  const badge = isMunicipal
    ? 'MEASURE → UNDERSTAND → PLAN → ACT'
    : isIndustrial
      ? 'MEASURE → UNDERSTAND → PLAN → ACT'
      : 'MEASURE → UNDERSTAND → PLAN → ACT';

  const headline = isMunicipal ? (
    <>Turn urban imagery into<br /><span className="ndvi-text">an actionable green plan</span>.</>
  ) : isIndustrial ? (
    <>Turn a site analysis into<br /><span className="ndvi-text">a green-buffer plan</span>.</>
  ) : (
    <>Turn your location into<br /><span className="ndvi-text">a real planting plan</span>.</>
  );

  const sub = isMunicipal
    ? 'Measure the canopy gap → Understand why it matters → Get a species-level planting plan → Act with a costed, reportable brief.'
    : isIndustrial
      ? 'Measure your site buffer → Understand the deficit → Plan a green-buffer intervention → Act with species, cost and calculated CO₂/O₂.'
      : 'Measure your area → Understand the climate context → Plan the right trees → Act with species, care and what each tree does.';

  const cta = isMunicipal
    ? { to: '/upload', label: 'Analyze an aerial image' }
    : isIndustrial
      ? { to: '/upload', label: 'Analyze the site' }
      : { to: '/planting', label: 'Start with my location' };

  const secondary = isMunicipal
    ? { to: '/reports', icon: Building2, label: 'View assessment reports →' }
    : isIndustrial
      ? { to: '/reports', icon: Factory, label: 'View site report →' }
      : { to: '/advisor', icon: User, label: 'Ask the AI advisor →' };

  const visual = isMunicipal ? <PipelinePreview /> : isIndustrial ? <BufferPlan /> : <LocationFlow />;

  return (
    <section className="max-w-6xl mx-auto px-6 pt-14 pb-24 grid md:grid-cols-2 gap-16 lg:gap-20 items-center">
      {/* Left: Text & CTAs */}
      <div className="order-2 md:order-1 text-center md:text-left">
        <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-canopy border border-canopy/25 rounded-full px-3 py-1.5 mb-7 bg-canopy/8 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-canopy" />
          {badge}
        </div>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight mb-6 text-mist light:text-ink">
          {headline}
        </h1>

        <p className="text-mist-dim light:text-ink/70 text-lg leading-relaxed mb-9 max-w-lg mx-auto md:mx-0">
          {sub}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
          <Link
            to={cta.to}
            className="group relative inline-flex items-center gap-2 bg-canopy text-white font-semibold px-7 py-3.5 rounded-full hover:scale-105 transition-all duration-300 shadow-lg shadow-canopy/25 overflow-hidden w-full sm:w-auto justify-center"
          >
            <span className="relative z-10">{cta.label}</span>
            <ArrowUpRight size={18} className="relative z-10 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
          </Link>
          <Link
            to={secondary.to}
            className="text-mist-dim light:text-ink/60 hover:text-mist light:hover:text-ink transition-colors text-sm font-medium px-4 py-3 sm:py-0 w-full sm:w-auto text-center hover:underline underline-offset-4 inline-flex items-center justify-center gap-1.5"
          >
            <secondary.icon size={14} /> {secondary.label}
          </Link>
        </div>
      </div>

      {/* Right: mode-aware visual */}
      <div className="order-1 md:order-2 flex justify-center md:justify-end">
        {visual}
      </div>
    </section>
  );
}
