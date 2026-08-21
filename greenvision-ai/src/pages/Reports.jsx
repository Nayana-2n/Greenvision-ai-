import { useState, useEffect } from 'react';
import { Printer, Download, FileText, AlertTriangle, RefreshCw, Leaf, ArrowLeftRight } from 'lucide-react';
import { fetchReports, fetchReport, downloadReport, extractError } from '../api/api';
import ReportDocument from '../components/ReportDocument';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function delta(a, b) {
  if (a == null || b == null) return null;
  const diff = b - a;
  if (diff === 0) return '—';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}`;
}

function CompareRow({ label, a, b, unit }) {
  const d = delta(a, b);
  return (
    <tr className="border-b border-white/5 light:border-black/5 last:border-0">
      <td className="py-2 pr-3 text-xs font-mono text-mist-dim/60 light:text-ink/40">{label}</td>
      <td className="py-2 px-3 text-xs font-mono text-mist light:text-ink text-right">{a != null ? a : '—'}{a != null && unit ? ` ${unit}` : ''}</td>
      <td className="py-2 px-3 text-xs font-mono text-mist light:text-ink text-right">{b != null ? b : '—'}{b != null && unit ? ` ${unit}` : ''}</td>
      <td className={`py-2 pl-3 text-xs font-mono text-right font-semibold ${d && d !== '—' ? (d.startsWith('+') ? 'text-amber-400' : 'text-canopy') : 'text-mist-dim/30 light:text-ink/20'}`}>
        {d ?? '—'}
      </td>
    </tr>
  );
}

export default function Reports() {
  const { mode } = useMode();
  const isCitizen = mode === MODES.CITIZEN;
  const isIndustrial = mode === MODES.INDUSTRIAL;
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareId, setCompareId] = useState(null);
  const [compareReport, setCompareReport] = useState(null);

  const loadList = () => {
    setLoading(true);
    setError(null);
    fetchReports()
      .then((list) => {
        setReports(list);
        setSelectedId((prev) => prev ?? (list.length ? list[0].id : null));
        setLoading(false);
      })
      .catch((err) => {
        setError(extractError(err));
        setLoading(false);
      });
  };

  useEffect(loadList, []);

  useEffect(() => {
    if (!selectedId) return;
    setReport(null);
    fetchReport(selectedId)
      .then((data) => setReport(data))
      .catch((err) => setError(extractError(err, 'Could not load this report.')));
  }, [selectedId]);

  useEffect(() => {
    if (!compareMode || !compareId) { setCompareReport(null); return; }
    fetchReport(compareId)
      .then((data) => setCompareReport(data))
      .catch(() => setCompareReport(null));
  }, [compareMode, compareId]);

  // Auto-select the second report in compare mode
  useEffect(() => {
    if (compareMode && !compareId) {
      const other = reports.find((r) => r.id !== selectedId);
      if (other) setCompareId(other.id);
    }
  }, [compareMode, reports, selectedId, compareId]);

  const handlePrint = () => { window.print(); };

  const handleDownload = async () => {
    if (!selectedId) return;
    const url = await downloadReport(selectedId);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greenvision-report-${selectedId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const r = report;
  const cr = compareReport;

  // Extract comparison fields
  const cA = r ? (r.green_cover_percentage ?? r.canopy_percentage ?? null) : null;
  const cB = cr ? (cr.green_cover_percentage ?? cr.canopy_percentage ?? null) : null;
  const tA = r?.estimated_trees ?? null;
  const tB = cr?.estimated_trees ?? null;
  const coA = r?.carbon_tonnes_per_year ?? null;
  const coB = cr?.carbon_tonnes_per_year ?? null;
  const oA = r?.oxygen_tonnes_per_year ?? null;
  const oB = cr?.oxygen_tonnes_per_year ?? null;
  const arA = r?.forest_area_hectares ?? null;
  const arB = cr?.forest_area_hectares ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 lg:py-16 space-y-8">
      
      {/* Header & Export Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-2">
            <FileText size={14} /> {isCitizen ? 'PERSONAL ACTION PLAN' : isIndustrial ? 'SITE EXECUTIVE REPORT' : 'MUNICIPAL EXECUTIVE REPORT'}
          </div>
          <h1 className="font-display text-3xl font-bold text-mist light:text-ink">
            {isCitizen ? 'My Action Plan' : 'Official Environmental Assessment'}
          </h1>
          <p className="text-sm text-mist-dim light:text-ink/60 mt-1">
            {isCitizen
              ? 'The assessment for your area — what to plant, roughly how many, and what one tree does. Print or export it as your action plan.'
              : 'Reports archive from the live analysis engine.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {reports.length >= 2 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`inline-flex items-center gap-2 border text-xs font-mono font-semibold px-4 py-2.5 rounded-full transition-colors ${
                compareMode
                  ? 'bg-canopy text-white border-canopy'
                  : 'bg-white/10 light:bg-black/10 border-white/10 light:border-black/10 text-mist light:text-ink hover:border-canopy hover:text-canopy'
              }`}
            >
              <ArrowLeftRight size={14} /> {compareMode ? 'Exit Compare' : 'Compare Scenes'}
            </button>
          )}
          {report && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 bg-white/10 light:bg-black/10 border border-white/10 light:border-black/10 text-mist light:text-ink font-semibold px-5 py-2.5 rounded-full hover:border-databue hover:text-databue transition-colors text-sm"
            >
              <Download size={16} /> Download JSON
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={!report}
            className="inline-flex items-center gap-2 bg-canopy text-white font-semibold px-5 py-2.5 rounded-full hover:scale-105 transition-transform text-sm shadow-lg shadow-canopy/20 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Printer size={16} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Reports list selector */}
      <div className="print:hidden">
        {loading ? (
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 animate-pulse">Loading reports…</p>
        ) : error && !reports.length ? (
          <div className="bg-panel light:bg-white border border-red-500/30 rounded-2xl p-6 flex items-center gap-4">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-mist light:text-ink mb-1">Could not load the report archive</p>
              <p className="text-xs font-mono text-mist-dim light:text-ink/60">{error}</p>
            </div>
            <button onClick={loadList} className="inline-flex items-center gap-2 text-xs font-mono bg-canopy text-white px-4 py-2 rounded-full">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6">
            <p className="text-sm text-mist light:text-ink">
              {isCitizen
                ? 'No reports yet. A report is generated whenever a scene is analyzed — upload an aerial image from the Municipal mode, and the action plan for your area will appear here.'
                : 'No reports yet. Run an analysis from the Upload page — every analysis is archived here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Primary report selector */}
            <p className="text-[10px] font-mono text-mist-dim/50 light:text-ink/30 uppercase tracking-widest mb-2">Primary report</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {reports.map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => setSelectedId(rep.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-mono border text-left transition-all ${
                    selectedId === rep.id
                      ? 'bg-canopy text-white border-canopy shadow-lg'
                      : 'bg-white/5 light:bg-black/5 text-mist-dim light:text-ink/70 border-white/10 light:border-black/10 hover:border-canopy'
                  }`}
                  title={rep.scene_id || rep.id}
                >
                  <span className="block max-w-[160px] truncate font-semibold">
                    {rep.image_name || rep.scene_id || rep.id}
                  </span>
                  {rep.timestamp && (
                    <span className={`block text-[9px] mt-0.5 ${selectedId === rep.id ? 'text-white/70' : 'text-mist-dim/70 light:text-ink/40'}`}>
                      {fmtDate(rep.timestamp)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Compare report selector (only in compare mode) */}
            {compareMode && (
              <>
                <p className="text-[10px] font-mono text-mist-dim/50 light:text-ink/30 uppercase tracking-widest mt-4 mb-2">Compare with</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {reports.filter((rep) => rep.id !== selectedId).map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => setCompareId(rep.id)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-xs font-mono border text-left transition-all ${
                        compareId === rep.id
                          ? 'bg-databue text-white border-databue shadow-lg'
                          : 'bg-white/5 light:bg-black/5 text-mist-dim light:text-ink/70 border-white/10 light:border-black/10 hover:border-databue'
                      }`}
                      title={rep.scene_id || rep.id}
                    >
                      <span className="block max-w-[160px] truncate font-semibold">
                        {rep.image_name || rep.scene_id || rep.id}
                      </span>
                      {rep.timestamp && (
                        <span className={`block text-[9px] mt-0.5 ${compareId === rep.id ? 'text-white/70' : 'text-mist-dim/70 light:text-ink/40'}`}>
                          {fmtDate(rep.timestamp)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Comparison Table */}
      {compareMode && r && cr && (
        <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-lg print:hidden">
          <p className="text-[10px] font-mono text-mist-dim/50 light:text-ink/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <ArrowLeftRight size={10} className="text-canopy" /> Scene Comparison
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 light:border-black/10">
                  <th className="py-2 pr-3 text-[10px] font-mono text-mist-dim/40 light:text-ink/30 text-left uppercase">Metric</th>
                  <th className="py-2 px-3 text-[10px] font-mono text-mist-dim/40 light:text-ink/30 text-right uppercase">{r.image_name || r.scene_id || 'A'}</th>
                  <th className="py-2 px-3 text-[10px] font-mono text-mist-dim/40 light:text-ink/30 text-right uppercase">{cr.image_name || cr.scene_id || 'B'}</th>
                  <th className="py-2 pl-3 text-[10px] font-mono text-mist-dim/40 light:text-ink/30 text-right uppercase">Change</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Canopy cover" a={cA} b={cB} unit="%" />
                <CompareRow label="Estimated trees" a={tA} b={tB} />
                <CompareRow label="CO₂ (t/yr)" a={coA} b={coB} />
                <CompareRow label="O₂ (t/yr)" a={oA} b={oB} />
                <CompareRow label="Area (ha)" a={arA} b={arB} />
              </tbody>
            </table>
          </div>
          <p className="text-[9px] font-mono text-mist-dim/30 light:text-ink/20 mt-3">
            All values from the same analysis engine. Green = decrease, amber = increase.
          </p>
        </div>
      )}

      {/* Printable Report Document (professional 15-section assessment) */}
      {r ? (
        <ReportDocument report={r} />
      ) : (
        <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-12 text-center">
          <Leaf size={28} className="text-canopy mx-auto mb-3" />
          <p className="text-sm text-mist-dim light:text-ink/60">Select a report above to view the assessment.</p>
        </div>
      )}

      {/* Compare report document (non-printable, below primary) */}
      {compareMode && cr && (
        <div className="print:hidden border-t-2 border-dashed border-white/10 light:border-black/10 pt-8 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-mono text-mist-dim/40 light:text-ink/30 uppercase tracking-widest">Comparison report</span>
            <span className="text-[10px] font-mono text-databue bg-databue/10 border border-databue/20 px-2 py-0.5 rounded-full">{cr.image_name || cr.scene_id}</span>
          </div>
          <ReportDocument report={cr} />
        </div>
      )}

    </div>
  );
}
