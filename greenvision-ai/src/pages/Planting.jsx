import { useState, useEffect, useMemo, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  Sprout, MapPin, Target, BadgeCheck, Loader2, AlertTriangle,
  Droplets, Sun, Trees, RefreshCw, Info, User, Building2, Factory, IndianRupee,
  Bot, Send as SendIcon,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import LocationInput from '../components/LocationInput';
import { recommendPlanting, askAdvisor, extractError } from '../api/api';
import { getCurrentScene } from '../utils/sceneStore';
import { getUserLocation, setUserLocation } from '../utils/locationStore';
import { buildAdvisorContext, advisorPrompts } from '../utils/advisor';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

const OBJECTIVES = [
  { id: 'shade', label: 'Shade', hint: 'Maximise canopy area' },
  { id: 'fast', label: 'Fast cover', hint: 'Quickest green gain' },
  { id: 'pollution', label: 'Air quality', hint: 'Pollution-tolerant species' },
  { id: 'biodiversity', label: 'Biodiversity', hint: 'Native, bird-supporting' },
];

function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-mono text-canopy font-semibold uppercase tracking-widest flex items-center gap-1.5">
        <Icon size={14} /> {title}
      </p>
      {sub && <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-0.5">{sub}</p>}
    </div>
  );
}

// GreenVision suitability score — a rule-based planning ranking (0-100),
// explicitly NOT a scientific measurement. Same numbers drive the species
// engine on the backend and the municipal report.
function SuitabilityScore({ species }) {
  const pct = species.suitability_score ?? 0;
  const color = pct >= 70 ? 'text-canopy' : pct >= 40 ? 'text-earth' : 'text-mist-dim';
  const barColor = pct >= 70 ? 'bg-canopy' : pct >= 40 ? 'bg-earth' : 'bg-mist-dim/40';
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">GreenVision score</span>
        <span className={`font-mono font-bold text-lg ${color}`}>{pct}</span>
      </div>
      <div className="mt-1 h-1.5 bg-white/10 light:bg-black/10 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[9px] font-mono text-mist-dim/70 light:text-ink/30 leading-tight">
        rule-based planning ranking, not scientific truth
      </p>
    </div>
  );
}

function CareChecklist({ s }) {
  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-mist-dim light:text-ink/60">
      <div className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-lg px-2 py-1.5">
        <span className="flex items-center gap-1"><Droplets size={11} className="text-databue" /> Water</span>
        <span className="block text-mist light:text-ink font-semibold capitalize mt-0.5">{s.water_requirement}</span>
      </div>
      <div className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-lg px-2 py-1.5">
        <span className="flex items-center gap-1"><Sun size={11} className="text-earth" /> Sun</span>
        <span className="block text-mist light:text-ink font-semibold capitalize mt-0.5">{s.sun_requirement}</span>
      </div>
      <div className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-lg px-2 py-1.5">
        <span className="flex items-center gap-1"><Trees size={11} className="text-canopy" /> Spacing</span>
        <span className="block text-mist light:text-ink font-semibold mt-0.5">{s.spacing_m} m</span>
      </div>
      <div className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-lg px-2 py-1.5">
        <span className="flex items-center gap-1"><Sprout size={11} className="text-chlorophyll" /> Growth</span>
        <span className="block text-mist light:text-ink font-semibold capitalize mt-0.5">{s.growth_rate}</span>
      </div>
    </div>
  );
}

export default function Planting() {
  const { mode } = useMode();
  const isMunicipal = mode === MODES.MUNICIPAL;
  const isIndustrial = mode === MODES.INDUSTRIAL;
  const plannerMode = isMunicipal || isIndustrial;

  const r = getCurrentScene();
  const [objective, setObjective] = useState(isIndustrial ? 'pollution' : 'shade');
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Citizen chatbot state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [chatInited, setChatInited] = useState(false);
  const chatEndRef = useRef(null);

  const gps = r?.gps;
  const manual = r?.userLocation;
  const stored = plannerMode ? null : getUserLocation();
  const [loc, setLoc] = useState(manual ?? stored);

  const lat = gps?.lat ?? loc?.lat;
  const lng = gps?.lng ?? loc?.lng;
  const name = gps ? r?.locationName : (loc?.name || '');

  const hasLocation = lat != null && lng != null;
  const hasScene = !!r;

  const setLocAndStore = (next) => {
    setLoc(next);
    if (next?.lat != null && next?.lng != null) setUserLocation(next);
  };

  useMemo(
    () => (plannerMode ? [] : advisorPrompts(r, mode).slice(0, 4)),
    [r, mode, plannerMode],
  );

  const sendChatMessage = async (text) => {
    const query = (text || chatInput).trim();
    if (!query || chatPending) return;
    if (!text) setChatInput('');
    const userMsg = { sender: 'user', text: query };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatPending(true);
    try {
      const context = await buildAdvisorContext(mode, r);
      const historyForBackend = chatMessages.map((m) => ({ sender: m.sender, text: m.text }));
      const res = await askAdvisor(query, context, historyForBackend);
      const reply = res?.reply || res?.answer || 'The advisor did not return a response.';
      setChatMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: 'bot', text: `Advisor unavailable: ${extractError(err)}` }]);
    } finally {
      setChatPending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatPending]);

  // Auto-send a greeting when chatbot first appears
  useEffect(() => {
    if (chatInited) return;
    setChatInited(true);
    const greet = async () => {
      setChatPending(true);
      try {
        const context = await buildAdvisorContext(mode, r);
        const res = await askAdvisor('hi', context, []);
        const reply = res?.reply || 'Hi! Ask me about trees, planting, or your local environment.';
        setChatMessages([{ sender: 'bot', text: reply }]);
      } catch {
        setChatMessages([{ sender: 'bot', text: 'Hi! I\'m GreenVision. Ask me about trees, planting, costs, or your local environment.' }]);
      } finally {
        setChatPending(false);
      }
    };
    greet();
  }, [chatInited, mode, r]);

  const payload = useMemo(
    () => ({ lat, lng, name, scene: r ?? {}, objective }),
    [lat, lng, name, r, objective],
  );

  useEffect(() => {
    if (!hasLocation) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    recommendPlanting(payload)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(extractError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [payload, hasLocation, nonce]);

  // Municipal & industrial planning need an analyzed scene; citizens can plan by location alone.
  if (plannerMode && !hasScene) return <Navigate to="/upload" replace />;

  return (
    <div className="flex flex-1 w-full relative">
      {plannerMode && <Sidebar sceneId={r.sceneId} />}
      <main className={`flex-1 w-full ${plannerMode ? 'lg:w-[calc(100%-18rem)]' : ''} overflow-x-hidden`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">

          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <span className="text-xs font-mono text-canopy font-semibold uppercase tracking-wider bg-canopy/10 px-3 py-1 rounded-full border border-canopy/20">
                PLANTING ADVISOR
              </span>
              <h1 className="font-display text-2xl md:text-4xl font-bold text-mist light:text-ink mt-2">
                {isMunicipal ? 'Planting Plan' : isIndustrial ? 'Green Buffer Species' : 'What should I plant?'}
              </h1>
              <p className="text-mist-dim light:text-ink/55 text-xs font-mono mt-1">
                {isMunicipal
                  ? 'Ask GreenVision about species, cost, and planting strategy for this area.'
                  : isIndustrial
                  ? 'Ask GreenVision about pollution-tolerant species, buffer planning and investment.'
                  : 'Ask GreenVision about species, cost, water needs and what to plant in your area.'}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-full border ${
              plannerMode ? 'bg-earth/15 text-earth border-earth/30' : 'bg-canopy/15 text-canopy border-canopy/30'
            }`}>
              {isIndustrial ? <Factory size={13} /> : plannerMode ? <Building2 size={13} /> : <User size={13} />}
              {isMunicipal ? 'Municipal planning' : isIndustrial ? 'Industrial buffer' : 'Personal planting'}
            </div>
          </div>

          {/* Citizen / industrial without a location: location-first */}
          {!isMunicipal && !hasLocation && (
            <div className="mb-8 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 light:border-black/10">
                <span className="text-canopy font-bold flex items-center gap-1.5"><MapPin size={16} /> WHERE IS THIS PLACE?</span>
                <span className="text-mist-dim light:text-ink/50 font-mono text-[10px]">Step 1 of 2</span>
              </div>
              <p className="text-sm text-mist-dim light:text-ink/60 mb-4 max-w-2xl">
                Set the location so GreenVision can condition species on the real local environment (elevation, weather,
                air quality, soil).
              </p>
              <LocationInput value={loc} onChange={setLocAndStore} />
            </div>
          )}

          {/* Municipal with a scene but no location */}
          {hasLocation && (
            <div className="mb-8 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
              <SectionTitle
                icon={MapPin}
                title="Objective"
                sub={`Planning location: ${name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`} · ${gps ? 'from image metadata' : 'user-entered'}`}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setObjective(o.id)}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                      objective === o.id
                        ? 'bg-canopy/15 border-canopy/40 text-mist light:text-ink'
                        : 'bg-white/5 light:bg-white border-white/10 light:border-black/10 text-mist-dim light:text-ink/60 hover:border-canopy/30'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className="block text-[10px] font-mono text-mist-dim light:text-ink/40 mt-0.5">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasLocation && plannerMode && (
            <p className="text-sm font-mono text-mist-dim light:text-ink/50 text-center py-16">
              Set a scene location to build a {isIndustrial ? 'green buffer plan' : 'planting plan'}.
            </p>
          )}

          {/* Ask GreenVision — primary chatbot interaction for ALL modes */}
          {(hasLocation || !plannerMode) && (
            <div className="mb-8 bg-panel light:bg-white border border-canopy/20 rounded-3xl overflow-hidden shadow-xl">
              <div className="bg-canopy/10 border-b border-white/10 light:border-black/10 p-4 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-canopy/20 text-canopy flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-mist light:text-ink">Ask GreenVision</h3>
                  <span className="text-[10px] font-mono text-mist-dim light:text-ink/50">
                    {plannerMode
                      ? 'Ask about species, cost, buffer planning, or what to plant for this site.'
                      : 'Ask about species, cost, water needs, or what to plant in your area.'}
                  </span>
                </div>
              </div>

              {chatMessages.length === 0 && (
                <div className="p-3 border-b border-white/5 light:border-black/5 bg-white/5 light:bg-black/5 flex flex-wrap gap-1.5">
                  {(plannerMode ? [
                    'What tree should I plant here?',
                    'How much would 100 trees cost?',
                    'Which species tolerate pollution?',
                    'Why was Neem recommended?',
                  ] : [
                    'What tree should I plant here?',
                    'I have limited water. What should I plant?',
                    'Which tree needs less maintenance?',
                    'Can I plant a large tree here?',
                  ]).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendChatMessage(p)}
                      className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 px-2.5 py-1 rounded-full hover:border-canopy hover:text-canopy transition-colors text-[11px] font-mono"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div className="h-64 overflow-y-auto p-4 space-y-3 font-body text-xs">
                {chatMessages.length === 0 && !chatPending && (
                  <p className="text-center text-mist-dim/50 light:text-ink/30 text-xs py-8">
                    Ask about species, cost, water needs, or what to plant in your area.
                  </p>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${m.sender === 'user' ? 'bg-databue/20 text-databue' : 'bg-canopy/20 text-canopy'}`}>
                      {m.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed whitespace-pre-line ${
                      m.sender === 'user'
                        ? 'bg-canopy text-white rounded-tr-none'
                        : 'bg-white/5 light:bg-black/5 text-mist light:text-ink border border-white/8 light:border-black/8 rounded-tl-none'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatPending && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-canopy/20 text-canopy"><Bot size={14} /></div>
                    <div className="rounded-2xl p-3 bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-tl-none flex items-center gap-2 text-mist-dim light:text-ink/60">
                      <Loader2 size={13} className="animate-spin" /> Reading your area context…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-white/10 light:border-black/10 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about species, cost, water, or what to plant..."
                  className="flex-1 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-full px-4 py-2 text-xs text-mist light:text-ink focus:outline-none focus:border-canopy"
                />
                <button
                  onClick={() => sendChatMessage()}
                  disabled={chatPending}
                  className="w-9 h-9 rounded-full bg-canopy text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <SendIcon size={14} />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200/90 light:text-red-700">{error}</p>
            </div>
          )}

          {loading && !data && (
            <div className="flex items-center gap-3 text-sm font-mono text-mist-dim light:text-ink/50 py-16 justify-center">
              <Loader2 size={18} className="text-canopy animate-spin" />
              {hasLocation ? 'Ranking species from live local context…' : 'Waiting for a location…'}
            </div>
          )}

          {data && hasLocation && (
            <div className="space-y-6">
              {/* WHY */}
              {data.why && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
                  <SectionTitle icon={Target} title="Why" sub="Grounded in the measured canopy gap" />
                  <p className="text-sm text-mist light:text-ink leading-relaxed">{data.why}</p>
                  {data.where && (
                    <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-2">
                      Scope: {data.where.scope} · Location: {data.where.location || '—'} · Plantation priority: {data.where.plantation_priority}
                    </p>
                  )}
                </div>
              )}

              {/* HOW MANY (municipal / industrial / measured scenes) */}
              {(plannerMode || data.target?.computable) && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
                  <SectionTitle icon={Trees} title="How many" sub="Target = 60% canopy · transparent arithmetic" />
                  <p className="text-sm text-mist light:text-ink leading-relaxed">{data.how_many}</p>
                  {data.target?.computable ? (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        ['Current canopy', `${data.target.current_green_cover}%`],
                        ['Canopy area', `${data.target.current_canopy_m2?.toLocaleString()} m²`],
                        ['Scene area', `${data.target.scene_total_m2?.toLocaleString()} m²`],
                        ['Canopy / tree', `${data.target.canopy_m2_per_tree_assumed} m²`],
                      ].map(([l, v]) => (
                        <div key={l} className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-3 py-2.5">
                          <span className="block text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">{l}</span>
                          <span className="block text-sm font-mono font-semibold text-mist light:text-ink mt-0.5">{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-mono text-mist-dim light:text-ink/50">{data.target?.reason}</p>
                  )}
                  {data.target?.indicative_only && (
                    <p className="mt-3 text-[11px] font-mono text-amber-400 light:text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {data.target?.disclosure}
                    </p>
                  )}
                </div>
              )}

              {/* BUDGET (planning estimate, configurable assumptions) */}
              {plannerMode && data.budget?.available && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
                  <SectionTitle
                    icon={IndianRupee}
                    title="Estimated investment"
                    sub={data.budget.formula}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ['Sapling cost', data.budget.line_items?.sapling_cost_inr, '₹ per-tree sapling'],
                      ['Planting labour', data.budget.line_items?.planting_labour_inr, 'per-tree labour'],
                      [`Maintenance × ${data.budget.maintenance_years ?? 1} yr`, data.budget.line_items?.maintenance_inr, 'water / care'],
                    ].map(([label, value, note]) => (
                      <div key={label} className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-3 py-2.5">
                        <span className="block text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">{label}</span>
                        <span className="block text-sm font-mono font-semibold text-mist light:text-ink mt-0.5">₹{Number(value ?? 0).toLocaleString('en-IN')}</span>
                        <span className="block text-[9px] font-mono text-mist-dim light:text-ink/40 mt-0.5">{note}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between flex-wrap gap-2 bg-canopy/10 border border-canopy/25 rounded-xl px-4 py-3">
                    <span className="text-xs font-mono text-mist light:text-ink font-semibold">
                      Total · {data.budget.tree_count?.toLocaleString()} trees
                    </span>
                    <span className="font-display font-bold text-2xl text-canopy">{data.budget.total_estimate_inr_formatted}</span>
                  </div>
                  <p className="mt-3 text-[11px] font-mono text-amber-400 light:text-amber-600 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {data.budget.disclosure}
                  </p>
                </div>
              )}

              {/* WHAT */}
              <div>
                <SectionTitle
                  icon={Sprout}
                  title={isMunicipal ? 'What to plant' : isIndustrial ? 'Buffer species' : 'Supporting recommendations'}
                  sub="Rule-based ranking for the selected objective · planning references, not guarantees"
                />
                <div className="grid md:grid-cols-2 gap-4">
                  {data.species?.map((s, i) => (
                    <div key={s.id} className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-block text-[9px] font-mono px-2 py-0.5 rounded-full border mb-1.5 text-mist-dim light:text-ink/50 border-white/10 light:border-black/10">
                            #{i + 1} · {s.status}
                          </span>
                          <h3 className="font-display font-bold text-mist light:text-ink">{s.common_name}</h3>
                          <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 italic">{s.scientific_name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <SuitabilityScore species={s} />
                          {s.score >= 3 ? (
                            <BadgeCheck size={18} className="text-canopy" />
                          ) : (
                            <BadgeCheck size={18} className="text-mist-dim/40" />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-mist-dim light:text-ink/60">
                        <span>H {s.height_m?.[0]}–{s.height_m?.[1]} m</span>
                        <span>Spread {s.canopy_spread_m?.[0]}–{s.canopy_spread_m?.[1]} m</span>
                        <span>Growth {s.growth_rate}</span>
                        <span className="flex items-center gap-1"><Droplets size={11} /> {s.water_requirement}</span>
                        <span className="flex items-center gap-1"><Sun size={11} /> {s.sun_requirement}</span>
                      </div>

                      <div className="mt-3">
                        {s.reasons?.length > 0 && (
                          <p className="text-[9px] font-mono text-mist-dim/60 light:text-ink/30 uppercase tracking-wider mb-1.5">WHY</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {s.reasons?.map((reason) => (
                            <span key={reason} className="text-[10px] font-mono bg-canopy/10 text-canopy border border-canopy/20 rounded-full px-2 py-0.5">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>

                      {s.notes && <p className="mt-3 text-[11px] text-mist-dim light:text-ink/60 leading-relaxed">{s.notes}</p>}

                      {/* Citizen: care checklist + one-tree impact */}
                      {!plannerMode && (
                        <>
                          <CareChecklist s={s} />
                          <p className="mt-3 text-[10px] font-mono text-canopy">
                            One tree of this species ≈ 22 kg CO₂ absorbed and 118 kg O₂ released per year (documented averages).
                          </p>
                        </>
                      )}

                      <p className="mt-2 text-[9px] font-mono text-mist-dim/60 light:text-ink/30">{s.source}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SOIL honesty + disclosures */}
              <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
                <SectionTitle icon={Info} title="Verification & disclosures" />
                <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed mb-3">{data.soil?.note}</p>
                <ul className="space-y-1.5">
                  {data.disclosures?.map((d) => (
                    <li key={d} className="text-[11px] font-mono text-mist-dim light:text-ink/50 flex items-start gap-2">
                      <span className="text-canopy mt-0.5">•</span> {d}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-3">
                <button
                  onClick={() => setNonce((n) => n + 1)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 text-xs font-mono text-mist-dim light:text-ink/50 hover:text-canopy transition-colors"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Re-run with current objective
                </button>
                {plannerMode && data.target?.computable && (
                  <Link
                    to="/reports"
                    className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-4 py-2.5 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20"
                  >
                    Generate {isIndustrial ? 'site' : 'municipal'} report →
                  </Link>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
