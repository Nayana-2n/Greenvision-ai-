import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Cpu, ShieldCheck, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { analyzeImage, extractError } from '../api/api';
import { mapReportToScene } from '../utils/resultMapper';
import { setCurrentScene } from '../utils/sceneStore';

export default function Processing() {
  const [status, setStatus] = useState('running'); // running | complete | error
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const file = location.state?.file;
  const userLocation = location.state?.location;
  const ranRef = useRef(false);

  // No file -> nothing to process.
  useEffect(() => {
    if (!file) {
      navigate('/upload', { replace: true });
    }
  }, [file, navigate]);

  // Run the real backend pipeline exactly once.
  useEffect(() => {
    if (!file || ranRef.current) return;
    ranRef.current = true;
    setStatus('running');

    analyzeImage(file)
      .then((report) => {
        const scene = mapReportToScene(report);
        if (userLocation?.lat != null) {
          scene.userLocation = { ...userLocation };
        }
        setCurrentScene(scene);
        setStatus('complete');
        setTimeout(() => {
          navigate('/dashboard', { state: { result: scene } });
        }, 900);
      })
      .catch((err) => {
        setError(extractError(err));
        setStatus('error');
      });
  }, [file, navigate, userLocation]);

  if (status === 'error') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-panel light:bg-white border border-red-500/30 rounded-3xl p-8 md:p-10 shadow-2xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/15 text-red-400 mb-5">
            <AlertTriangle size={30} />
          </div>
          <h2 className="font-display text-2xl font-bold text-mist light:text-ink mb-2">
            Analysis failed
          </h2>
          <p className="text-sm text-mist-dim light:text-ink/70 leading-relaxed mb-6">
            {error}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => { ranRef.current = false; setStatus('running'); setError(null); }}
              className="inline-flex items-center gap-2 bg-canopy text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:scale-105 transition-transform"
            >
              <RefreshCw size={15} /> Try again
            </button>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-mist-dim light:text-ink/70 border border-white/10 light:border-black/10 hover:border-canopy hover:text-canopy transition-colors"
            >
              <ArrowLeft size={15} /> Back to upload
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-transparent via-canopy to-transparent" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-4">
            <Cpu size={14} className={status === 'complete' ? '' : 'animate-spin'} />
            AI-GIS PROCESSING ENGINE
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-mist light:text-ink mb-2">
            {status === 'complete' ? 'Analysis complete' : 'Analyzing urban canopy scene'}
          </h2>
          <p className="text-mist-dim light:text-ink/60 text-sm">
            {status === 'complete'
              ? 'Scene classified, canopy segmented and environmental metrics computed.'
              : 'Running scene classification, canopy segmentation, and environmental modeling on the backend. First inference can take a minute while the model loads.'}
          </p>
        </div>

        {/* Honest processing indicator (no fabricated step progress) */}
        <div className="mb-4">
          <div className="h-3 w-full bg-white/5 light:bg-black/5 rounded-full overflow-hidden border border-white/10 light:border-black/10">
            {status === 'running' && (
              <div className="h-full w-full bg-gradient-to-r from-canopy via-canopy to-databue animate-pulse" />
            )}
            {status === 'complete' && (
              <div className="h-full w-full bg-gradient-to-r from-canopy via-canopy to-databue" />
            )}
          </div>
        </div>

        {/* Pipeline stages — displayed as an ordered overview, not a live progress claim */}
        <div className="space-y-2.5 font-mono text-xs">
          {[
            'Validate image format & metadata',
            'Classify scene type (dense / sparse / street)',
            'Segment canopy & generate mask',
            'Measure green cover & estimate trees',
            'Compute carbon / oxygen & plantation priority',
            'Build analysis report',
          ].map((step, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                status === 'complete'
                  ? 'bg-white/5 light:bg-black/5 border-white/5 light:border-black/5 text-mist-dim light:text-ink/70'
                  : 'opacity-40 border-transparent text-mist-dim light:text-ink/40'
              }`}
            >
              {status === 'complete' ? (
                <CheckCircle2 size={16} className="text-canopy shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/20 light:border-black/20 shrink-0" />
              )}
              <span>{step}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 light:border-black/10 flex items-center justify-between text-xs font-mono text-mist-dim light:text-ink/50">
          <span className="flex items-center gap-1.5">
            {status === 'running' && <Loader2 size={14} className="text-canopy animate-spin" />}
            {status === 'running' ? 'Processing…' : 'Complete'}
          </span>
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-canopy" /> YOLO Scene Router + Canopy Segmentation</span>
        </div>

      </div>
    </div>
  );
}
