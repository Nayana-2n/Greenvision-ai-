import { useState, useEffect, useRef } from 'react';
import { Calendar, ArrowRightLeft, TrendingUp, TrendingDown, Minus, BarChart3, Upload, FileText, AlertTriangle, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function DeltaBadge({ delta, unit }) {
  if (delta == null) return <span className="text-mist-dim light:text-ink/30">—</span>;
  if (delta === 0) return <span className="text-mist-dim light:text-ink/30 flex items-center gap-1"><Minus size={12} /> No change</span>;
  const positive = delta > 0;
  return (
    <span className={`flex items-center gap-1 font-mono text-sm font-bold ${positive ? 'text-amber-400' : 'text-canopy'}`}>
      {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {positive ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(2) : delta}{unit ? ` ${unit}` : ''}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return 'Unknown date';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

export default function TemporalAnalysis() {
  const [reports, setReports] = useState([]);
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Historical upload state
  const [histFile, setHistFile] = useState(null);
  const [histYear, setHistYear] = useState('');
  const [histUploadResult, setHistUploadResult] = useState(null);
  const [histUploading, setHistUploading] = useState(false);
  const [histError, setHistError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/reports`)
      .then((r) => r.json())
      .then((d) => setReports(d.reports || []))
      .catch(() => {});
  }, []);

  const handleHistUpload = async () => {
    if (!histFile) return;
    setHistUploading(true);
    setHistError('');
    setHistUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', histFile);
      if (histYear) fd.append('year', histYear);
      const res = await fetch(`${API_BASE}/api/historical/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok && !data.status) throw new Error(data.error || 'Upload failed');
      setHistUploadResult(data);
      // Refresh reports list so newly analyzed reports appear in the dropdown
      if (data.status === 'analyzed') {
        const r2 = await fetch(`${API_BASE}/api/reports`);
        const d2 = await r2.json();
        setReports(d2.reports || []);
      }
    } catch (e) {
      setHistError(e.message);
    } finally {
      setHistUploading(false);
    }
  };

  const runCompare = async () => {
    if (!idA || !idB) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_a: idA, report_b: idB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Comparison failed');
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reportA = reports.find((r) => r.id === idA);
  const reportB = reports.find((r) => r.id === idB);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">
      <div>
        <span className="text-xs font-mono text-canopy font-semibold uppercase tracking-wider bg-canopy/10 px-3 py-1 rounded-full border border-canopy/20">
          <BarChart3 size={12} className="inline -mt-0.5" /> HISTORICAL COMPARISON
        </span>
        <h1 className="font-display text-2xl md:text-4xl font-bold text-mist light:text-ink mt-2">
          How has green cover changed?
        </h1>
        <p className="text-mist-dim light:text-ink/60 text-sm mt-1 max-w-2xl">
          Upload historical evidence or select two analysis reports to compare canopy cover, tree count, and carbon sequestration over time.
        </p>
      </div>

      {/* Upload Historical Evidence */}
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 shadow-xl">
        <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Upload size={13} className="text-canopy" /> UPLOAD HISTORICAL EVIDENCE
        </p>

        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-1.5">
              Historical image or report
            </label>
            <label className="flex items-center gap-3 bg-white/5 light:bg-black/5 border border-dashed border-white/20 light:border-black/20 rounded-xl px-4 py-3 cursor-pointer hover:border-canopy/40 transition-colors">
              <FileText size={18} className="text-canopy shrink-0" />
              <span className="text-sm text-mist-dim light:text-ink/60 truncate">
                {histFile ? histFile.name : 'Upload JPG, PNG, GeoTIFF, or PDF'}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.tif,.tiff,.pdf"
                className="hidden"
                onChange={(e) => setHistFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-1.5">
              Year (optional)
            </label>
            <input
              type="number"
              min="1990"
              max="2030"
              value={histYear}
              onChange={(e) => setHistYear(e.target.value)}
              placeholder="e.g. 2020"
              className="w-full bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-xl px-4 py-2.5 text-sm text-mist light:text-ink font-mono focus:outline-none focus:border-canopy/50"
            />
          </div>
        </div>

        <button
          onClick={handleHistUpload}
          disabled={!histFile || histUploading}
          className="mt-4 inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20 disabled:opacity-40 disabled:hover:scale-100"
        >
          {histUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {histUploading ? 'Processing...' : 'Upload & Process'}
        </button>

        {histError && (
          <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-200/90 light:text-red-700">{histError}</p>
          </div>
        )}

        {histUploadResult && (
          <div className="mt-4 bg-canopy/10 border border-canopy/25 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-canopy flex items-center gap-2">
              {histUploadResult.status === 'analyzed' ? '✓ Analyzed & saved' : histUploadResult.type === 'pdf' ? 'PDF processed' : 'Image saved'}
            </p>
            <p className="text-xs font-mono text-mist-dim light:text-ink/60">{histUploadResult.message}</p>
            {histUploadResult.year && (
              <p className="text-xs font-mono text-mist light:text-ink">Year: <span className="font-bold">{histUploadResult.year}</span></p>
            )}
            {histUploadResult.report_id && (
              <p className="text-xs font-mono text-mist light:text-ink">Report ID: <span className="font-bold">{histUploadResult.report_id}</span></p>
            )}
            {histUploadResult.extracted && Object.keys(histUploadResult.extracted).length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {histUploadResult.extracted.green_cover_percentage != null && (
                  <div className="bg-white/5 light:bg-black/5 rounded-xl px-3 py-2 border border-white/8 light:border-black/8">
                    <span className="block text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">Canopy</span>
                    <span className="block text-sm font-mono font-bold text-canopy">{histUploadResult.extracted.green_cover_percentage}%</span>
                  </div>
                )}
                {histUploadResult.extracted.estimated_trees != null && (
                  <div className="bg-white/5 light:bg-black/5 rounded-xl px-3 py-2 border border-white/8 light:border-black/8">
                    <span className="block text-[9px] font-mono text-mist-dim light:text-ink/50 uppercase">Trees</span>
                    <span className="block text-sm font-mono font-bold text-canopy">{histUploadResult.extracted.estimated_trees}</span>
                  </div>
                )}
              </div>
            )}
            {histUploadResult.extracted?.raw_text_preview && (
              <details className="mt-2">
                <summary className="text-[10px] font-mono text-mist-dim light:text-ink/50 cursor-pointer hover:text-canopy">
                  Show extracted text
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-mist-dim light:text-ink/40 whitespace-pre-wrap max-h-40 overflow-y-auto bg-white/5 light:bg-black/5 rounded-xl p-3">
                  {histUploadResult.extracted.raw_text_preview}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Report Comparison Selectors */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-md">
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={13} /> Earlier analysis (baseline)
          </p>
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="w-full bg-dark/50 light:bg-gray-50 border border-white/10 light:border-black/10 rounded-xl px-3 py-2.5 text-sm text-mist light:text-ink font-mono focus:outline-none focus:border-canopy/50"
          >
            <option value="">Select a report...</option>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.image_name || r.id} ({r.green_cover_percentage ?? '?'}% canopy)
              </option>
            ))}
          </select>
          {reportA && (
            <div className="mt-3 text-[10px] font-mono text-mist-dim light:text-ink/40">
              {formatDate(reportA.timestamp)} · {reportA.estimated_trees ?? '?'} trees · {reportA.green_cover_percentage ?? '?'}% canopy
            </div>
          )}
        </div>

        <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-5 shadow-md">
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={13} /> Later analysis (comparison)
          </p>
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="w-full bg-dark/50 light:bg-gray-50 border border-white/10 light:border-black/10 rounded-xl px-3 py-2.5 text-sm text-mist light:text-ink font-mono focus:outline-none focus:border-canopy/50"
          >
            <option value="">Select a report...</option>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.image_name || r.id} ({r.green_cover_percentage ?? '?'}% canopy)
              </option>
            ))}
          </select>
          {reportB && (
            <div className="mt-3 text-[10px] font-mono text-mist-dim light:text-ink/40">
              {formatDate(reportB.timestamp)} · {reportB.estimated_trees ?? '?'} trees · {reportB.green_cover_percentage ?? '?'}% canopy
            </div>
          )}
        </div>
      </div>

      <button
        onClick={runCompare}
        disabled={!idA || !idB || loading || idA === idB}
        className="inline-flex items-center gap-2 bg-canopy text-white text-xs font-mono font-semibold px-5 py-3 rounded-full hover:scale-105 transition-transform shadow-lg shadow-canopy/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <ArrowRightLeft size={14} /> {loading ? 'Comparing...' : 'Compare Reports'}
      </button>

      {idA === idB && idA && (
        <p className="text-xs font-mono text-amber-400">Select two different reports to compare.</p>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-xs text-red-200/90 light:text-red-700">{error}</p>
        </div>
      )}

      {/* Comparison Results */}
      {result && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-bold text-mist light:text-ink flex items-center gap-2">
            <BarChart3 size={18} className="text-canopy" /> Change Analysis
          </h2>

          {/* Timeline */}
          <div className="flex items-center gap-4 text-xs font-mono text-mist-dim light:text-ink/50">
            <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-xl px-3 py-2">
              <span className="text-mist light:text-ink font-semibold">{result.report_a?.image_name || result.report_a?.id}</span>
              <br />{formatDate(result.report_a?.timestamp)}
            </div>
            <ArrowRightLeft size={16} className="text-canopy shrink-0" />
            <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-xl px-3 py-2">
              <span className="text-mist light:text-ink font-semibold">{result.report_b?.image_name || result.report_b?.id}</span>
              <br />{formatDate(result.report_b?.timestamp)}
            </div>
          </div>

          {/* Metrics Table */}
          <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-2xl overflow-hidden shadow-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 light:border-black/10">
                  <th className="text-left px-5 py-3 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">Metric</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">Earlier</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">Later</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider">Change</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(result.metrics || {}).map((m) => (
                  <tr key={m.label} className="border-b border-white/5 light:border-black/5 last:border-0">
                    <td className="px-5 py-3 text-mist light:text-ink font-mono">{m.label}</td>
                    <td className="px-5 py-3 text-right text-mist-dim light:text-ink/70 font-mono">{m.value_a != null ? `${m.value_a}${m.unit ? ` ${m.unit}` : ''}` : '—'}</td>
                    <td className="px-5 py-3 text-right text-mist light:text-ink font-mono font-semibold">{m.value_b != null ? `${m.value_b}${m.unit ? ` ${m.unit}` : ''}` : '—'}</td>
                    <td className="px-5 py-3 text-right"><DeltaBadge delta={m.delta} unit={m.unit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interpretation */}
          <div className="bg-panel light:bg-white border border-canopy/20 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">INTERPRETATION</p>
            <p className="text-sm text-mist light:text-ink leading-relaxed">
              {(() => {
                const canopyDelta = result.metrics?.green_cover_percentage?.delta;
                if (canopyDelta == null) return 'Canopy change could not be calculated — one or both reports lack canopy data.';
                if (canopyDelta > 0) return `Canopy cover increased by ${canopyDelta.toFixed(2)} percentage points between these two analyses, indicating green cover growth or improvement.`;
                if (canopyDelta < 0) return `Canopy cover decreased by ${Math.abs(canopyDelta).toFixed(2)} percentage points, suggesting vegetation loss or degradation that may need attention.`;
                return 'Canopy cover remained stable between these two analyses.';
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
