import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { MapPin, Sprout } from 'lucide-react';
import { computeTargetGap, buildSceneBaseline } from '../utils/sceneMath';

// Marker icon fix for bundlers (default Leaflet marker assets get mangled)
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Approximate scene extent circle from the measured canopy share, when a
// green-cover % and forest area are known. Honest: an extent estimate from
// image area, not a GIS polygon.
function sceneRadiusMeters(scene) {
  const gc = scene?.greenCover ?? scene?.green_cover_percentage;
  const forestM2 = scene?.forest_area_m2;
  if (gc == null || !forestM2) return null;
  const sceneTotalM2 = forestM2 / (gc / 100);
  return Math.max(25, Math.sqrt(sceneTotalM2 / Math.PI));
}

// Priority → colour scale. The circle and legend use the same mapping so the
// map reads as a planting-priority map for the analyzed scene.
function priorityColor(priority) {
  switch (priority) {
    case 'High': return '#E5484D';
    case 'Medium': return '#C9A05C';
    case 'Low': return '#4FA8D8';
    default: return '#3FA34D';
  }
}

const PRIORITY_LEVELS = [
  { label: 'High priority', color: '#E5484D' },
  { label: 'Medium priority', color: '#C9A05C' },
  { label: 'Low priority', color: '#4FA8D8' },
];

export default function MapView({ scene }) {
  const gps = scene?.gps ?? null;
  const manual = scene?.userLocation ?? null;
  const pos = gps ? { lat: gps.lat, lng: gps.lng } : (manual?.lat != null ? { lat: manual.lat, lng: manual.lng } : null);
  const center = pos ? [pos.lat, pos.lng] : [12.9716, 77.5946];
  const mapZoom = pos ? 13 : 3;
  const radius = sceneRadiusMeters(scene);
  const priority = scene?.plantation_priority ?? scene?.priority ?? null;
  const green = scene?.greenCover ?? scene?.green_cover_percentage ?? null;
  const target = scene?.targetGreenCover ?? 60;
  const color = priorityColor(priority);

  // The actionable number: trees needed to close the canopy gap.
  const gap = useMemo(() => computeTargetGap(scene, buildSceneBaseline(scene)), [scene]);
  const gapTrees = gap && gap.trees_needed > 0 ? gap.trees_needed : null;

  const priorityOk = priority === 'Low' || priority === null;
  const greenOk = green == null ? null : green >= target;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 light:border-black/10 shadow-2xl h-full min-h-[440px]">
      <MapContainer
        center={center}
        zoom={mapZoom}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', minHeight: 440 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Approximate scene extent — coloured by plantation priority */}
        {pos && radius != null && (
          <Circle
            center={[pos.lat, pos.lng]}
            radius={radius}
            pathOptions={{ color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.15 }}
          />
        )}

        {/* Single-scene analysis: marker with the actionable diagnosis */}
        {pos && (
          <Marker position={[pos.lat, pos.lng]} icon={markerIcon}>
            <Popup className="font-mono text-xs">
              <div className="min-w-[200px] space-y-1">
                <p className="font-bold text-sm">{scene?.locationName || 'Analyzed scene'}</p>
                <p>Canopy: <span className="font-bold">{green != null ? `${green}%` : '—'}</span> · Target: {target}%</p>
                <p>Estimated gap: <span className="font-bold">{gapTrees ? `~${gapTrees.toLocaleString()} trees` : gap ? 'target met' : 'not computable'}</span></p>
                <p>Priority: <span className="font-bold">{priority ?? 'Not assessed'}</span></p>
                <em className="block text-[9px] text-mist-dim/70 pt-1 border-t border-white/10">
                  {gps ? 'Geotagged scene location from image metadata' : 'User-entered scene location'}
                </em>
                <Link
                  to="/planting"
                  className="mt-2 inline-flex items-center gap-1.5 bg-canopy text-white text-[10px] font-mono font-semibold px-3 py-1.5 rounded-full hover:scale-105 transition-transform"
                >
                  <Sprout size={12} /> View intervention plan
                </Link>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Planting-priority panel: legend + diagnosis + CTA (actionable overlay) */}
      {pos && (
        <div className="absolute top-4 left-4 z-[400] bg-ink/90 light:bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 light:border-black/10 shadow-xl max-w-[260px]">
          <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">
            PLANTING PRIORITY
          </p>
          <div className="space-y-1.5">
            {PRIORITY_LEVELS.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-[11px] font-mono text-mist light:text-ink">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                {l.label}
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 light:border-black/10 space-y-1.5">
            <p className="text-[11px] font-mono flex items-center justify-between gap-3">
              <span className="text-mist-dim light:text-ink/50 uppercase">Priority</span>
              <span className={`font-semibold ${priorityOk ? 'text-mist light:text-ink' : priority === 'High' ? 'text-red-400' : 'text-earth'}`}>
                {priority ?? 'Not assessed'}
              </span>
            </p>
            <p className="text-[11px] font-mono flex items-center justify-between gap-3">
              <span className="text-mist-dim light:text-ink/50 uppercase">Trees to target</span>
              <span className="font-semibold text-mist light:text-ink">
                {gapTrees ? `~${gapTrees.toLocaleString()}` : gap ? 'target met' : '—'}
              </span>
            </p>
            <p className="text-[11px] font-mono flex items-center justify-between gap-3">
              <span className="text-mist-dim light:text-ink/50 uppercase">Canopy</span>
              <span className={`font-semibold ${greenOk == null ? 'text-mist light:text-ink' : greenOk ? 'text-canopy' : 'text-red-400'}`}>
                {green != null ? `${green}%` : '—'}
              </span>
            </p>
            {green != null && target && green < target && (
              <p className="text-[11px] font-mono flex items-center justify-between gap-3">
                <span className="text-mist-dim light:text-ink/50 uppercase">Deficit</span>
                <span className="font-semibold text-red-400">
                  {(target - green).toFixed(1)} pp
                </span>
              </p>
            )}
            <Link
              to="/planting"
              className="mt-2 flex items-center justify-center gap-1.5 bg-canopy text-white text-[10px] font-mono font-semibold px-3 py-2 rounded-full hover:scale-105 transition-transform"
            >
              <Sprout size={12} /> Open intervention plan
            </Link>
          </div>

          {radius != null && (
            <p className="text-[9px] font-mono text-mist-dim/70 light:text-ink/40 pt-2 border-t border-white/10 light:border-black/10">
              Extent circle ≈ scene area from measured canopy share — an estimate, not a GIS polygon.
            </p>
          )}
        </div>
      )}

      {/* Honest notice when no location is available */}
      {!pos && (
        <div className="absolute bottom-4 left-4 z-[400] bg-ink/90 light:bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 light:border-black/10 shadow-xl max-w-[300px] flex items-start gap-2.5">
          <MapPin size={16} className="text-databue shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-mist light:text-ink leading-relaxed">
            No GPS metadata embedded in this image and no location set. Upload a georeferenced scene or set a location to pin the analysis.
          </p>
        </div>
      )}
    </div>
  );
}
