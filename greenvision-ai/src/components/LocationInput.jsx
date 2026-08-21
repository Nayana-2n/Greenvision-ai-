import { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Loader2, Crosshair } from 'lucide-react';
import { geocodePlaces, reverseGeocode, extractError } from '../api/api';

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [12.9766, 77.5929];

function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationInput({ value, onChange }) {
  const [query, setQuery] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const timerRef = useRef(null);

  const center = value?.lat != null ? [value.lat, value.lng] : DEFAULT_CENTER;

  const pick = (lat, lng, name) => {
    onChange({ lat, lng, name: name || '', provenance: 'user-entered' });
    if (name) {
      setQuery(name);
      setShowResults(false);
    }
  };

  const handleSearch = (text) => {
    setQuery(text);
    setPendingName(text);
    clearTimeout(timerRef.current);
    if (!text.trim()) {
      setResults([]);
      setShowResults(false);
      setSearchError('');
      return;
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const data = await geocodePlaces(text);
        if (data.available) {
          setResults(data.results || []);
          setShowResults(true);
        } else {
          setResults([]);
          setSearchError(data.error || 'No matches found.');
        }
      } catch (err) {
        setResults([]);
        setSearchError(extractError(err));
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const handleManual = (field, text) => {
    const num = parseFloat(text);
    if (Number.isFinite(num)) {
      const next = { ...(value || {}), [field]: num, provenance: 'user-entered' };
      if (field === 'lat' && (num < -90 || num > 90)) return;
      if (field === 'lng' && (num < -180 || num > 180)) return;
      onChange(next);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setSearching(true);
    setSearchError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const rev = await reverseGeocode(lat, lng);
          const name = rev?.name || rev?.display_name || 'Current location';
          onChange({ lat, lng, name, provenance: 'geolocation' });
          setQuery(name);
        } catch {
          onChange({ lat, lng, name: 'Current location', provenance: 'geolocation' });
          setQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setSearching(false);
      },
      () => {
        setSearchError('Could not read your location — try searching or picking on the map.');
        setSearching(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-4">
      {/* Search + geolocate */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-dim light:text-ink/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => results.length && setShowResults(true)}
              placeholder="Search a place (e.g. Cubbon Park, Bengaluru)"
              className="w-full bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-mist light:text-ink placeholder:text-mist-dim/60 light:placeholder:text-ink/40 focus:outline-none focus:border-canopy/50"
            />
          </div>
          <button
            type="button"
            onClick={useCurrentLocation}
            title="Use my current location"
            className="shrink-0 inline-flex items-center gap-1.5 bg-databue/15 light:bg-databue/10 text-databue border border-databue/30 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-databue/25 transition-colors"
          >
            <Crosshair size={14} /> Locate
          </button>
        </div>

        {searching && (
          <div className="absolute right-12 top-3.5 text-mist-dim"><Loader2 size={14} className="animate-spin" /></div>
        )}

        {showResults && results.length > 0 && (
          <ul className="absolute z-[500] mt-1 w-full bg-ink light:bg-white border border-white/10 light:border-black/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <li key={`${r.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(r.latitude, r.longitude, `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}${r.country ? `, ${r.country}` : ''}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 light:hover:bg-black/5 text-sm text-mist light:text-ink flex items-start gap-2"
                >
                  <MapPin size={14} className="text-canopy shrink-0 mt-0.5" />
                  <span className="font-mono">
                    <span className="font-semibold">{r.name}</span>
                    {r.admin1 && <span className="text-mist-dim light:text-ink/50">, {r.admin1}</span>}
                    {r.country && <span className="text-mist-dim light:text-ink/50">, {r.country}</span>}
                    <span className="block text-[10px] text-mist-dim light:text-ink/40">
                      {r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchError && (
          <p className="mt-1.5 text-[11px] font-mono text-danger">{searchError}</p>
        )}
      </div>

      {/* Map picker */}
      <div className="rounded-2xl overflow-hidden border border-white/10 light:border-black/10 h-56 relative">
        <MapContainer
          center={center}
          zoom={value?.lat != null ? 12 : 3}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ClickPicker onPick={(lat, lng) => pick(lat, lng, pendingName)} />
          {value?.lat != null && (
            <Marker
              position={[value.lat, value.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng();
                  onChange({ ...(value || {}), lat: p.lat, lng: p.lng, provenance: 'user-entered' });
                },
              }}
            />
          )}
        </MapContainer>
        <span className="absolute bottom-2 left-2 z-[400] bg-ink/90 light:bg-white/95 text-[10px] font-mono text-mist-dim light:text-ink/50 px-2 py-1 rounded-lg border border-white/10 light:border-black/10">
          Click the map to pin the scene location
        </span>
      </div>

      {/* Manual coordinates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-mist-dim light:text-ink/50 block mb-1">LATITUDE (−90..90)</label>
          <input
            type="number"
            step="any"
            value={value?.lat ?? ''}
            placeholder="e.g. 12.9766"
            onChange={(e) => handleManual('lat', e.target.value)}
            className="w-full bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-xl px-3 py-2 text-sm font-mono text-mist light:text-ink focus:outline-none focus:border-canopy/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-mono text-mist-dim light:text-ink/50 block mb-1">LONGITUDE (−180..180)</label>
          <input
            type="number"
            step="any"
            value={value?.lng ?? ''}
            placeholder="e.g. 77.5929"
            onChange={(e) => handleManual('lng', e.target.value)}
            className="w-full bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-xl px-3 py-2 text-sm font-mono text-mist light:text-ink focus:outline-none focus:border-canopy/50"
          />
        </div>
      </div>

      {/* Provenance label */}
      <div className="text-[11px] font-mono text-mist-dim light:text-ink/50">
        {value?.lat != null ? (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-canopy" />
            Location set — will be used to fetch real weather / air-quality / soil context for planning.
            <span className="text-mist-dim/60 light:text-ink/30">(provenance: user-entered)</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mist-dim/40" />
            No location set — analysis will use GPS embedded in the image when present.
          </span>
        )}
      </div>
    </div>
  );
}
