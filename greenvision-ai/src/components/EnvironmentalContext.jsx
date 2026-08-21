import { useState, useEffect } from 'react';
import {
  Cloud, Sunrise, Wind, Droplets, Leaf,
  Loader2, AlertTriangle, MapPin, CheckCircle2,
} from 'lucide-react';
import { getLocationContext, extractError } from '../api/api';

function Block({ title, icon: Icon, available, error, source, children }) {
  return (
    <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest flex items-center gap-1.5">
          <Icon size={13} className="text-canopy" /> {title}
        </span>
        {available ? (
          <span className="text-[9px] font-mono text-canopy flex items-center gap-1">
            <CheckCircle2 size={11} /> LIVE
          </span>
        ) : (
          <span className="text-[9px] font-mono text-mist-dim/60 light:text-ink/30">UNAVAILABLE</span>
        )}
      </div>

      {available ? (
        <>{children}</>
      ) : (
        <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 leading-relaxed">
          {error ? `Not available — ${error}.` : 'Not available at this time.'} No value is invented.
        </p>
      )}

      {source && available && (
        <p className="mt-2 pt-2 border-t border-white/5 light:border-black/5 text-[9px] font-mono text-mist-dim/70 light:text-ink/40 leading-relaxed break-words">
          {source.provider} · {source.endpoint} · fetched {source.fetched_at}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[10px] font-mono text-mist-dim light:text-ink/50">{label}</span>
      <span className="text-xs font-mono font-semibold text-mist light:text-ink">
        {value ?? '—'} {unit && <span className="text-mist-dim light:text-ink/40">{unit}</span>}
      </span>
    </div>
  );
}

export default function EnvironmentalContext({ scene }) {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Real geotagged position first; user-entered location as fallback.
  const gps = scene?.gps;
  const manual = scene?.userLocation;
  const lat = gps?.lat ?? manual?.lat;
  const lng = gps?.lng ?? manual?.lng;
  const name = gps ? scene?.locationName : (manual?.name || 'User-entered location');

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getLocationContext(lat, lng, name)
      .then((data) => { if (!cancelled) setCtx(data); })
      .catch((err) => { if (!cancelled) setError(extractError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lng, name]);

  if (lat == null || lng == null) {
    return (
      <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl px-5 py-4">
        <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <MapPin size={13} className="text-databue" /> Environmental context
        </p>
        <p className="text-xs font-mono text-mist-dim light:text-ink/50">
          No location available for this scene. Upload a georeferenced image or set a location at upload time to fetch live context.
        </p>
      </div>
    );
  }

  const b = ctx?.blocks ?? {};
  const weather = b.weather?.data;
  const aq = b.air_quality?.data;
  const soil = b.soil?.data;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-mono text-canopy font-semibold uppercase tracking-widest flex items-center gap-1.5">
            <Leaf size={14} /> Environmental context
          </p>
          <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mt-0.5">
            {gps ? 'Location from image geospatial metadata' : 'Location set by you (user-entered)'} — {name} · {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>
        {loading && <Loader2 size={16} className="text-canopy animate-spin" />}
      </div>

      {error && (
        <p className="text-[11px] font-mono text-danger flex items-center gap-1.5">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      {ctx && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Block title="Weather" icon={Cloud} available={b.weather?.available} error={b.weather?.error} source={b.weather?.source}>
            <div className="space-y-0.5">
              <Metric label="Temperature" value={weather?.temperature_2m} unit={weather?.units?.temperature_2m} />
              <Metric label="Humidity" value={weather?.relative_humidity_2m} unit={weather?.units?.relative_humidity_2m} />
              <Metric label="Precipitation" value={weather?.precipitation} unit={weather?.units?.precipitation} />
              <Metric label="Wind" value={weather?.wind_speed_10m} unit={weather?.units?.wind_speed_10m} />
            </div>
          </Block>

          <Block title="Air quality" icon={Wind} available={b.air_quality?.available} error={b.air_quality?.error} source={b.air_quality?.source}>
            <div className="space-y-0.5">
              <Metric label="AQI (PM2.5)" value={aq?.aqi_us_epa} unit={aq?.aqi_category} />
              <Metric label="PM2.5" value={aq?.pm2_5} unit={aq?.units?.pm2_5} />
              <Metric label="PM10" value={aq?.pm10} unit={aq?.units?.pm10} />
              <Metric label="Ozone" value={aq?.ozone} unit={aq?.units?.ozone} />
            </div>
          </Block>

          <Block title="Elevation" icon={Sunrise} available={b.elevation?.available} error={b.elevation?.error} source={b.elevation?.source}>
            <Metric label="Altitude" value={ctx.elevation_m} unit="m" />
          </Block>

          <Block title="Soil" icon={Droplets} available={b.soil?.available} error={b.soil?.error} source={b.soil?.source}>
            <div className="space-y-0.5">
              <Metric label="Moisture 0-7cm" value={soil?.soil_moisture_0_to_7cm} unit={soil?.units?.soil_moisture_0_to_7cm} />
              <Metric label="Moisture 7-28cm" value={soil?.soil_moisture_7_to_28cm} unit={soil?.units?.soil_moisture_7_to_28cm} />
              <Metric label="Temp 0-7cm" value={soil?.soil_temperature_0_to_7cm} unit={soil?.units?.soil_temperature_0_to_7cm} />
            </div>
          </Block>
        </div>
      )}

      <p className="text-[10px] font-mono text-mist-dim/60 light:text-ink/30">
        All values are observed from Open-Meteo public APIs for this coordinate. Blocks that fail upstream are shown as unavailable — never filled in.
      </p>
    </div>
  );
}
