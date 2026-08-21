import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapContainer, TileLayer, CircleMarker, Popup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Satellite, Building2, Factory, User, ArrowRight, TreePine, Leaf,
  Cloud, Wind, MapPin, Sparkles, BarChart3, Target,
  CheckCircle2, AlertTriangle, Globe,
} from 'lucide-react';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

const WORKSPACES = [
  {
    mode: MODES.MUNICIPAL,
    icon: Building2,
    title: 'Municipal',
    tagline: 'Plan urban green infrastructure',
    color: 'canopy',
    features: [
      'Assess green cover across wards',
      'Identify priority intervention zones',
      'Plan plantation strategy',
      'Estimate investment requirements',
      'Generate decision-ready reports',
    ],
  },
  {
    mode: MODES.INDUSTRIAL,
    icon: Factory,
    title: 'Industrial',
    tagline: 'Build environmental responsibility into operations',
    color: 'databue',
    features: [
      'Assess site green-buffer status',
      'Identify plantation requirements',
      'Track environmental contributions',
      'Plan investment for compliance',
      'Monitor community green actions',
    ],
  },
  {
    mode: MODES.CITIZEN,
    icon: User,
    title: 'Citizen',
    tagline: 'Make your neighbourhood greener',
    color: 'earth',
    features: [
      'Understand your local environment',
      'Ask GreenVision AI anything',
      'Discover suitable planting options',
      'Record your green actions',
      'Join the Green Champions community',
    ],
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Analyze', desc: 'Upload an aerial image or set your location for environmental context.', icon: BarChart3 },
  { step: '02', title: 'Understand', desc: 'GreenVision measures canopy cover, tree density, carbon offset and oxygen production.', icon: Target },
  { step: '03', title: 'Plan', desc: 'Get species recommendations, planting gaps, investment estimates and priority zones.', icon: Sparkles },
  { step: '04', title: 'Act', desc: 'Generate intervention plans, log contributions and track community progress.', icon: CheckCircle2 },
];

const CAN_MEASURE = [
  { label: 'Green cover percentage', icon: Leaf },
  { label: 'Tree count estimates', icon: TreePine },
  { label: 'Carbon sequestration', icon: Cloud },
  { label: 'Oxygen production', icon: Wind },
  { label: 'Location context', icon: MapPin },
  { label: 'Investment estimates', icon: BarChart3 },
];

const DOES_NOT_CLAIM = [
  'Temperature reduction from planting',
  'Pollution or AQI reduction models',
  'AI-verified photo authentication',
  'Guaranteed tree survival rates',
  'Exact government savings',
];

/* Animated green dot on the map */
function AnimatedDot({ center, delay }) {
  return (
    <CircleMarker
      center={center}
      radius={4}
      pathOptions={{
        color: '#3FA34D',
        fillColor: '#3FA34D',
        fillOpacity: 0.7,
        weight: 1,
      }}
      className="animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Popup className="font-mono text-xs">Green coverage data point</Popup>
    </CircleMarker>
  );
}

export default function Landing() {
  const { setMode } = useMode();
  const navigate = useNavigate();
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const enterWorkspace = (mode) => {
    setMode(mode);
    navigate('/dashboard');
  };

  return (
    <div className="space-y-0">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-canopy/8 blur-[120px] rounded-full" />
          <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-databue/6 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Text */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full">
                <Satellite size={14} /> GREENVISION.AI
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-mist light:text-ink leading-[1.1] tracking-tight">
                Turn environmental data
                <span className="text-canopy"> into green action.</span>
              </h1>
              <p className="text-mist-dim light:text-ink/60 text-base md:text-lg leading-relaxed max-w-xl">
                GreenVision.AI combines computer vision, geospatial context and environmental data to help cities,
                industries and communities understand where greenery is needed and what action can be taken.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => enterWorkspace(MODES.CITIZEN)}
                  className="inline-flex items-center gap-2 bg-canopy text-white text-sm font-semibold px-6 py-3.5 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/25"
                >
                  Explore GreenVision <ArrowRight size={16} />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 border border-white/20 light:border-black/15 text-mist light:text-ink text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-white/5 light:hover:bg-black/5 transition-colors"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* Animated Map Visual */}
            <div className="relative h-[320px] md:h-[400px] rounded-3xl overflow-hidden border border-white/10 light:border-black/10 shadow-2xl">
              {mapReady ? (
                <MapContainer
                  center={[20.5937, 78.9629]}
                  zoom={4}
                  scrollWheelZoom={false}
                  dragging={false}
                  zoomControl={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution=""
                  />
                  {/* Indian cities as green dots */}
                  {[
                    [12.9716, 77.5946],
                    [19.076, 72.8777],
                    [28.6139, 77.209],
                    [26.9124, 75.7873],
                    [17.385, 78.4867],
                    [13.0827, 80.2707],
                    [22.5726, 88.3639],
                    [34.1526, 77.5771],
                    [15.38, 75.33],
                    [23.0225, 72.5714],
                    [9.9312, 76.2673],
                    [21.1702, 72.8311],
                  ].map((c, i) => (
                    <AnimatedDot key={i} center={c} delay={i * 200} />
                  ))}
                </MapContainer>
              ) : (
                <div className="w-full h-full bg-panel flex items-center justify-center">
                  <div className="text-canopy animate-pulse"><Globe size={32} /></div>
                </div>
              )}
              {/* Overlay label */}
              <div className="absolute bottom-4 left-4 z-[500] bg-ink/80 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10 shadow-lg">
                <p className="text-[10px] font-mono text-mist-dim uppercase tracking-wider">Live environmental context across India</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE WORKSPACES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
            One platform. Three ways to act.
          </h2>
          <p className="text-mist-dim light:text-ink/60 text-sm max-w-2xl mx-auto">
            GreenVision serves different audiences from the same underlying data — each workspace is tailored to a specific type of green decision.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {WORKSPACES.map((w) => {
            const Icon = w.icon;
            const accentBg = w.mode === MODES.MUNICIPAL ? 'bg-canopy/10' : w.mode === MODES.INDUSTRIAL ? 'bg-databue/10' : 'bg-earth/10';
            const accentText = w.mode === MODES.MUNICIPAL ? 'text-canopy' : w.mode === MODES.INDUSTRIAL ? 'text-databue' : 'text-earth';
            const hoverBorder = w.mode === MODES.MUNICIPAL ? 'hover:border-canopy/40' : w.mode === MODES.INDUSTRIAL ? 'hover:border-databue/40' : 'hover:border-earth/40';
            const btnBg = w.mode === MODES.MUNICIPAL ? 'bg-canopy hover:bg-canopy/90' : w.mode === MODES.INDUSTRIAL ? 'bg-databue hover:bg-databue/90' : 'bg-earth hover:bg-earth/90';
            return (
              <div
                key={w.mode}
                className={`group bg-panel light:bg-white border border-white/10 light:border-black/10 ${hoverBorder} rounded-3xl p-6 md:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col`}
              >
                <div className={`w-12 h-12 rounded-2xl ${accentBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={24} className={accentText} />
                </div>
                <h3 className="font-display font-bold text-xl text-mist light:text-ink">{w.title}</h3>
                <p className={`text-xs font-mono ${accentText} mt-1 mb-4`}>{w.tagline}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {w.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-mist-dim light:text-ink/60">
                      <CheckCircle2 size={13} className={`${accentText} shrink-0 mt-0.5`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => enterWorkspace(w.mode)}
                  className={`w-full inline-flex items-center justify-center gap-2 ${btnBg} text-white text-xs font-mono font-semibold px-5 py-3 rounded-full transition-transform hover:scale-105 shadow-lg`}
                >
                  Enter workspace <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-white/5 light:border-black/5">
        <div className="text-center mb-12 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
            How GreenVision works
          </h2>
          <p className="text-mist-dim light:text-ink/60 text-sm max-w-xl mx-auto">
            From image to intervention plan in four steps.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.step} className="relative bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 text-center space-y-3 group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-canopy text-white text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full">
                  {h.step}
                </div>
                <div className="w-10 h-10 rounded-xl bg-canopy/10 flex items-center justify-center mx-auto mt-2 group-hover:scale-110 transition-transform">
                  <Icon size={20} className="text-canopy" />
                </div>
                <h3 className="font-display font-bold text-mist light:text-ink">{h.title}</h3>
                <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">{h.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WHAT GREENVISION CAN MEASURE ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-white/5 light:border-black/5">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-4">
            <h2 className="font-display text-3xl font-bold text-mist light:text-ink">
              What GreenVision measures
            </h2>
            <p className="text-mist-dim light:text-ink/60 text-sm leading-relaxed">
              Every value is source-labelled. GreenVision shows what can be measured or calculated from available data, and clearly marks what cannot.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CAN_MEASURE.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="flex items-center gap-2.5 bg-canopy/10 border border-canopy/20 rounded-xl px-3.5 py-2.5">
                    <Icon size={16} className="text-canopy shrink-0" />
                    <span className="text-xs font-mono text-mist light:text-ink font-medium">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-display text-3xl font-bold text-mist light:text-ink">
              What GreenVision does not claim
            </h2>
            <p className="text-mist-dim light:text-ink/60 text-sm leading-relaxed">
              Transparency is a core principle. If GreenVision cannot validate a claim, it says so clearly.
            </p>
            <div className="space-y-2.5">
              {DOES_NOT_CLAIM.map((d) => (
                <div key={d} className="flex items-center gap-2.5 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-xl px-4 py-3">
                  <AlertTriangle size={14} className="text-earth shrink-0" />
                  <span className="text-xs font-mono text-mist-dim light:text-ink/70">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="bg-gradient-to-br from-canopy/15 via-panel to-panel light:from-canopy/10 light:via-white light:to-white border border-canopy/20 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-canopy/20 flex items-center justify-center mx-auto">
            <Leaf size={32} className="text-canopy" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
            Start with your workspace
          </h2>
          <p className="text-mist-dim light:text-ink/60 text-sm max-w-xl mx-auto">
            Whether you are a municipal planner, an industrial responsibility officer, or a citizen who wants to act — GreenVision has a workspace for you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {WORKSPACES.map((w) => {
              const Icon = w.icon;
              const btnBg = w.mode === MODES.MUNICIPAL ? 'bg-canopy' : w.mode === MODES.INDUSTRIAL ? 'bg-databue' : 'bg-earth';
              return (
                <button
                  key={w.mode}
                  onClick={() => enterWorkspace(w.mode)}
                  className={`inline-flex items-center gap-2 ${btnBg} text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg`}
                >
                  <Icon size={14} /> {w.title} workspace
                </button>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
