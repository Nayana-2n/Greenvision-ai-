import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadCard from '../components/UploadCard';
import LocationInput from '../components/LocationInput';
import { Sparkles, CheckCircle2, ArrowRight, Info, MapPin, Loader2 } from 'lucide-react';
import { setUserLocation } from '../utils/locationStore';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload() {
  const [file, setFile] = useState(null);
  const [location, setLocation] = useState(null);
  const navigate = useNavigate();

  const handleLocationChange = (loc) => {
    setLocation(loc);
    if (loc?.lat != null && loc?.lng != null) setUserLocation(loc);
  };

  const handleRunAnalysis = () => {
    if (!file) return;
    navigate('/processing', { state: { file, location } });
  };

  const [loadingSample, setLoadingSample] = useState(false);

  const handleSampleScene = async () => {
    if (loadingSample) return;
    setLoadingSample(true);
    try {
      const res = await fetch('/sample-scene.jpg');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'sample_scene_low_canopy.jpg', { type: 'image/jpeg' });
      const defaultLocation = location || {
        lat: 12.9716,
        lng: 77.5946,
        name: 'Bengaluru',
        provenance: 'sample-default',
      };
      setFile(sampleFile);
      setLocation(defaultLocation);
      setUserLocation(defaultLocation);
      navigate('/processing', { state: { file: sampleFile, location: defaultLocation } });
    } catch {
      setLoadingSample(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-center">
      <div className="max-w-4xl w-full mx-auto px-6 py-12 md:py-16 space-y-8">
        
        {/* Header */}
        <div className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-3">
            <Sparkles size={14} /> SPATIAL RASTER INGESTION
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
            Analyze Satellite Scene
          </h1>
          <p className="text-mist-dim light:text-ink/70 text-base mt-1 max-w-2xl">
            Upload raw satellite imagery or drone orthomosaics. The AI engine classifies the scene,
            measures canopy cover, estimates tree counts, and computes carbon &amp; oxygen.
          </p>
          <button
            onClick={handleSampleScene}
            disabled={loadingSample}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-canopy to-leaf hover:opacity-90 active:scale-[0.99] disabled:opacity-60 px-4 py-2.5 rounded-xl shadow-lg shadow-canopy/20"
          >
            {loadingSample ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loadingSample ? 'Loading sample scene…' : 'Try a sample scene →'}
          </button>
        </div>

        {/* File Picker & Inspect */}
        <UploadCard 
          onFileSelect={setFile} 
          onAnalyze={handleRunAnalysis} 
          disabled={!file} 
        />

        {/* Scene Location (P2/P3: location as first-class input) */}
        <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 light:border-black/10">
            <span className="text-canopy font-bold flex items-center gap-1.5"><MapPin size={16} /> SCENE LOCATION</span>
            <span className="text-mist-dim light:text-ink/50 font-mono text-[10px]">Optional · used for planning context</span>
          </div>

          <p className="text-sm text-mist-dim light:text-ink/60 mb-4 max-w-2xl">
            Pin where this scene is located so the platform can attach <span className="text-mist light:text-ink font-semibold">real</span>,
            source-labelled weather, air-quality and soil context and recommend species for the actual place.
            If the image carries GPS metadata, the analyzed location will override this input after processing.
          </p>

          <LocationInput value={location} onChange={handleLocationChange} />
        </div>

        {/* Image Metadata Inspection Card */}
        {file && (
          <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 font-mono text-xs shadow-md">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 light:border-black/10">
              <span className="text-canopy font-bold flex items-center gap-1.5"><CheckCircle2 size={16} /> RASTER FILE INSPECT</span>
              <span className="text-mist-dim light:text-ink/50">Ready for Neural Pipeline</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-mist-dim light:text-ink/50 text-[10px] block">FILE NAME</span>
                <span className="font-bold text-mist light:text-ink truncate block">{file.name}</span>
              </div>
              <div>
                <span className="text-mist-dim light:text-ink/50 text-[10px] block">FILE SIZE</span>
                <span className="font-bold text-canopy">{formatBytes(file.size)}</span>
              </div>
              <div>
                <span className="text-mist-dim light:text-ink/50 text-[10px] block">TYPE</span>
                <span className="font-bold text-databue">{file.type || 'image'}</span>
              </div>
              <div>
                <span className="text-mist-dim light:text-ink/50 text-[10px] block">SCALE</span>
                <span className="font-bold text-earth">Estimated by engine</span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-[11px] text-mist-dim light:text-ink/60 bg-white/5 light:bg-black/5 rounded-xl p-3">
              <Info size={14} className="text-databue shrink-0 mt-0.5" />
              <span>
                Ground scale is read from the image when available (GeoTIFF ModelPixelScale / ModelTiepoint
                gives real resolution; JPG/PNG without georeferencing falls back to an assumed 0.25 m/pixel).
                GPS EXIF or GeoTIFF coordinates will place the scene on the Command Center map.
              </span>
            </div>
          </div>
        )}

        {file && (
          <div className="flex items-center gap-2 justify-center text-sm text-mist-dim light:text-ink/70">
            <ArrowRight size={16} className="text-canopy" />
            File ready — run analysis to process this scene through the live pipeline.
          </div>
        )}

      </div>
    </div>
  );
}
