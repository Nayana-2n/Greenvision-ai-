import DragDrop from './DragDrop';

export default function UploadCard({ onFileSelect, onAnalyze, disabled }) {
  return (
    <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 md:p-8 shadow-xl backdrop-blur-sm transition-colors">
      <div className="mb-6">
        <h3 className="font-display font-semibold text-xl mb-2 text-mist light:text-ink">Upload a scene</h3>
        <p className="text-mist-dim light:text-ink/60 text-sm leading-relaxed max-w-lg">
          A single top-down image (satellite or drone) is enough. The AI engine classifies the scene, detects trees, and estimates carbon &amp; oxygen. Georeferenced images will be pinned on the map.
        </p>
      </div>
      
      <DragDrop onFileSelect={onFileSelect} />
      
      <button
        onClick={onAnalyze}
        disabled={disabled}
        className="mt-6 w-full bg-canopy text-white font-semibold py-3.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-canopy/90 transition-all duration-300 disabled:hover:scale-100 hover:scale-[1.02] active:scale-100 shadow-md shadow-canopy/10"
      >
        Run analysis
      </button>
    </div>
  );
}
