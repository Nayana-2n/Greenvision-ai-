import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Sprout, Loader2, AlertTriangle, Info, Medal, Crown, Star, Building2, Target,
} from 'lucide-react';
import { fetchLeaderboard, extractError } from '../api/api';
import { getContributorId, getContributorName, getContributorOrg } from '../utils/contributorStore';

const RANK_STYLES = {
  1: 'bg-amber-400/15 border-amber-400/40 text-amber-300 light:text-amber-600',
  2: 'bg-slate-300/10 border-slate-300/30 text-slate-200 light:text-slate-500',
  3: 'bg-orange-400/10 border-orange-400/30 text-orange-300 light:text-orange-600',
};

const RANK_ICON = {
  1: <Crown size={16} />,
  2: <Medal size={16} />,
  3: <Medal size={16} />,
};

const TABS = [
  { id: 'individuals', label: 'Individuals', icon: Star },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'colleges', label: 'Colleges', icon: Building2 },
  { id: 'ngos', label: 'NGOs', icon: Sprout },
  { id: 'communities', label: 'Communities', icon: Building2 },
];

const DEMO_CHALLENGES = [
  { title: 'Plant 100 trees', org: 'ABC Technologies', progress: 72, total: 100, icon: '\u{1F333}' },
  { title: 'Campus Green Week', org: 'XYZ College', progress: 43, total: 100, icon: '\u{1F331}' },
  { title: 'Neighbourhood Green Drive', org: 'Bengaluru Community', progress: 61, total: 100, icon: '\u{1F3D9}\uFE0F' },
];

const ORG_TAB_MAP = {
  companies: 'company',
  colleges: 'college',
  ngos: 'ngo',
  communities: 'community',
};

const ORG_ICONS = {
  company: Building2,
  college: Building2,
  school: Building2,
  ngo: Sprout,
  community: Building2,
};

function AnimatedNumber({ value, duration = 1000 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = null;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setDisplay(Math.floor(p * value));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span>{display.toLocaleString()}</span>;
}

const podiumAnimStyle = `
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes progressFill { from { width: 0; } }
`;

function PodiumCard({ entry, height, delay, color }) {
  return (
    <div
      className="flex flex-col items-center"
      style={{ animation: `slideUp 0.5s ease-out ${delay}ms forwards`, opacity: 0 }}
    >
      <div className={`w-full ${height} rounded-t-2xl border border-white/10 light:border-black/10 flex flex-col items-center justify-center p-4 bg-panel light:bg-white shadow-xl`}>
        <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center font-display font-bold text-xl text-white mb-2`}>
          {RANK_ICON[entry.rank] || entry.rank}
        </div>
        <p className="font-display font-bold text-sm text-mist light:text-ink text-center leading-tight px-1">{entry.name}</p>
        <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 mt-1">{entry.contributions} contribution{entry.contributions === 1 ? '' : 's'}</p>
        <p className="font-mono font-bold text-canopy text-lg mt-1">
          <AnimatedNumber value={entry.points} />
        </p>
      </div>
      <div className={`w-full h-3 rounded-b-xl ${color} opacity-30`} />
    </div>
  );
}

function OrgInfoTab({ orgType, orgLabel, orgs }) {
  const filtered = orgs.filter((o) => o.type === orgType);
  const OrgIcon = ORG_ICONS[orgType] || Building2;

  if (filtered.length === 0) {
    return (
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-8 text-center space-y-4 shadow-xl">
        <OrgIcon size={32} className="text-earth mx-auto" />
        <h3 className="font-display font-bold text-xl text-mist light:text-ink">{orgLabel} Leaderboard</h3>
        <p className="text-xs text-mist-dim light:text-ink/60 max-w-md mx-auto leading-relaxed">
          No {orgLabel.toLowerCase()} have logged contributions yet. Be the first to put your{' '}
          {orgLabel.toLowerCase().replace(/s$/, '')} on the green map.
        </p>
        <Link
          to="/contribute"
          className="inline-flex items-center gap-2 bg-earth text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-earth/20"
        >
          <Sprout size={14} /> Log a contribution
        </Link>
      </div>
    );
  }

  const top3 = filtered.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <OrgIcon size={20} className="text-earth" />
          <h3 className="font-display font-bold text-lg text-mist light:text-ink">{orgLabel} Leaderboard</h3>
        </div>
        <p className="text-xs text-mist-dim light:text-ink/60 mb-5 max-w-lg leading-relaxed">
          Points are aggregated from individual contributions with{' '}
          {orgLabel.toLowerCase().replace(/s$/, '')} affiliation. Participants, contributions and Green Points
          reflect reported activity, not independently verified outcomes.
        </p>
        {top3.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-6">
            <PodiumCard entry={{ rank: 2, name: top3[1].name, contributions: top3[1].contributions, points: top3[1].points }} height="h-40" delay={100} color="bg-slate-400" />
            <PodiumCard entry={{ rank: 1, name: top3[0].name, contributions: top3[0].contributions, points: top3[0].points }} height="h-48" delay={0} color="bg-amber-400" />
            <PodiumCard entry={{ rank: 3, name: top3[2].name, contributions: top3[2].contributions, points: top3[2].points }} height="h-40" delay={200} color="bg-orange-400" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 light:border-black/10 text-[10px] font-mono uppercase tracking-widest text-mist-dim light:text-ink/50">
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">{orgLabel.replace(/s$/, '')}</th>
                <th className="px-5 py-4 text-right">Participants</th>
                <th className="px-5 py-4 text-right">Contributions</th>
                <th className="px-5 py-4 text-right">Green Points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const rank = i + 1;
                return (
                  <tr key={o.name} className="border-b border-white/5 light:border-black/5 last:border-0 hover:bg-white/3 light:hover:bg-black/3">
                    <td className="px-5 py-3.5">
                      {RANK_ICON[rank] ? (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border font-mono font-bold text-sm ${RANK_STYLES[rank] || 'bg-white/5 light:bg-black/5 border-white/10 light:border-black/10 text-mist-dim light:text-ink/60'}`}>
                          {RANK_ICON[rank]}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 font-mono font-bold text-sm text-mist-dim light:text-ink/60">
                          {rank}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-mist light:text-ink">{o.name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm text-mist-dim light:text-ink/60">
                      {o.participants}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm text-mist-dim light:text-ink/60">
                      {o.contributions}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-canopy text-sm">
                      {o.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Link
        to="/contribute"
        className="inline-flex items-center gap-2 bg-earth text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-earth/20"
      >
        <Sprout size={14} /> Log a contribution for your {orgLabel.toLowerCase().replace(/s$/, '')}
      </Link>
    </div>
  );
}

function ChallengeCard({ challenge, index }) {
  const pct = Math.round((challenge.progress / challenge.total) * 100);
  return (
    <div
      className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-shadow"
      style={{ animation: `slideUp 0.5s ease-out ${index * 100}ms forwards`, opacity: 0 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{challenge.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-sm text-mist light:text-ink">{challenge.title}</p>
          <p className="text-[10px] font-mono text-earth">{challenge.org}</p>
        </div>
        <span className="text-xs font-mono font-bold text-canopy">{pct}%</span>
      </div>
      <div className="h-2 bg-white/10 light:bg-black/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-canopy to-canopy/70 rounded-full"
          style={{ width: `${pct}%`, animation: 'progressFill 1s ease-out forwards' }}
        />
      </div>
      <p className="text-[10px] font-mono text-mist-dim light:text-ink/50">
        {challenge.progress} / {challenge.total} participants
      </p>
    </div>
  );
}


export default function Leaderboard() {
  const [board, setBoard] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [mine, setMine] = useState(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('individuals');

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(getContributorId())
      .then((d) => {
        if (cancelled) return;
        setBoard(d.entries || []);
        setOrgs(d.organizations || []);
        setMine(d.my_position || null);
        setDisclaimer(d.points_disclaimer || '');
      })
      .catch((e) => { if (!cancelled) setError(extractError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const myName = mine?.name || getContributorName();
  const myOrg = getContributorOrg();
  const top3 = board ? board.slice(0, 3) : [];
  const isOrgTab = activeTab !== 'individuals';

  return (
    <>
      <style>{podiumAnimStyle}</style>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-16 space-y-10">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-3">
              <Trophy size={14} /> GREEN CHAMPIONS
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
              The greenest contributors
            </h1>
            <p className="text-mist-dim light:text-ink/60 text-sm mt-1 max-w-2xl">
              Ranked by Green Points — a participation score for motivating action, not a scientific measurement.
            </p>
          </div>
          <Link
            to="/contribute"
            className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20 shrink-0"
          >
            <Sprout size={14} /> Log a contribution
          </Link>
        </div>

        {/* Points disclaimer */}
        <div className="flex items-start gap-3 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
          <Info size={18} className="text-canopy shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-mist-dim light:text-ink/60 leading-relaxed">
            {disclaimer || (
              'Green Points are a participation score. They are not a scientific measurement and do not correspond to a fixed amount of CO\u2082, oxygen or rupees.'
            )}
          </p>
        </div>

        {error && (
          <p className="text-xs font-mono text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={14} /> {error}
          </p>
        )}

        {/* Your position card */}
        {mine && (
          <div className="bg-gradient-to-r from-canopy/15 via-panel to-panel light:from-canopy/10 light:via-white light:to-white border border-canopy/25 rounded-3xl p-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-canopy text-white flex items-center justify-center font-mono font-bold text-xl shrink-0">
                #{mine.rank}
              </div>
              <div>
                <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest">Your position</p>
                <p className="font-display font-bold text-xl text-mist light:text-ink">{mine.name || 'You'}</p>
                <p className="text-xs font-mono text-mist-dim light:text-ink/50">
                  {mine.points} points \u00B7 {mine.contributions} contribution{mine.contributions === 1 ? '' : 's'}
                  {myOrg.type !== 'individual' && myOrg.name && (
                    <span className="text-earth ml-2">\u00B7 {myOrg.name}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-xs font-mono text-mist-dim light:text-ink/50 max-w-sm">
              Contributions are community-reported and verification-pending — your rank reflects reported activity, not
              independently verified planting.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono transition-all ${
                  activeTab === tab.id
                    ? 'bg-canopy/15 text-canopy font-semibold border border-canopy/20'
                    : 'text-mist-dim light:text-ink/60 border border-white/10 light:border-black/10 hover:border-canopy/30'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Org info tabs */}
        {isOrgTab && (
          <OrgInfoTab orgType={ORG_TAB_MAP[activeTab]} orgLabel={TABS.find((t) => t.id === activeTab)?.label || activeTab} orgs={orgs} />
        )}

        {/* Individual leaderboard */}
        {activeTab === 'individuals' && (
          <>
            {/* Podium */}
            {top3.length === 3 && (
              <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-4">
                <PodiumCard entry={top3[1]} height="h-40" delay={100} color="bg-slate-400" />
                <PodiumCard entry={top3[0]} height="h-48" delay={0} color="bg-amber-400" />
                <PodiumCard entry={top3[2]} height="h-40" delay={200} color="bg-orange-400" />
              </div>
            )}

            {/* Board */}
            <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl shadow-xl overflow-hidden">
              {loading && (
                <div className="flex items-center gap-3 text-sm font-mono text-mist-dim light:text-ink/50 py-16 justify-center">
                  <Loader2 size={18} className="text-canopy animate-spin" /> Loading the board...
                </div>
              )}

              {board && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 light:border-black/10 text-[10px] font-mono uppercase tracking-widest text-mist-dim light:text-ink/50">
                        <th className="px-5 py-4">Rank</th>
                        <th className="px-5 py-4">Contributor</th>
                        <th className="px-5 py-4 text-right">Contributions</th>
                        <th className="px-5 py-4 text-right">Green Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.map((e) => {
                        const isMe = mine && e.name === myName && e.points === mine.points;
                        return (
                          <tr
                            key={`${e.rank}-${e.name}`}
                            className={`border-b border-white/5 light:border-black/5 last:border-0 ${
                              isMe ? 'bg-canopy/10' : 'hover:bg-white/3 light:hover:bg-black/3'
                            }`}
                          >
                            <td className="px-5 py-3.5">
                              {RANK_ICON[e.rank] ? (
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border font-mono font-bold text-sm ${RANK_STYLES[e.rank] || 'bg-white/5 light:bg-black/5 border-white/10 light:border-black/10 text-mist-dim light:text-ink/60'}`}>
                                  {RANK_ICON[e.rank]}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 font-mono font-bold text-sm text-mist-dim light:text-ink/60">
                                  {e.rank}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="flex items-center gap-2 text-sm font-semibold text-mist light:text-ink">
                                {e.name}
                                {isMe && (
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-canopy/30 bg-canopy/15 text-canopy uppercase">
                                    <Star size={9} className="inline -mt-0.5 mr-0.5" /> you
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-sm text-mist-dim light:text-ink/60">
                              {e.contributions}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-canopy text-sm">
                              {e.points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Green Challenges */}
        <div className="border-t border-white/5 light:border-black/5 pt-10">
          <div className="flex items-center gap-2 mb-6">
            <Target size={18} className="text-earth" />
            <h2 className="font-display font-bold text-xl text-mist light:text-ink">Green Challenges</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {DEMO_CHALLENGES.map((c, i) => (
              <ChallengeCard key={c.title} challenge={c} index={i} />
            ))}
          </div>
          <p className="text-[10px] font-mono text-mist-dim light:text-ink/40 mt-4 text-center">
            Challenges are participation goals. Progress reflects reported activity, not independently verified outcomes.
          </p>
        </div>

        <p className="text-[11px] font-mono text-mist-dim light:text-ink/50">
          Identity is demo-grade (browser-generated IDs, no accounts) and the top board includes seeded demo data for
          demonstration purposes. Authentication and identity verification are planned features.
        </p>
      </div>
    </>
  );
}

