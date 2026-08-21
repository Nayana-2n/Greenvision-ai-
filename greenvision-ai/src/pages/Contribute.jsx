import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sprout, Trophy, Loader2, AlertTriangle, CheckCircle2, Camera,
  MapPin, CalendarDays, ShieldAlert, User, Info, TreePine, Building2,
} from 'lucide-react';
import {
  createContribution, fetchContributions, uploadEvidence, evidenceUrl, extractError,
} from '../api/api';
import {
  getContributorId, getContributorName, setContributorName,
  getContributorOrg, setContributorOrg, ORG_TYPES,
} from '../utils/contributorStore';

const ACTIONS = [
  { id: 'plant_tree', label: 'Planted a tree', points: 100 },
  { id: 'maintain_tree', label: 'Maintained a tree', points: 50 },
  { id: 'community_plantation', label: 'Community plantation', points: 100 },
  { id: 'green_space_project', label: 'Green-space project', points: 300 },
];

const STATUS_COLORS = {
  community_reported: 'bg-databue/10 text-databue border-databue/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Contribute() {
  const [name, setName] = useState(getContributorName());
  const [org, setOrg] = useState(getContributorOrg);
  const [actionType, setActionType] = useState('plant_tree');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState({});
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [items, setItems] = useState(null);
  const [feedError, setFeedError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchContributions()
      .then((d) => { if (!cancelled) setItems(d.items || []); })
      .catch((e) => { if (!cancelled) setFeedError(extractError(e)); });
    return () => { cancelled = true; };
  }, [created]);

  const selected = ACTIONS.find((a) => a.id === actionType) || ACTIONS[0];

  const updateOrg = (patch) => {
    const next = { ...org, ...patch };
    setOrg(next);
    setContributorOrg(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name so we can credit you on the leaderboard.'); return; }
    const contributorId = getContributorId();
    setContributorName(name);
    setSubmitting(true);
    try {
      const record = await createContribution({
        action_type: actionType,
        date,
        contributor_name: name,
        contributor_id: contributorId,
        latitude: place?.lat,
        longitude: place?.lng,
        place_name: place?.name || '',
        description,
        organization_type: org.type !== 'individual' ? org.type : undefined,
        organization_name: org.name || undefined,
      });
      if (photo) {
        await uploadEvidence(record.id, photo);
        record.evidence = true;
      }
      setCreated(record);
      setPhoto(null);
      setDescription('');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16 space-y-10">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-3">
            <Sprout size={14} /> GREEN ACTION LOG
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
            Log what you did for green
          </h1>
          <p className="text-mist-dim light:text-ink/60 text-sm mt-1 max-w-2xl">
            Every planted or maintained tree is community-reported. Earn Green Points (a participation score) and climb
            the <Link to="/leaderboard" className="text-canopy underline underline-offset-4">Green Champions</Link> board.
          </p>
        </div>
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20 shrink-0"
        >
          <Trophy size={14} /> Green Champions
        </Link>
      </div>

      {/* Honesty banner */}
      <div className="flex items-start gap-3 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
        <Info size={18} className="text-canopy shrink-0 mt-0.5" />
        <p className="text-xs font-mono text-mist-dim light:text-ink/60 leading-relaxed">
          Green Points are a participation score for motivating action — not a scientific measurement, and never
          converted to CO₂, oxygen or rupees. Photo evidence is stored but <span className="text-mist light:text-ink font-semibold">not AI-verified</span> —
          every contribution stays "Verification pending".
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">

        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 h-fit">
          <p className="font-display font-bold text-xl text-mist light:text-ink">Report your contribution</p>

          <div>
            <label className="block text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">Your display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aparna Rao"
              className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm text-mist light:text-ink placeholder-mist-dim/40 focus:outline-none focus:border-canopy/50"
            />
          </div>

          {/* Organization section */}
          <div className="bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-earth" />
              <label className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">
                Are you contributing as part of an organization?
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {ORG_TYPES.map((ot) => (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => updateOrg({ type: ot.id })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-colors ${
                    org.type === ot.id
                      ? 'bg-earth/15 border-earth/40 text-earth'
                      : 'bg-white/5 light:bg-white border-white/10 light:border-black/10 text-mist-dim light:text-ink/60 hover:border-earth/30'
                  }`}
                >
                  <span>{ot.icon}</span>
                  {ot.label}
                </button>
              ))}
            </div>
            {org.type !== 'individual' && (
              <input
                value={org.name}
                onChange={(e) => updateOrg({ name: e.target.value })}
                placeholder={`Enter ${org.type} name`}
                className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-lg px-3 py-2 text-sm text-mist light:text-ink placeholder-mist-dim/40 focus:outline-none focus:border-earth/50"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">What did you do?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACTIONS.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setActionType(a.id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    actionType === a.id
                      ? 'bg-canopy/15 border-canopy/40'
                      : 'bg-white/5 light:bg-white border-white/10 light:border-black/10 hover:border-canopy/30'
                  }`}
                >
                  <span className="block text-sm font-semibold text-mist light:text-ink">{a.label}</span>
                  <span className="block text-[10px] font-mono text-canopy mt-0.5">+{a.points} Green Points</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">Date</label>
              <input
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm text-mist light:text-ink focus:outline-none focus:border-canopy/50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">Place name (optional)</label>
              <input
                value={place?.name || ''}
                onChange={(e) => setPlace({ name: e.target.value })}
                placeholder="e.g. Cubbon Park, Bengaluru"
                className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm text-mist light:text-ink placeholder-mist-dim/40 focus:outline-none focus:border-canopy/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">What happened? (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Tell us about the tree, the plantation drive, the green-space project…"
              className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-3 text-sm text-mist light:text-ink placeholder-mist-dim/40 focus:outline-none focus:border-canopy/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">
              Photo evidence (optional · {selected.label} + photo = stored, not AI-verified)
            </label>
            <label className="flex items-center gap-3 bg-white/5 light:bg-black/5 border border-dashed border-white/20 light:border-black/20 rounded-xl px-4 py-3 cursor-pointer hover:border-canopy/40 transition-colors">
              <Camera size={18} className="text-canopy shrink-0" />
              <span className="text-sm text-mist-dim light:text-ink/60">
                {photo ? photo.name : 'Choose an image (jpg / png / webp, max 8 MB)'}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
            </label>
          </div>

          {error && (
            <p className="text-xs font-mono text-red-400 flex items-center gap-1.5">
              <AlertTriangle size={14} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-canopy text-white text-sm font-semibold px-6 py-3.5 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/25 disabled:opacity-60 disabled:hover:scale-100"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sprout size={16} />}
            {submitting ? 'Recording…' : `Submit contribution (+${selected.points} points)`}
          </button>

          {created && (
            <div className="flex items-start gap-3 bg-canopy/10 border border-canopy/25 rounded-2xl p-4">
              <CheckCircle2 size={18} className="text-canopy shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-canopy">Contribution recorded — +{created.points} Green Points</p>
                {org.type !== 'individual' && org.name && (
                  <p className="text-xs font-mono text-earth mt-1">
                    Organization credit: {org.name} ({ORG_TYPES.find((o) => o.id === org.type)?.label || org.type})
                  </p>
                )}
                <p className="text-xs font-mono text-mist-dim light:text-ink/60 mt-1">
                  Status: <span className="text-mist light:text-ink">Community reported</span> ·{' '}
                  <span className="text-amber-400 light:text-amber-600">Verification pending</span>. Your record id is {created.id}.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* My Impact — estimated environmental benefit of this user's contributions */}
        {items && (() => {
          const myId = getContributorId();
          const myRecords = items.filter((c) => c.contributor_id === myId);
          const treesPlanted = myRecords.filter((c) =>
            c.action_type === 'plant_tree' || c.action_type === 'community_plantation'
          ).length;
          const co2Kg = treesPlanted * 22;
          const o2Kg = treesPlanted * 118;

          if (treesPlanted === 0) return null;

          return (
            <div className="bg-panel light:bg-white border border-canopy/20 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-canopy/15 text-canopy flex items-center justify-center">
                  <TreePine size={18} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-mist light:text-ink">My Impact</h3>
                  <p className="text-[10px] font-mono text-mist-dim/60 light:text-ink/40">Documented average per tree</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 border border-white/8 light:border-black/8 text-center">
                  <p className="text-2xl font-display font-bold text-canopy">{treesPlanted}</p>
                  <p className="text-[10px] font-mono text-mist-dim/60 light:text-ink/40 mt-0.5">Trees planted</p>
                </div>
                <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 border border-white/8 light:border-black/8 text-center">
                  <p className="text-2xl font-display font-bold text-canopy">{co2Kg}</p>
                  <p className="text-[10px] font-mono text-mist-dim/60 light:text-ink/40 mt-0.5">kg CO₂ / year</p>
                </div>
                <div className="bg-white/5 light:bg-black/5 rounded-xl p-3 border border-white/8 light:border-black/8 text-center">
                  <p className="text-2xl font-display font-bold text-canopy">{o2Kg}</p>
                  <p className="text-[10px] font-mono text-mist-dim/60 light:text-ink/40 mt-0.5">kg O₂ / year</p>
                </div>
              </div>
              <p className="text-[9px] font-mono text-mist-dim/50 light:text-ink/30 leading-relaxed">
                Based on 22 kg CO₂ and 118 kg O₂ absorbed per mature tree per year (documented averages for tropical urban species). This is an estimate — actual impact depends on species, age and local conditions.
              </p>
            </div>
          );
        })()}

        {/* Recent contributions */}
        <div className="lg:col-span-2">
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-4">Recent community contributions</p>
          {feedError && <p className="text-xs font-mono text-red-400 mb-3">{feedError}</p>}
          {!items && !feedError && (
            <div className="flex items-center gap-3 text-sm font-mono text-mist-dim light:text-ink/50 py-10 justify-center">
              <Loader2 size={18} className="text-canopy animate-spin" /> Loading contributions…
            </div>
          )}
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {items?.map((c) => (
              <div key={c.id} className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-mist light:text-ink truncate">{c.contributor_name}</p>
                    <p className="text-xs text-mist-dim light:text-ink/60">{c.action_label}</p>
                    {c.organization_name && (
                      <p className="text-[10px] font-mono text-earth mt-0.5">{ORG_TYPES.find((o) => o.id === c.organization_type)?.icon} {c.organization_name}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono font-bold text-canopy text-sm">+{c.points}</span>
                </div>
                <p className="mt-2 text-[11px] font-mono text-mist-dim light:text-ink/50 flex items-center gap-1.5">
                  <CalendarDays size={11} /> {fmtDate(c.date)}
                  {c.place_name && (<><span className="mx-0.5">·</span><MapPin size={11} /> {c.place_name}</>)}
                </p>
                {c.description && (
                  <p className="mt-2 text-xs text-mist-dim light:text-ink/70 leading-relaxed">{c.description}</p>
                )}
                <div className="mt-3 flex items-center flex-wrap gap-2">
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS.community_reported}`}>
                    COMMUNITY REPORTED
                  </span>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS.pending}`}>
                    VERIFICATION PENDING
                  </span>
                  {c.evidence && (
                    <a
                      href={evidenceUrl(c.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-canopy/20 bg-canopy/10 text-canopy inline-flex items-center gap-1"
                    >
                      <Camera size={10} /> evidence
                    </a>
                  )}
                  {c.demo && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-white/10 light:border-black/10 text-mist-dim light:text-ink/40">
                      demo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Identity honesty note */}
      <div className="flex items-start gap-3 bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
        <ShieldAlert size={18} className="text-earth shrink-0 mt-0.5" />
        <p className="text-xs font-mono text-mist-dim light:text-ink/60 leading-relaxed">
          <User size={11} className="inline mr-1" />
          Identity is demo-grade: a browser-generated contributor ID and a display name. There are no accounts or
          passwords — anyone could report anything, so treat the board as community-reported participation, not proof.
        </p>
      </div>
    </div>
  );
}
