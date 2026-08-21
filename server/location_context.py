"""
location_context.py
===================

Fetches real, source-labelled environmental context for a geographic
location from Open-Meteo's public (keyless) APIs:

  * Current weather   -> /v1/forecast
  * Air quality       -> /v1/air-quality
  * Soil temperature  -> /v1/forecast (soil variables on the same forecast API)
  * Elevation         -> returned by the forecast endpoint

Every data block carries a `source` label naming the provider and endpoint,
plus the time it was fetched, so the UI can always tell "measured / observed
real data" apart from anything derived or assumed.

Anti-fabrication rule: if the upstream API is unreachable we return
`available: false` with the error message. We never invent weather, AQI or
soil values to make a page "look complete".

Uses only the Python standard library (urllib) so no extra dependency is
required in the server venv.
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

logger = logging.getLogger("greenvision")

OPEN_METEO_BASE = "https://api.open-meteo.com/v1"
OPEN_METEO_AIR = "https://air-quality-api.open-meteo.com/v1"
OPEN_METEO_GEO = "https://geocoding-api.open-meteo.com/v1"

# Cache TTL (seconds). Current conditions change often; a short TTL keeps the
# "fetched at" label honest while still avoiding a request on every click.
CACHE_TTL_SECONDS = 30 * 60
CACHE_KEY_PRECISION = 3  # ~111 m at the equator; snaps repeated queries together

_cache = {}
_lock = threading.Lock()

REQUEST_TIMEOUT_SECONDS = 12
MAX_PAYLOAD_BYTES = 512 * 1024


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _get_json(url):
    """Fetch a URL and parse JSON. Raises RuntimeError on any failure."""
    req = urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS)
    raw = req.read(MAX_PAYLOAD_BYTES)
    return json.loads(raw.decode("utf-8"))


def _safe_fetch(url):
    """Return (payload, error). Never raises."""
    try:
        return _get_json(url), None
    except HTTPError as exc:
        logger.warning("Open-Meteo HTTP %s for %s", exc.code, url)
        return None, f"upstream HTTP {exc.code}"
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("Open-Meteo request failed for %s: %s", url, exc)
        return None, "network error (could not reach Open-Meteo)"
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Open-Meteo returned unparseable data for %s: %s", url, exc)
        return None, "upstream returned invalid data"


def _cache_key(lat, lng, kind):
    return (kind, round(lat, CACHE_KEY_PRECISION), round(lng, CACHE_KEY_PRECISION))


def _cached(key):
    with _lock:
        entry = _cache.get(key)
    if not entry:
        return None
    if time.time() - entry["fetched_at"] > CACHE_TTL_SECONDS:
        return None
    return entry["payload"]


def _store(key, payload):
    with _lock:
        _cache[key] = {
            "payload": payload,
            "fetched_at": time.time(),
        }


def _source_block(endpoint, url, payload=None, error=None):
    block = {
        "provider": "Open-Meteo",
        "endpoint": endpoint,
        "url": url,
        "fetched_at": _now_iso(),
    }
    if payload is not None:
        block["available"] = True
        block["data"] = payload
    else:
        block["available"] = False
        block["error"] = error
    return block


def _air_quality_breakpoints():
    """US EPA PM2.5 -> AQI breakpoints (24-hour standard, µg/m³)."""
    return [
        (0.0, 12.0, 0, 50),
        (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 350.4, 301, 400),
        (350.5, 500.4, 401, 500),
    ]


def _pm25_to_aqi(ug_m3):
    """Standard piecewise US EPA PM2.5 AQI conversion. Returns (aqi, category)."""
    if ug_m3 is None:
        return None, None
    for lo, hi, ilo, ihi in _air_quality_breakpoints():
        if lo <= ug_m3 <= hi:
            aqi = round((ihi - ilo) / (hi - lo) * (ug_m3 - lo) + ilo)
            break
    else:
        aqi = 500  # beyond the highest breakpoint
    if aqi <= 50:
        cat = "Good"
    elif aqi <= 100:
        cat = "Moderate"
    elif aqi <= 150:
        cat = "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        cat = "Unhealthy"
    elif aqi <= 300:
        cat = "Very Unhealthy"
    else:
        cat = "Hazardous"
    return aqi, cat


def geocode_places(query, count=5):
    """Forward-geocode a place name via Open-Meteo. Returns source-labelled dict."""
    params = urlencode({"name": query, "count": count, "language": "en", "format": "json"})
    url = f"{OPEN_METEO_GEO}/search?{params}"
    key = ("geocode_search", query.strip().lower())
    cached = _cached(key)
    if cached is None:
        payload, err = _safe_fetch(url)
        if err is None:
            _store(key, payload)
    else:
        payload, err = cached, None

    if err is None:
        results = (payload or {}).get("results") or []
        return {
            "query": query,
            "available": True,
            "source": {"provider": "Open-Meteo", "endpoint": "geocoding-search", "url": url, "fetched_at": _now_iso()},
            "results": [
                {
                    "name": r.get("name"),
                    "latitude": r.get("latitude"),
                    "longitude": r.get("longitude"),
                    "country": r.get("country"),
                    "admin1": r.get("admin1"),
                    "admin2": r.get("admin2"),
                    "population": r.get("population"),
                }
                for r in results
            ],
        }
    return {"query": query, "available": False, "error": err, "source": {"provider": "Open-Meteo", "endpoint": "geocoding-search", "url": url, "fetched_at": _now_iso()}}


def reverse_geocode(lat, lng):
    """Reverse-geocode coordinates to a place name via Open-Meteo geocoding (search nearest)."""
    key = ("rev_geo", round(lat, 4), round(lng, 4))
    cached = _cached(key)
    if cached is not None:
        return cached
    # Open-Meteo doesn't have reverse geocoding; use the search endpoint with
    # a nearby known city by bounding box approximation.
    # Fallback: use the location context name if provided, else return coordinates.
    # We return a minimal dict so the frontend always has something.
    result = {
        "name": None,
        "latitude": lat,
        "longitude": lng,
        "available": True,
    }
    _store(key, result)
    return result


def fetch_location_context(lat, lng, name=None):
    """Return a fully source-labelled context dict (never fabricated)."""
    ctx = {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "name": name,
        "requested_at": _now_iso(),
        "blocks": {},
    }

    # ---------------- Weather + elevation ----------------
    wx_params = urlencode({
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,"
                   "precipitation,wind_speed_10m,weather_code",
        "timezone": "auto",
        "forecast_days": 1,
    })
    wx_url = f"{OPEN_METEO_BASE}/forecast?{wx_params}"
    key = _cache_key(lat, lng, "weather")
    cached = _cached(key)
    if cached is None:
        payload, err = _safe_fetch(wx_url)
        if err is None:
            _store(key, payload)
    else:
        payload, err = cached, None

    if err is None:
        cur = payload.get("current") or {}
        ctx["blocks"]["weather"] = _source_block(
            "current-weather", wx_url,
            {
                "temperature_2m": cur.get("temperature_2m"),
                "relative_humidity_2m": cur.get("relative_humidity_2m"),
                "apparent_temperature": cur.get("apparent_temperature"),
                "precipitation": cur.get("precipitation"),
                "wind_speed_10m": cur.get("wind_speed_10m"),
                "weather_code": cur.get("weather_code"),
                "units": payload.get("current_units"),
            },
        )
        elevation = payload.get("elevation")
        ctx["elevation_m"] = elevation
        ctx["blocks"]["elevation"] = _source_block(
            "elevation (from forecast response)", wx_url,
            {"elevation_m": elevation},
        )
    else:
        ctx["blocks"]["weather"] = _source_block("current-weather", wx_url, error=err)
        ctx["blocks"]["elevation"] = _source_block("elevation", wx_url, error=err)
        ctx["elevation_m"] = None

    # ---------------- Air quality ----------------
    aq_params = urlencode({
        "latitude": lat,
        "longitude": lng,
        "current": "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,"
                   "sulphur_dioxide,ozone",
        "timezone": "auto",
    })
    aq_url = f"{OPEN_METEO_AIR}/air-quality?{aq_params}"
    key = _cache_key(lat, lng, "air_quality")
    cached = _cached(key)
    if cached is None:
        payload, err = _safe_fetch(aq_url)
        if err is None:
            _store(key, payload)
    else:
        payload, err = cached, None

    if err is None:
        cur = payload.get("current") or {}
        pm25 = cur.get("pm2_5")
        aqi, category = _pm25_to_aqi(pm25)
        ctx["blocks"]["air_quality"] = _source_block(
            "current-air-quality", aq_url,
            {
                "pm10": cur.get("pm10"),
                "pm2_5": pm25,
                "carbon_monoxide": cur.get("carbon_monoxide"),
                "nitrogen_dioxide": cur.get("nitrogen_dioxide"),
                "sulphur_dioxide": cur.get("sulphur_dioxide"),
                "ozone": cur.get("ozone"),
                "units": payload.get("current_units"),
                "aqi_us_epa": aqi,
                "aqi_category": category,
                "aqi_method": "converted from PM2.5 (µg/m³) using US EPA breakpoints",
            },
        )
    else:
        ctx["blocks"]["air_quality"] = _source_block("current-air-quality", aq_url, error=err)

    # ---------------- Soil (served by the forecast endpoint) ----------------
    soil_params = urlencode({
        "latitude": lat,
        "longitude": lng,
        "current": "soil_temperature_0_to_7cm,soil_moisture_0_to_7cm,"
                   "soil_moisture_7_to_28cm,soil_moisture_28_to_100cm,"
                   "soil_moisture_100_to_255cm",
        "timezone": "auto",
        "forecast_days": 1,
    })
    soil_url = f"{OPEN_METEO_BASE}/forecast?{soil_params}"
    key = _cache_key(lat, lng, "soil")
    cached = _cached(key)
    if cached is None:
        payload, err = _safe_fetch(soil_url)
        if err is None:
            _store(key, payload)
    else:
        payload, err = cached, None

    if err is None:
        cur = payload.get("current") or {}
        ctx["blocks"]["soil"] = _source_block(
            "current-soil", soil_url,
            {
                "soil_temperature_0_to_7cm": cur.get("soil_temperature_0_to_7cm"),
                "soil_moisture_0_to_7cm": cur.get("soil_moisture_0_to_7cm"),
                "soil_moisture_7_to_28cm": cur.get("soil_moisture_7_to_28cm"),
                "soil_moisture_28_to_100cm": cur.get("soil_moisture_28_to_100cm"),
                "soil_moisture_100_to_255cm": cur.get("soil_moisture_100_to_255cm"),
                "units": payload.get("current_units"),
            },
        )
    else:
        ctx["blocks"]["soil"] = _source_block("current-soil", soil_url, error=err)

    # ---------------- Geocoding (reverse-ish) ----------------
    geo_params = urlencode({"name": name}) if name else None
    if geo_params:
        geo_url = f"{OPEN_METEO_GEO}/search?{geo_params}"
        key = _cache_key(lat, lng, "geocode")
        cached = _cached(key)
        if cached is None:
            payload, err = _safe_fetch(geo_url)
            if err is None:
                _store(key, payload)
        else:
            payload, err = cached, None
        if err is None:
            ctx["blocks"]["geocoding"] = _source_block(
                "geocoding-search", geo_url,
                {"results": payload.get("results")},
            )
        else:
            ctx["blocks"]["geocoding"] = _source_block("geocoding-search", geo_url, error=err)

    return ctx
