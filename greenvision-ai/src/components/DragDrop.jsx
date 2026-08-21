import { useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, X } from 'lucide-react';

export default function DragDrop({ onFileSelect }) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');

  // Cleanup object URL to prevent memory leaks when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    
    // Ensure the file is actually an image
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file (JPG, PNG, etc).");
      return;
    }

    setFileName(file.name);
    
    // Create an object URL instead of reading the whole file into memory (which can block the UI for large images)
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    
    onFileSelect?.(file);
  }, [onFileSelect]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clear = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setFileName('');
    onFileSelect?.(null);
  };

  if (preview) {
    return (
      <div className="relative rounded-2xl border border-white/10 light:border-black/10 overflow-hidden shadow-lg group">
        <img src={preview} alt="Uploaded aerial scene" className="w-full aspect-video object-cover" />
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={clear}
            title="Remove image"
            className="bg-ink/80 light:bg-white/90 backdrop-blur rounded-full p-2 border border-white/10 light:border-black/10 text-mist light:text-ink hover:bg-ink light:hover:bg-white transition-colors shadow-sm hover:scale-105"
          >
            <X size={16} />
          </button>
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-ink/80 light:bg-white/90 backdrop-blur px-4 py-2.5 flex items-center gap-2.5 font-mono text-xs text-mist-dim light:text-ink/70 border-t border-white/10 light:border-black/10">
          <ImageIcon size={14} className="text-canopy" /> 
          <span className="truncate">{fileName}</span>
        </div>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-4 aspect-video rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 w-full p-6 text-center ${
        dragActive 
          ? 'border-canopy bg-canopy/10 light:bg-canopy/5 scale-[1.01]' 
          : 'border-white/15 light:border-black/15 hover:border-white/30 light:hover:border-black/30 hover:bg-white/5 light:hover:bg-black/5'
      }`}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      
      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-300 ${dragActive ? 'bg-canopy text-white shadow-lg shadow-canopy/20' : 'bg-white/5 light:bg-black/5 text-mist-dim light:text-ink/60'}`}>
        <UploadCloud size={28} className={dragActive ? '' : 'text-canopy'} />
      </div>
      
      <div>
        <p className="font-display font-medium text-mist light:text-ink text-base md:text-lg mb-1">
          {dragActive ? 'Drop image here' : 'Drop a satellite or drone image'}
        </p>
        <p className="text-mist-dim light:text-ink/60 text-sm font-mono tracking-tight">
          JPG, PNG, TIFF — or click to browse
        </p>
      </div>
    </label>
  );
}
