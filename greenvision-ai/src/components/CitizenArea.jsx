import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TreePine, Leaf, MapPin, Sprout, ArrowRight, Trophy, FileText,
  Loader2, Bot, Send, User as UserIcon, CheckCircle2,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LocationInput from './LocationInput';
import EnvironmentalContext from './EnvironmentalContext';
import { setUserLocation } from '../utils/locationStore';
import { getUserName, setUserName, timeGreeting } from '../utils/userStore';
import { buildAdvisorContext } from '../utils/advisor';
import { askAdvisor, getLocationContext, extractError } from '../api/api';

const leafletIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const GREEN_QUOTES = [
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'When you plant a tree, you plant hope.', author: 'Lucy Larcom' },
  { text: 'A society grows great when people plant trees in whose shade they shall never sit.', author: 'Greek Proverb' },
  { text: 'Someone is sitting in the shade today because someone planted a tree a long time ago.', author: 'Warren Buffett' },
  { text: 'The earth laughs in flowers.', author: 'Ralph Waldo Emerson' },
];

function ClickMapPicker({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function HeroMap({ loc, onPick }) {
  const center = loc?.lat != null ? [loc.lat, loc.lng] : [20.5937, 78.9629];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 light:border-black/10 h-64 sm:h-80 relative shadow-xl">
      <MapContainer
        center={center}
        zoom={loc?.lat != null ? 12 : 5}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <ClickMapPicker onPick={onPick} />
        {loc?.lat != null && <Marker position={[loc.lat, loc.lng]} icon={leafletIcon} />}
      </MapContainer>
      <span className="absolute bottom-2 left-2 z-[400] bg-ink/80 light:bg-white/90 text-[10px] font-mono text-mist-dim light:text-ink/50 px-2 py-1 rounded-lg border border-white/10 light:border-black/10">
        Click the map or search below to set your location
      </span>
    </div>
  );
}

function EnvChips({ envCtx }) {
  if (!envCtx) return null;
  const weather = envCtx.blocks?.weather?.data;
  const aq = envCtx.blocks?.air_quality?.data;
  const elev = envCtx.elevation_m;
  const soil = envCtx.blocks?.soil?.data;

  const chips = [];
  if (envCtx.blocks?.weather?.available && weather?.temperature_2m != null) {
    chips.push({ label: `${weather.temperature_2m}\u00B0C`, sub: 'Temp' });
  }
  if (envCtx.blocks?.weather?.available && weather?.relative_humidity_2m != null) {
    chips.push({ label: `${weather.relative_humidity_2m}%`, sub: 'Humidity' });
  }
  if (envCtx.blocks?.air_quality?.available && aq?.aqi_us_epa != null) {
    chips.push({ label: `AQI ${aq.aqi_us_epa}`, sub: aq.aqi_category || 'Air quality' });
  }
  if (envCtx.blocks?.elevation?.available && elev != null) {
    chips.push({ label: `${elev} m`, sub: 'Elevation' });
  }
  if (envCtx.blocks?.soil?.available && soil?.soil_moisture_0_to_7cm != null) {
    chips.push({ label: `${soil.soil_moisture_0_to_7cm}`, sub: 'Soil' });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span key={c.sub} className="inline-flex items-center gap-1.5 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-full px-3 py-1 text-[11px] font-mono">
          <span className="text-mist light:text-ink font-semibold">{c.label}</span>
          <span className="text-mist-dim light:text-ink/40">{c.sub}</span>
        </span>
      ))}
    </div>
  );
}

function NamePrompt({ onDone }) {
  const [val, setVal] = useState('');
  const submit = () => {
    const name = val.trim();
    if (name) { setUserName(name); onDone(name); }
  };
  return (
    <div className="fixed inset-0 z-[600] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <p className="text-xs font-mono text-canopy font-semibold uppercase tracking-wider mb-1">Welcome to GreenVision</p>
        <h2 className="font-display text-xl font-bold text-mist light:text-ink mb-2">What should we call you?</h2>
        <p className="text-sm text-mist-dim light:text-ink/60 mb-5">
          We use your first name to personalize your experience. This stays on your device.
        </p>
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your first name"
          autoFocus
          className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm font-mono text-mist light:text-ink focus:outline-none focus:border-canopy mb-4"
        />
        <div className="flex gap-3">
          <button onClick={() => { setUserName(''); onDone(''); }} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 light:border-black/10 text-xs font-mono text-mist-dim light:text-ink/50 hover:border-canopy/30 transition-colors">
            Skip
          </button>
          <button onClick={submit} className="flex-1 px-4 py-2.5 rounded-xl bg-canopy text-white text-xs font-mono font-semibold hover:scale-105 transition-transform">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function CitizenChatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [inited, setInited] = useState(false);
  const endRef = useRef(null);

  const prompts = useMemo(() => [
    'What should I plant here?',
    'I have a small garden. What can I grow?',
    'Which tree needs less water?',
    'What can one tree do for my area?',
    'How much would 100 trees cost?',
  ], []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => {
    if (inited) return;
    setInited(true);
    const greet = async () => {
      setPending(true);
      try {
        const ctx = await buildAdvisorContext('citizen', null);
        const res = await askAdvisor('hi', ctx, []);
        const reply = res?.reply || "Hi! I'm GreenVision. Ask me about trees, planting, or your local environment.";
        setMessages([{ sender: 'bot', text: reply, intent: res?.intent }]);
      } catch {
        setMessages([{ sender: 'bot', text: "Hi! I'm GreenVision. Ask me about trees, planting, or your local environment." }]);
      } finally {
        setPending(false);
      }
    };
    greet();
  }, [inited]);

  const send = useCallback(async (textOverride) => {
    const query = (textOverride || input).trim();
    if (!query || pending) return;
    if (!textOverride) setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setPending(true);
    try {
      const ctx = await buildAdvisorContext('citizen', null);
      const hist = messages.map((m) => ({ sender: m.sender, text: m.text, intent: m.intent }));
      const res = await askAdvisor(query, ctx, hist);
      const reply = res?.reply || 'The advisor did not return a response.';
      setMessages((prev) => [...prev, { sender: 'bot', text: reply, intent: res?.intent }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: `Advisor unavailable: ${extractError(err)}` }]);
    } finally {
      setPending(false);
    }
  }, [input, pending, messages]);

  return (
    <div className="bg-panel light:bg-white border border-canopy/20 rounded-3xl overflow-hidden shadow-xl">
      <div className="bg-canopy/10 border-b border-white/10 light:border-black/10 p-4 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-canopy/20 text-canopy flex items-center justify-center">
          <Bot size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-sm text-mist light:text-ink">GreenVision AI</h3>
          <span className="text-[10px] font-mono text-mist-dim light:text-ink/50">
            Environmental advisor &middot; grounded in real data
          </span>
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="p-3 border-b border-white/5 light:border-black/5 bg-white/5 light:bg-black/5">
          <p className="text-[9px] font-mono text-mist-dim/50 light:text-ink/30 uppercase tracking-widest mb-2">Try asking</p>
          <div className="flex flex-wrap gap-1.5">
            {prompts.map((p, i) => (
              <button
                key={i}
                onClick={() => send(p)}
                className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 px-2.5 py-1 rounded-full hover:border-canopy hover:text-canopy transition-colors text-[11px] font-mono"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="h-72 overflow-y-auto p-4 space-y-3 font-body text-xs">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${m.sender === 'user' ? 'bg-databue/20 text-databue' : 'bg-canopy/20 text-canopy'}`}>
              {m.sender === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
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
        {pending && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-canopy/20 text-canopy"><Bot size={14} /></div>
            <div className="rounded-2xl p-3 bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-tl-none flex items-center gap-2 text-mist-dim light:text-ink/60">
              <Loader2 size={13} className="animate-spin" /> Thinking&hellip;
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-white/10 light:border-black/10 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about species, cost, water, or what to plant..."
          className="flex-1 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-full px-4 py-2.5 text-xs text-mist light:text-ink focus:outline-none focus:border-canopy"
        />
        <button
          onClick={() => send()}
          disabled={pending}
          className="w-10 h-10 rounded-full bg-canopy text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>

      <p className="px-4 py-2 text-[9px] font-mono text-mist-dim/50 light:text-ink/30 border-t border-white/5 light:border-black/5">
        Answers use available environmental data and GreenVision&rsquo;s planting knowledge.
      </p>
    </div>
  );
}

export default function CitizenArea({ scene, location }) {
  const [loc, setLoc] = useState(location);
  const [userName, setUserNameState] = useState(() => getUserName());
  const [showNamePrompt, setShowNamePrompt] = useState(() => !getUserName());
  const [envCtx, setEnvCtx] = useState(null);
  const [loadingEnv, setLoadingEnv] = useState(false);
  const quote = useMemo(() => GREEN_QUOTES[Math.floor(Math.random() * GREEN_QUOTES.length)], []);

  const setLocAndStore = useCallback((next) => {
    setLoc(next);
    if (next?.lat != null && next?.lng != null) setUserLocation(next);
  }, []);

  const hasLoc = loc?.lat != null && loc?.lng != null;

  useEffect(() => {
    if (!hasLoc) { setEnvCtx(null); return; }
    let cancelled = false;
    setLoadingEnv(true);
    getLocationContext(loc.lat, loc.lng, loc.name || '')
      .then((data) => { if (!cancelled) setEnvCtx(data); })
      .catch(() => { if (!cancelled) setEnvCtx(null); })
      .finally(() => { if (!cancelled) setLoadingEnv(false); });
    return () => { cancelled = true; };
  }, [hasLoc, loc?.lat, loc?.lng, loc?.name]);

  const greeting = timeGreeting();
  const displayName = userName || 'there';

  return (
    <div className="flex flex-1 w-full">
      {showNamePrompt && <NamePrompt onDone={(n) => { setUserNameState(n); setShowNamePrompt(false); }} />}
      <main className="flex-1 w-full overflow-x-hidden">

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-canopy/10 via-transparent to-databue/5 border-b border-white/10 light:border-black/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-mono font-medium text-canopy border border-canopy/25 rounded-full px-3 py-1.5 mb-5 bg-canopy/8 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-canopy animate-pulse" />
                  GREENVISION.AI
                </span>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-mist light:text-ink mb-2">
                  {greeting}, {displayName}
                </h1>
                <p className="text-mist-dim light:text-ink/65 text-lg leading-relaxed mb-4">
                  What would you like to know about your area?
                </p>

                {/* Quote */}
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4 mb-6">
                  <p className="text-sm italic text-mist light:text-ink leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
                  <p className="text-[10px] font-mono text-mist-dim light:text-ink/40 mt-2">&mdash; {quote.author}</p>
                </div>

                {/* CTA links */}
                <div className="flex flex-wrap gap-3">
                  <Link to="/planting" className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20">
                    <Sprout size={14} /> Ask what to plant <ArrowRight size={13} />
                  </Link>
                  <Link to="/upload" className="inline-flex items-center gap-2 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 text-xs font-mono font-semibold px-5 py-3 rounded-full hover:border-canopy/40 transition-colors">
                    <TreePine size={14} /> Upload satellite image
                  </Link>
                </div>
              </div>

              {/* Interactive Map */}
              <div className="hidden lg:block">
                <HeroMap loc={loc} onPick={(lat, lng) => setLocAndStore({ lat, lng, name: loc?.name || '', provenance: 'map-click' })} />
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">

          {/* Mobile map */}
          <div className="lg:hidden">
            <HeroMap loc={loc} onPick={(lat, lng) => setLocAndStore({ lat, lng, name: loc?.name || '', provenance: 'map-click' })} />
          </div>

          {/* Location input (when no location set) */}
          {!hasLoc && (
            <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 light:border-black/10">
                <span className="text-canopy font-bold flex items-center gap-1.5"><MapPin size={16} /> WHERE DO YOU LIVE?</span>
                <span className="text-mist-dim light:text-ink/50 font-mono text-[10px]">Step 1</span>
              </div>
              <p className="text-sm text-mist-dim light:text-ink/60 mb-4 max-w-2xl">
                Pin your neighbourhood to pull <span className="text-mist light:text-ink font-semibold">real</span>, source-labelled
                weather, air-quality and soil context &mdash; then GreenVision recommends the right trees for the actual place.
              </p>
              <LocationInput value={loc} onChange={setLocAndStore} />
            </div>
          )}

          {/* Location card + env chips (when location is set) */}
          {hasLoc && (
            <>
              <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-md">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10 light:border-black/10">
                  <span className="text-canopy font-bold flex items-center gap-1.5 text-xs font-mono">
                    <MapPin size={14} /> YOUR AREA
                  </span>
                  <button onClick={() => setLoc(null)} className="text-[10px] font-mono text-mist-dim light:text-ink/40 hover:text-canopy transition-colors">
                    Change location
                  </button>
                </div>
                <p className="text-sm font-mono text-mist light:text-ink font-semibold">
                  {loc.name || 'Location set'}
                </p>
                <p className="text-[10px] font-mono text-mist-dim light:text-ink/40 mt-0.5">
                  {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </p>
                <div className="mt-3">
                  {loadingEnv ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-mist-dim"><Loader2 size={11} className="animate-spin" /> Loading environmental data&hellip;</span>
                  ) : (
                    <EnvChips envCtx={envCtx} />
                  )}
                </div>
              </div>

              {/* Chatbot — primary citizen experience */}
              <CitizenChatbot />

              {/* Quick links */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Sprout, label: 'What to plant', sub: 'Best trees for here', to: '/planting' },
                  { icon: Leaf, label: 'My impact', sub: 'Trees to CO\u2082 / O\u2082', to: '/climate-lab' },
                  { icon: FileText, label: 'My action plan', sub: 'Printable report', to: '/reports' },
                  { icon: Trophy, label: 'Green Champions', sub: 'Community leaderboard', to: '/leaderboard' },
                ].map((step) => (
                  <Link
                    key={step.label}
                    to={step.to}
                    className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4 hover:border-canopy/40 transition-colors group"
                  >
                    <span className="w-9 h-9 rounded-xl bg-canopy/15 text-canopy flex items-center justify-center mb-2 group-hover:bg-canopy group-hover:text-white transition-colors">
                      <step.icon size={17} />
                    </span>
                    <p className="text-sm font-semibold text-mist light:text-ink">{step.label}</p>
                    <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 mt-0.5">{step.sub}</p>
                  </Link>
                ))}
              </div>

              {/* Full environmental context */}
              <EnvironmentalContext scene={{ userLocation: loc }} />

              {/* Analyzed scene summary (if available) */}
              {scene?.greenCover != null && (
                <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-canopy" />
                    <p className="text-xs font-mono text-mist light:text-ink font-semibold">You also analyzed a scene for this area</p>
                  </div>
                  <p className="text-xs text-mist-dim light:text-ink/60">
                    Measured green cover: <span className="text-mist light:text-ink font-semibold">{scene.greenCover}%</span> &middot;
                    estimated trees: <span className="text-mist light:text-ink font-semibold">{scene.treeCount?.toLocaleString()}</span> &middot;
                    canopy attainment: <span className="text-mist light:text-ink font-semibold">{scene.cityHealth?.score ?? '\u2014'}%</span> of the 60% target.
                    View the full municipal analysis on the <Link to="/dashboard" className="text-canopy underline">Command Center</Link>.
                  </p>
                </div>
              )}

              {/* Contribute bridge */}
              <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-xl">
                <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3">CONTRIBUTE &rarr; INSPIRE</p>
                <p className="text-sm text-mist light:text-ink leading-relaxed mb-4">
                  Planted or cared for a tree? Log it &mdash; earn Green Points (a participation score) and climb the
                  Green Champions board. Community-reported, honestly unverified.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/contribute" className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20">
                    <Sprout size={14} /> Log a contribution <ArrowRight size={13} />
                  </Link>
                  <Link to="/leaderboard" className="inline-flex items-center gap-2 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 text-xs font-mono font-semibold px-5 py-3 rounded-full hover:border-canopy/40 transition-colors">
                    <Trophy size={14} /> Green Champions
                  </Link>
                </div>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
