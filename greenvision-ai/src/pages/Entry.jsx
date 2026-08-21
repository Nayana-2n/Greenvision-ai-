import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TreePine, Building2, Factory, User, Leaf, BarChart3,
  MapPin, Target, ArrowRight, Eye,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../context/roles';

const ROLE_OPTIONS = [
  {
    role: ROLES.MUNICIPAL,
    icon: Building2,
    title: 'Municipal Authority',
    desc: 'Assess urban green cover, identify priority areas and create plantation plans.',
    color: 'canopy',
    hoverBorder: 'hover:border-canopy hover:text-canopy',
  },
  {
    role: ROLES.INDUSTRIAL,
    icon: Factory,
    title: 'Industry',
    desc: 'Plan green buffers and environmental responsibility actions around industrial sites.',
    color: 'databue',
    hoverBorder: 'hover:border-databue hover:text-databue',
  },
  {
    role: ROLES.CITIZEN,
    icon: User,
    title: 'Citizen',
    desc: 'Understand your local environment, discover suitable trees and contribute to greener communities.',
    color: 'earth',
    hoverBorder: 'hover:border-earth hover:text-earth',
  },
];

const STEPS = [
  { icon: Eye, label: 'Observe', desc: 'Upload aerial imagery or set a location' },
  { icon: Target, label: 'Diagnose', desc: 'Measure canopy, trees and deficit' },
  { icon: TreePine, label: 'Recommend', desc: 'Species ranked by local context' },
  { icon: BarChart3, label: 'Plan', desc: 'Count, cost and investment estimate' },
  { icon: Leaf, label: 'Act', desc: 'Plant, contribute and measure impact' },
];

export default function Entry() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    login(email, name, selectedRole || ROLES.CITIZEN);
    navigate('/dashboard');
  };

  if (user) {
    navigate('/dashboard');
    return null;
  }

  const selectedInfo = ROLE_OPTIONS.find((r) => r.role === selectedRole);

  return (
    <div className="flex flex-col min-h-full">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-canopy border border-canopy/25 rounded-full px-3 py-1.5 mb-6 bg-canopy/8 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-canopy" />
          OBSERVE &rarr; DIAGNOSE &rarr; RECOMMEND &rarr; PLAN &rarr; ACT
        </div>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight text-mist light:text-ink mb-6">
          Turn urban green data<br />
          <span className="ndvi-text">into decisions.</span>
        </h1>

        <p className="text-mist-dim light:text-ink/70 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
          GreenVision.AI uses aerial imagery, environmental context and transparent calculations
          to help cities, industries and citizens plan greener spaces.
        </p>

        {/* Three pathways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.role}
                onClick={() => { setSelectedRole(opt.role); setShowLogin(true); setEmail(''); setName(''); }}
                className={`text-left bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-md transition-all duration-300 group ${
                  showLogin && selectedRole === opt.role
                    ? 'ring-2 ring-canopy/40 shadow-xl'
                    : 'hover:shadow-xl ' + opt.hoverBorder
                }`}
              >
                <span className={`w-11 h-11 rounded-2xl bg-${opt.color}/15 text-${opt.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon size={22} />
                </span>
                <h3 className="font-display font-bold text-lg text-mist light:text-ink mb-1.5">{opt.title}</h3>
                <p className="text-mist-dim light:text-ink/60 text-sm leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Login Form */}
        {showLogin && (
          <form
            onSubmit={handleLogin}
            className="max-w-md mx-auto bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <p className="font-display font-bold text-mist light:text-ink text-center text-lg">
              {selectedInfo?.title || 'Get Started'}
            </p>
            <p className="text-xs font-mono text-mist-dim light:text-ink/50 text-center -mt-2">
              Demo-grade login — no password required
            </p>
            <div>
              <label className="block text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm text-mist light:text-ink placeholder-mist-dim/40 focus:outline-none focus:border-canopy/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm text-mist light:text-ink placeholder-mist-dim/40 focus:outline-none focus:border-canopy/50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-canopy text-white font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/25"
              >
                Enter workspace <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="text-mist-dim light:text-ink/50 hover:text-mist light:hover:text-ink text-sm font-medium px-3 py-3 transition-colors"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </section>

      {/* How it works */}
      <section className="bg-panel/40 light:bg-gray-50/50 border-y border-white/10 light:border-black/10 py-16 w-full">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-mono font-semibold text-databue uppercase tracking-wider bg-databue/10 px-3 py-1 rounded-full border border-databue/20">
              HOW IT WORKS
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3 text-mist light:text-ink">
              From image to action
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-canopy/15 text-canopy flex items-center justify-center mx-auto mb-3">
                    <Icon size={22} />
                  </div>
                  <p className="text-[10px] font-mono text-mist-dim light:text-ink/40 mb-1">STEP {idx + 1}</p>
                  <p className="font-display font-semibold text-mist light:text-ink text-sm">{step.label}</p>
                  <p className="text-[11px] text-mist-dim light:text-ink/50 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Product pillars */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
            Built on transparency
          </h2>
          <p className="text-mist-dim light:text-ink/70 text-sm max-w-xl mx-auto mt-2">
            Every number is source-labelled. No values are fabricated. If a metric cannot be computed, GreenVision says so.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: TreePine,
              title: 'Real AI Analysis',
              desc: 'YOLO scene classification, vegetation segmentation, trunk detection — all from uploaded imagery.',
            },
            {
              icon: MapPin,
              title: 'Live Environment',
              desc: 'Open-Meteo weather, air quality, elevation and soil context for any GPS location worldwide.',
            },
            {
              icon: Leaf,
              title: 'Honest Calculations',
              desc: '22 kg CO\u2082 and 118 kg O\u2082 per tree per year. 60% canopy target. Every formula documented.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-md">
                <span className="w-11 h-11 rounded-2xl bg-canopy/15 text-canopy flex items-center justify-center mb-3">
                  <Icon size={22} />
                </span>
                <h3 className="font-display font-semibold text-lg text-mist light:text-ink mb-2">{item.title}</h3>
                <p className="text-mist-dim light:text-ink/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-6xl mx-auto px-6 py-12 w-full mb-12">
        <div className="rounded-3xl border border-white/10 light:border-black/10 p-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-panel light:bg-white shadow-xl">
          <div>
            <p className="font-display font-bold text-xl text-mist light:text-ink">Ready to measure your green intelligence?</p>
            <p className="text-mist-dim light:text-ink/60 text-sm mt-1">
              Select a role above to enter your workspace.
            </p>
          </div>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-full sm:w-auto text-center text-xs font-mono font-bold text-white bg-canopy hover:bg-canopy/90 px-6 py-3.5 rounded-full transition-transform hover:scale-105 shadow-lg shadow-canopy/20"
          >
            Get started
          </button>
        </div>
      </section>
    </div>
  );
}
