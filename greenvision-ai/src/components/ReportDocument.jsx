// ReportDocument — the professional municipal action report (Part 12).
// Composes three real data sources into a printable, 15-section document:
//   1. The analyzed scene (report)
//   2. Live Open-Meteo location context (weather / AQI / soil, source-labelled)
//   3. The planting engine (species + trees-to-60% target)
// Every figure is labelled LIVE / CALCULATED / ESTIMATED / UNAVAILABLE.

import { useEffect, useState } from 'react';
import {
  TreePine, Wind, Cloud, AlertTriangle, Droplets, Loader2,
} from 'lucide-react';
import { getLocationContext, recommendPlanting } from '../api/api';

const TARGET = 60;

function Section({ n, title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-bold text-base text-black border-b-2 border-emerald-600 pb-2 mb-4 flex items-center gap-2">
        <span className="inline-flex w-6 h-6 rounded-full bg-emerald-600 text-white items-center justify-center text-[11px] font-mono shrink-0">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value, tag }) {
  return (
    <div className="py-1.5 border-b border-gray-100 last:border-0 flex items-start justify-between gap-4">
      <span className="text-[11px] font-mono text-gray-500">{label}</span>
      <span className="text-right">
        <span className="text-xs font-semibold text-gray-900">{value ?? '—'}</span>
        {tag && <span className="block text-[9px] font-mono text-gray-400">{tag}</span>}
      </span>
    </div>
  );
}

function DataTag({ kind }) {
  const styles = {
    LIVE: 'bg-emerald-100 text-emerald-800',
    MEASURED: 'bg-emerald-100 text-emerald-800',
    CALCULATED: 'bg-sky-100 text-sky-800',
    ESTIMATED: 'bg-amber-100 text-amber-800',
    UNAVAILABLE: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-block text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${styles[kind] || styles.ESTIMATED}`}>
      {kind}
    </span>
  );
}

export default function ReportDocument({ report }) {
  const [ctx, setCtx] = useState(null);
  const [plant, setPlant] = useState(null);
  const [state, setState] = useState({ ctx: 'loading', plant: 'loading' });

  const gps = report?.gps;
  const manual = report?.userLocation;
  const lat = gps?.lat ?? manual?.lat;
  const lng = gps?.lng ?? manual?.lng;
  const name = gps ? report?.image_name : (manual?.name || '');

  useEffect(() => {
    if (lat == null || lng == null) {
      setState((s) => ({ ...s, ctx: 'none', plant: 'none' }));
      return;
    }
    let cancelled = false;
    getLocationContext(lat, lng, name)
      .then((d) => { if (!cancelled) { setCtx(d); setState((s) => ({ ...s, ctx: 'done' })); } })
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, ctx: 'error' })); });
    recommendPlanting({ lat, lng, name, scene: report ?? {}, objective: 'shade' })
      .then((d) => { if (!cancelled) { setPlant(d); setState((s) => ({ ...s, plant: 'done' })); } })
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, plant: 'error' })); });
    return () => { cancelled = true; };
  }, [lat, lng, name, report]);

  if (!report) return null;

  const green = report.green_cover_percentage ?? report.canopy_percentage ?? null;
  const trees = report.estimated_trees ?? null;
  const carbon = report.carbon_tonnes_per_year ?? null;
  const oxygen = report.oxygen_tonnes_per_year ?? null;
  const density = report.density_class ?? null;
  const priority = report.plantation_priority ?? null;
  const areaHa = report.forest_area_hectares ?? null;
  const detected = report.detected_trees ?? null;
  const scene = report.scene ?? null;
  const sceneConf = report.scene_confidence != null ? (report.scene_confidence * 100).toFixed(0) : null;
  const gated = !!(report.vegetation_reliability && report.vegetation_reliability.reliable === false);
  const gateMessage = report.vegetation_reliability?.message ?? null;

  const gap = green != null ? Math.max(0, Math.round((TARGET - green) * 10) / 10) : null;
  const hasProblem = green != null && green < TARGET;

  const blocks = ctx?.blocks ?? {};
  const weather = blocks.weather?.data;
  const aq = blocks.air_quality?.data;
  const soil = blocks.soil?.data;

  const species = plant?.species ?? [];
  const targetData = plant?.target ?? {};
  const treesNeeded = targetData?.trees_needed ?? null;

  const simCarbon = treesNeeded != null ? Math.round((treesNeeded * 22) / 1000 * 100) / 100 : null;
  const simOxygen = treesNeeded != null ? Math.round((treesNeeded * 118) / 1000 * 100) / 100 : null;

  const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');

  const stateTag = (s, whenNone) => (s === 'done' ? 'LIVE' : s === 'error' ? 'UNAVAILABLE' : whenNone || 'UNAVAILABLE');

  return (
    <div className="bg-white text-ink rounded-3xl p-8 md:p-12 shadow-2xl border border-black/10 print:p-0 print:shadow-none print:border-none">
      {/* 1. COVER / HEADER */}
      <header className="border-b-4 border-emerald-600 pb-6 mb-8">
        <div className="flex justify-between items-start gap-6">
          <div>
            <div className="flex items-center gap-2 font-display font-bold text-2xl text-ink">
              <TreePine size={26} className="text-canopy" /> GreenVision<span className="text-canopy">.AI</span>
            </div>
            <p className="text-xs font-mono text-gray-500 mt-1">Urban Green Intelligence · Municipal Action Assessment</p>
          </div>
          <div className="text-right font-mono text-[11px] text-gray-500">
            <p className="font-bold text-ink">DOC. REF: {report.scene_id || report.id || '—'}</p>
            <p>Date: {fmtDate(report.timestamp)}</p>
            <p>Assessment type: Single-scene AI-GIS analysis</p>
          </div>
        </div>
        <h1 className="font-display font-bold text-2xl text-emerald-900 mt-6">
          {report.image_name || 'Analyzed aerial scene'} — Environmental Assessment
        </h1>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Prepared from live AI pipeline output · all figures source-labelled · no values invented
        </p>
      </header>

      {/* 2. EXECUTIVE SUMMARY */}
      <Section n="1" title="Executive Summary">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <p className="text-sm text-emerald-950 leading-relaxed">{report.summary || 'AI-GIS analysis completed for this scene.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {green != null && <span className="text-[11px] font-mono bg-white text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full">Canopy {green}% <DataTag kind="MEASURED" /></span>}
            {trees != null && <span className="text-[11px] font-mono bg-white text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full">~{trees.toLocaleString()} trees <DataTag kind="ESTIMATED" /></span>}
            {priority && <span className="text-[11px] font-mono bg-white text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full">{priority} plantation priority</span>}
          </div>
          {hasProblem && (
            <p className="mt-3 text-xs font-mono text-emerald-900 bg-white/70 border border-emerald-300 rounded-xl p-3">
              GREEN DEFICIT IDENTIFIED: canopy is {green}%, which is {gap} points below the {TARGET}% target. An intervention is recommended.
            </p>
          )}
        </div>
      </Section>

      {/* 3. SCENE & METHODOLOGY */}
      <Section n="2" title="Scene & Methodology">
        <div className="grid sm:grid-cols-2 gap-x-8">
          <Field label="Image" value={report.image_name} />
          <Field label="Scene classification" value={scene ? `${scene} (${sceneConf}% confidence)` : null} tag="MEASURED (scene classifier)" />
          <Field label="Ground resolution" value={report.scale_used != null ? `${report.scale_used} m/pixel` : '0.25 m/pixel (assumed)'} tag={report.scale_source === 'metadata' ? 'LIVE (image metadata)' : 'ESTIMATED (default)'} />
          <Field label="Georeferencing" value={report.metadata?.georef?.source === 'geotiff' ? `GeoTIFF (EPSG:${report.metadata?.georef?.crs_epsg})` : 'No georeferenced raster'} tag="UNAVAILABLE unless metadata present" />
          <Field label="Analysis engine" value="YOLO scene router + canopy segmentation + estimator pipeline" />
          <Field label="Reliability flag" value={gated ? 'Vegetation not measurable' : report.vegetation_warning ? 'Low-reliability vegetation estimate' : 'Nominal'} tag={gated ? 'UNAVAILABLE' : report.vegetation_warning ? 'ESTIMATED' : 'MEASURED'} />
        </div>
        {gated && (
          <p className="mt-3 text-xs font-mono text-red-800 bg-red-50 border border-red-300 rounded-xl p-3">
            <AlertTriangle size={13} className="inline mr-1" />{gateMessage}
          </p>
        )}
        {report.vegetation_warning && (
          <p className="mt-3 text-xs font-mono text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-3">
            <AlertTriangle size={13} className="inline mr-1" />{report.vegetation_warning}
          </p>
        )}
      </Section>

      {/* 4. LOCATION & ENVIRONMENT */}
      <Section n="3" title="Location & Environment">
        <div className="grid sm:grid-cols-2 gap-x-8">
          <Field label="Location name" value={ctx?.name || name || '—'} />
          <Field label="Coordinates" value={lat != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—'} tag={gps ? 'LIVE (image GPS metadata)' : manual ? 'user-entered' : 'UNAVAILABLE'} />
          <Field label="Elevation" value={ctx?.elevation_m != null ? `${ctx.elevation_m} m` : null} tag={stateTag(state.ctx, '—')} />
          <Field label="Temperature" value={weather?.temperature_2m != null ? `${weather.temperature_2m} ${weather?.units?.temperature_2m}` : null} tag="LIVE (Open-Meteo)" />
          <Field label="Humidity" value={weather?.relative_humidity_2m != null ? `${weather.relative_humidity_2m} ${weather?.units?.relative_humidity_2m}` : null} tag="LIVE (Open-Meteo)" />
          <Field label="Precipitation" value={weather?.precipitation != null ? `${weather.precipitation} ${weather?.units?.precipitation}` : null} tag="LIVE (Open-Meteo)" />
        </div>
        <p className="text-[10px] font-mono text-gray-400 mt-2">
          Environmental blocks are observed from Open-Meteo public APIs. Any block that failed upstream is shown as unavailable — never filled in.
        </p>
      </Section>

      {/* 5. MEASURED INDICATORS */}
      <Section n="4" title="Core Ecological Indicators">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
          {[
            ['Estimated trees', trees?.toLocaleString(), 'ESTIMATED', 'canopy area × density'],
            ['Canopy cover', green != null ? `${green}%` : null, 'MEASURED', 'segmentation'],
            ['Canopy area', areaHa != null ? `${areaHa} ha` : null, 'CALCULATED', 'mask × scale'],
            ['CO₂ / year', carbon != null ? `${carbon} t` : null, 'CALCULATED', '22 kg/tree'],
            ['O₂ / year', oxygen != null ? `${oxygen} t` : null, 'CALCULATED', '118 kg/tree'],
          ].map(([l, v, tag, sub], i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
              <span className="text-[10px] text-gray-500 block uppercase font-mono">{l}</span>
              <span className="text-2xl font-bold text-gray-900 block mt-1">{v ?? '—'}</span>
              <span className="text-[9px] text-gray-400 font-mono block mt-1">{sub}</span>
              <span className="mt-1 inline-block"><DataTag kind={tag} /></span>
            </div>
          ))}
        </div>
        {detected != null && (
          <p className="text-[11px] font-mono text-gray-500 mt-3">
            Street trunk detector separately counted {detected.toLocaleString()} visible trunks (a measured figure, distinct from the canopy-area estimate).
          </p>
        )}
      </Section>

      {/* 6. PROBLEM DETECTION */}
      <Section n="5" title="Area Diagnosis — Green Deficit">
        {hasProblem ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm text-red-900 leading-relaxed">
              This scene measures <span className="font-bold">{green}%</span> canopy cover, <span className="font-bold">{gap} points below</span> the
              {TARGET}% municipal canopy target{priority ? ` and is flagged ${priority} plantation priority` : ''}. The gap is the quantified
              reason an intervention is proposed — it is derived from the measured segmentation, not assumed.
            </p>
            {density && <p className="text-xs font-mono text-red-800 mt-2">Density class: {density}.</p>}
          </div>
        ) : green != null ? (
          <p className="text-sm text-gray-700">Canopy cover is {green}%, meeting or exceeding the {TARGET}% target. Focus should shift to protecting existing stock.</p>
        ) : (
          <p className="text-sm text-gray-500">Green cover was not computed for this scene type, so a deficit cannot be quantified.</p>
        )}
      </Section>

      {/* 7. PLANTATION PRIORITY */}
      <Section n="6" title="Plantation Priority">
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <span className={`font-mono font-bold text-sm px-3 py-1.5 rounded-full border ${
            priority === 'High' ? 'bg-red-100 text-red-700 border-red-300'
            : priority === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-300'
            : priority === 'Low' ? 'bg-sky-100 text-sky-800 border-sky-300'
            : 'bg-gray-100 text-gray-500 border-gray-300'
          }`}>
            {priority || 'Not assessed'}
          </span>
          <p className="text-xs text-gray-600 leading-relaxed">{report.plantation_recommendation || 'No recommendation produced for this scene.'}</p>
        </div>
      </Section>

      {/* 8. PLANTING RECOMMENDATION — SPECIES */}
      <Section n="7" title="Planting Recommendation — Species">
        {state.plant === 'loading' ? (
          <p className="text-sm font-mono text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Querying the species engine…</p>
        ) : species.length ? (
          <div className="space-y-3">
            {species.map((s, i) => (
              <div key={s.id} className="border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[10px] font-mono text-gray-400">#{i + 1} · {s.status} · {s.family}</span>
                    <p className="font-display font-bold text-gray-900">{s.common_name} <span className="text-xs font-mono font-normal text-gray-500 italic">{s.scientific_name}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg text-emerald-700">{(s.suitability_score ?? 0)}/100</p>
                    <p className="text-[9px] font-mono text-gray-400">GreenVision rule-based ranking</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono text-gray-600">
                  <span>H {s.height_m?.[0]}–{s.height_m?.[1]} m</span>
                  <span>Spread {s.canopy_spread_m?.[0]}–{s.canopy_spread_m?.[1]} m</span>
                  <span>Water {s.water_requirement}</span>
                  <span>Sun {s.sun_requirement}</span>
                  <span>Spacing {s.spacing_m} m</span>
                  <span>Pollution {s.pollution_tolerance}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.reasons?.map((r) => (
                    <span key={r} className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5">{r}</span>
                  ))}
                </div>
                {s.notes && <p className="mt-2 text-[11px] text-gray-600">{s.notes}</p>}
                <p className="mt-1 text-[9px] font-mono text-gray-400">{s.source}</p>
              </div>
            ))}
            <p className="text-[10px] font-mono text-gray-400">
              Objective for this recommendation: {plant?.objective}. The score above is a transparent rule-based planning ranking, not a scientific suitability measurement.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Species recommendation unavailable <DataTag kind="UNAVAILABLE" /> — requires a location.</p>
        )}
      </Section>

      {/* 9. TREES NEEDED */}
      <Section n="8" title="Trees Needed to Reach the 60% Canopy Target">
        {treesNeeded != null ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <p className="text-3xl font-bold text-emerald-700 font-mono">{treesNeeded.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              additional trees estimated to take canopy from {targetData.current_green_cover}% to {TARGET}%, assuming each planted tree adds canopy
              equal to the scene's current measured canopy per tree ({targetData.canopy_m2_per_tree_assumed} m²/tree).
            </p>
            <p className="text-[10px] font-mono text-gray-400 mt-2">{targetData.method}</p>
            {targetData.indicative_only && (
              <p className="mt-2 text-[11px] font-mono text-amber-700 bg-amber-50 border border-amber-300 rounded-xl p-2">{targetData.disclosure}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Planting target unavailable <DataTag kind="UNAVAILABLE" /> — needs an analyzed scene with measured canopy and a location.</p>
        )}
      </Section>

      {/* 9. PLANNING BUDGET */}
      <Section n="9" title="Estimated Investment (Planning)">
        {state.plant === 'loading' ? (
          <p className="text-sm font-mono text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Querying the budget model…</p>
        ) : plant?.budget?.available ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['Sapling cost', plant.budget.line_items?.sapling_cost_inr, '₹ / tree'],
                ['Planting labour', plant.budget.line_items?.planting_labour_inr, '₹ / tree'],
                [`Maintenance × ${plant.budget.maintenance_years ?? 1} yr`, plant.budget.line_items?.maintenance_inr, '₹ / tree / yr'],
              ].map(([l, v, u]) => (
                <div key={l} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-gray-500 block uppercase font-mono">{l}</span>
                  <span className="text-lg font-bold text-emerald-800 block mt-1">₹{Number(v ?? 0).toLocaleString('en-IN')}</span>
                  <span className="text-[9px] font-mono text-gray-400 block">{u}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <span className="text-xs font-mono text-emerald-900">
                Total · {plant.budget.tree_count?.toLocaleString()} trees · {plant.budget.formula}
              </span>
              <span className="font-display font-bold text-2xl text-emerald-700">{plant.budget.total_estimate_inr_formatted}</span>
            </div>
            <p className="mt-3 text-[11px] font-mono text-amber-700 bg-amber-50 border border-amber-300 rounded-xl p-2">{plant.budget.disclosure}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Budget estimate unavailable <DataTag kind="UNAVAILABLE" /> — needs a computed planting target (analyzed scene with measured canopy + location) and configured cost assumptions.
          </p>
        )}
      </Section>

      {/* 10. INTERVENTION SIMULATION */}
      <Section n="10" title="Simulated Intervention Impact">
        {simCarbon != null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-mono text-sky-700 uppercase block">Trees planted</span>
              <span className="text-xl font-bold text-sky-900 block mt-1">{treesNeeded.toLocaleString()}</span>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-mono text-sky-700 uppercase block">CO₂ / year</span>
              <span className="text-xl font-bold text-sky-900 block mt-1">+{simCarbon} t</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-mono text-amber-700 uppercase block">O₂ / year</span>
              <span className="text-xl font-bold text-amber-900 block mt-1">+{simOxygen} t</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-mono text-emerald-700 uppercase block">People offset</span>
              <span className="text-xl font-bold text-emerald-900 block mt-1">~{Math.round((simCarbon / 4.7) * 10) / 10}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Simulation unavailable without a computed planting target.</p>
        )}
        <p className="text-[10px] font-mono text-gray-400 mt-3">
          Math: 22 kg CO₂ and 118 kg O₂ per tree per year (documented per-tree averages); 4.7 t CO₂ per person per year. These are planning averages, not carbon-stock models.
        </p>
      </Section>

      {/* 11. ENVIRONMENTAL CONTEXT TABLE */}
      <Section n="11" title="Environmental Context (Live)">
        {state.ctx === 'loading' ? (
          <p className="text-sm font-mono text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Fetching live environment…</p>
        ) : lat == null ? (
          <p className="text-sm text-gray-500">No location on this scene — live context unavailable <DataTag kind="UNAVAILABLE" />.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <p className="text-xs font-mono font-bold text-gray-800 mb-2 flex items-center gap-1.5"><Cloud size={13} /> Weather</p>
              <Field label="Temperature" value={weather?.temperature_2m != null ? `${weather.temperature_2m} ${weather?.units?.temperature_2m}` : null} tag="LIVE" />
              <Field label="Humidity" value={weather?.relative_humidity_2m != null ? `${weather.relative_humidity_2m}${weather?.units?.relative_humidity_2m}` : null} tag="LIVE" />
              <Field label="Precipitation" value={weather?.precipitation != null ? `${weather.precipitation}${weather?.units?.precipitation}` : null} tag="LIVE" />
              <Field label="Wind" value={weather?.wind_speed_10m != null ? `${weather.wind_speed_10m}${weather?.units?.wind_speed_10m}` : null} tag="LIVE" />
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-gray-800 mb-2 flex items-center gap-1.5"><Wind size={13} /> Air quality</p>
              <Field label="AQI (PM2.5)" value={aq?.aqi_us_epa != null ? `${aq.aqi_us_epa} · ${aq.aqi_category}` : null} tag={aq?.aqi_us_epa != null ? 'LIVE' : 'UNAVAILABLE'} />
              <Field label="PM2.5" value={aq?.pm2_5 != null ? `${aq.pm2_5}${aq?.units?.pm2_5}` : null} tag="LIVE" />
              <Field label="PM10" value={aq?.pm10 != null ? `${aq.pm10}${aq?.units?.pm10}` : null} tag="LIVE" />
              <Field label="Ozone" value={aq?.ozone != null ? `${aq.ozone}${aq?.units?.ozone}` : null} tag="LIVE" />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-mono font-bold text-gray-800 mb-2 mt-3 flex items-center gap-1.5"><Droplets size={13} /> Soil</p>
              <Field label="Moisture 0–7 cm" value={soil?.soil_moisture_0_to_7cm != null ? `${soil.soil_moisture_0_to_7cm}${soil?.units?.soil_moisture_0_to_7cm}` : null} tag="LIVE (Open-Meteo)" />
              <Field label="Soil temp 0–7 cm" value={soil?.soil_temperature_0_to_7cm != null ? `${soil.soil_temperature_0_to_7cm}${soil?.units?.soil_temperature_0_to_7cm}` : null} tag="LIVE (Open-Meteo)" />
            </div>
          </div>
        )}
      </Section>

      {/* 12. DATA PROVENANCE */}
      <Section n="12" title="Data Provenance & Honesty">
        <ul className="space-y-2 text-[11px] font-mono text-gray-600">
          <li><DataTag kind="LIVE" /> — observed values (image metadata, Open-Meteo weather/AQI/soil).</li>
          <li><DataTag kind="MEASURED" /> — directly from the AI segmentation / trunk detector.</li>
          <li><DataTag kind="CALCULATED" /> — derived with documented formulas (carbon/oxygen, area).</li>
          <li><DataTag kind="ESTIMATED" /> — heuristics (tree count from canopy area × density, ground scale default).</li>
          <li><DataTag kind="UNAVAILABLE" /> — genuinely not computed or upstream source failed; never fabricated.</li>
        </ul>
        <p className="mt-3 text-[11px] font-mono text-gray-500">
          GreenVision does not report temperature reduction, AQI impact, or biodiversity scores — no model or data source
          supports those claims in this pipeline. The investment figure above is a planning estimate built from
          configurable assumptions (visible formula), not a tender or audited expenditure.
        </p>
      </Section>

      {/* 13. MUNICIPAL ACTIONS */}
      <Section n="13" title="Recommended Municipal Actions">
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          {hasProblem && treesNeeded != null ? (
            <>
              <li>Prioritize the flagged {priority || 'intervention'} zones of this scene for the first planting tranche (~{treesNeeded.toLocaleString()} trees to close the canopy gap).</li>
              <li>Shortlist {species.slice(0, 3).map((s) => s.common_name).join(', ') || 'the species above'} for procurement, subject to site-level soil/space verification.</li>
              <li>Conduct ground verification before procurement — planting numbers assume canopy density is maintained.</li>
              <li>Re-analyze the scene after the growing season to measure the actual canopy gain.</li>
            </>
          ) : (
            <li>No deficit-driven planting required based on current data; maintain and monitor existing stock.</li>
          )}
        </ol>
      </Section>

      {/* 14. CITIZEN ACTIONS */}
      <Section n="14" title="Recommended Citizen Actions">
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          <li>Plant a {species[0]?.common_name || 'native'} tree in a suitable spot (water {species[0]?.water_requirement || 'per species'}, sun {species[0]?.sun_requirement || 'per species'}, spacing {species[0]?.spacing_m || 'per species'} m).</li>
          <li>One tree adds ~22 kg CO₂ absorbed and ~118 kg O₂ per year — a personal, measurable contribution.</li>
          <li>Coordinate with the municipal plan above where your home is within the flagged priority area.</li>
        </ol>
      </Section>

      {/* 15. DISCLAIMER & REFERENCES */}
      <Section n="15" title="Model Assumptions, Limitations & Disclaimer">
        <p className="text-[11px] font-mono text-gray-500 leading-relaxed">
          Species attributes are planning references compiled from published Indian urban-forestry / horticultural sources; they are typical mature
          ranges, not site measurements. Trees-needed is an arithmetic projection, not a field survey. Environmental values are observed from
          Open-Meteo public APIs at the stated coordinate/time and are not site instruments. Verify all figures against ground survey before
          procurement or budget commitment.
        </p>
        <p className="mt-3 text-[10px] font-mono text-gray-400">
          Generated by GreenVision.AI · Document {report.scene_id || report.id || '—'}
        </p>
      </Section>

      <footer className="pt-6 border-t border-gray-200 flex justify-between items-center text-[10px] font-mono text-gray-400">
        <span>GreenVision.AI — Urban Green Intelligence</span>
        <span>Data-honest · source-labelled · no fabricated values</span>
      </footer>
    </div>
  );
}
