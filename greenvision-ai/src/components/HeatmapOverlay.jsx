import { useState } from 'react';
import { Layers, X } from 'lucide-react';

export default function HeatmapOverlay({ heatmapUrl }) {
  const [open, setOpen] = useState(false);

  if (!heatmapUrl) return null;

  const fullUrl = heatmapUrl.startsWith('http')
    ? heatmapUrl
    : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${heatmapUrl}`;

  return (
    <div className="mb-6">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-panel light:bg-white border border-white/10 light:border-black/10 text-mist light:text-ink text-xs font-mono font-semibold px-4 py-2.5 rounded-full hover:scale-105 transition-transform shadow-md"
        >
          <Layers size={14} className="text-canopy" />
          Show Vegetation Heatmap
        </button>
      )}
      {open && (
        <div className="bg-panel light:bg-white border border-canopy/30 rounded-2xl p-4 shadow-xl relative">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest">
              Vegetation Heatmap — green = canopy detected
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-mist-dim hover:text-mist light:text-ink/50 light:hover:text-ink transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="relative rounded-xl overflow-hidden bg-dark/50 light:bg-gray-100 flex items-center justify-center" style={{ minHeight: 300 }}>
            <img
              src={fullUrl}
              alt="Vegetation heatmap overlay"
              className="max-w-full max-h-[500px] object-contain"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
            />
            <p className="hidden text-xs font-mono text-mist-dim light:text-ink/50 p-4 text-center">
              Heatmap image could not be loaded.
            </p>
          </div>
          <p className="mt-2 text-[10px] font-mono text-mist-dim light:text-ink/40">
            Green regions: canopy vegetation detected by the segmentation model. Dark regions: non-vegetation (buildings, roads, bare ground).
          </p>
        </div>
      )}
    </div>
  );
}
