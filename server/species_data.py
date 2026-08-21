"""
species_data.py
===============

Planning-grade species reference for Indian / Bengaluru urban planting and
the rule-based "what / why / where / how many" recommendation builder used
by POST /api/plant/recommend.

Honesty contract
----------------
* Species attributes are PLANNING REFERENCES compiled from published
  horticultural / forestry sources (see ``source`` on every entry). They are
  typical mature ranges, not site measurements — verify against local soil,
  space and maintenance before procurement.
* ``trees_needed`` is a transparent arithmetic projection from the analyzed
  scene (target 60% canopy, current measured canopy m², measured canopy m²
  per tree). It is never fabricated; when the scene's vegetation estimate is
  flagged low-reliability the number is returned as indicative-only.
* No fabricated claims such as "this species cuts AQI by X points".
* Species suitability is LOCATION-CONDITIONED. Each species carries climate
  preference attributes (``climate``, ``frost_tolerance``,
  ``rainfall_preference``, ``elevation_range_m``) compiled from published
  silvicultural references, and the rule score rewards matches against the
  live location context (elevation, current temperature, rainfall, AQI).
  The ranking therefore changes with location (e.g. Leh vs Bengaluru). It is
  a transparent planning heuristic based on CURRENT observed conditions —
  winter-hardiness must be verified against local climate normals.
* ``suitability_score`` is an ABSOLUTE rubric rank (raw rule score / max
  possible rule score), never normalised to force the top species to 100.
"""

from math import ceil

from budget_model import estimate_budget

TARGET_GREEN_COVER = 60.0

# ---------------------------------------------------------------------------
# Species reference (id, common, scientific, family, status, attributes)
# ---------------------------------------------------------------------------

SPECIES = [
    {
        "id": "neem",
        "common_name": "Neem",
        "scientific_name": "Azadirachta indica",
        "family": "Meliaceae",
        "status": "native",
        "height_m": [15, 20],
        "canopy_spread_m": [10, 15],
        "growth_rate": "medium",
        "evergreen": False,
        "water_requirement": "low",
        "sun_requirement": "full",
        "pollution_tolerance": "high",
        "benefits": ["dense shade", "pollution tolerant", "medicinal", "drought resistant"],
        "best_for": ["roadside", "park", "school", "avenue"],
        "spacing_m": 8,
        "notes": "Very hardy urban species; tolerant of poor soil and heat.",
        "source": "Planning reference from published Indian urban-forestry and horticultural sources (e.g. city tree-planting guides).",
    },
    {
        "id": "banyan",
        "common_name": "Indian Banyan",
        "scientific_name": "Ficus benghalensis",
        "family": "Moraceae",
        "status": "native",
        "height_m": [20, 25],
        "canopy_spread_m": [20, 30],
        "growth_rate": "fast",
        "evergreen": True,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["very large canopy", "bird habitat", "long-lived"],
        "best_for": ["park", "open ground", "temple precinct"],
        "spacing_m": 15,
        "notes": "Needs open space; roots can lift pavement, not for narrow roadsides.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "pongamia",
        "common_name": "Pongamia / Indian Beech",
        "scientific_name": "Millettia pinnata",
        "family": "Fabaceae",
        "status": "native",
        "height_m": [10, 15],
        "canopy_spread_m": [8, 12],
        "growth_rate": "medium",
        "evergreen": False,
        "water_requirement": "low",
        "sun_requirement": "full",
        "pollution_tolerance": "high",
        "benefits": ["shade", "nitrogen fixing", "tolerant of poor soil"],
        "best_for": ["roadside", "avenue", "residential", "park"],
        "spacing_m": 8,
        "notes": "Widely used in Bengaluru as a hardy avenue tree.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "rain_tree",
        "common_name": "Rain Tree",
        "scientific_name": "Samanea saman",
        "family": "Fabaceae",
        "status": "exotic",
        "height_m": [15, 25],
        "canopy_spread_m": [20, 30],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["wide shade canopy", "fast cover"],
        "best_for": ["park", "avenue", "open ground"],
        "spacing_m": 12,
        "notes": "Commonly planted across Bengaluru; brittle wood, needs space.",
        "source": "Planning reference from published urban-forestry sources.",
    },
    {
        "id": "gulmohar",
        "common_name": "Gulmohar / Flame Tree",
        "scientific_name": "Delonix regia",
        "family": "Fabaceae",
        "status": "exotic",
        "height_m": [10, 15],
        "canopy_spread_m": [12, 18],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["flowering", "light shade", "ornamental"],
        "best_for": ["avenue", "park", "residential"],
        "spacing_m": 10,
        "notes": "Showy flowering; broad spreading crown.",
        "source": "Planning reference from published urban-forestry sources.",
    },
    {
        "id": "coral_tree",
        "common_name": "Indian Coral Tree",
        "scientific_name": "Erythrina variegata",
        "family": "Fabaceae",
        "status": "native",
        "height_m": [6, 12],
        "canopy_spread_m": [6, 10],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "low",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["fast growth", "ornamental flowers", "supports birds"],
        "best_for": ["park", "residential", "street median"],
        "spacing_m": 7,
        "notes": "Fast-growing native with seasonal leaf fall.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "tamarind",
        "common_name": "Tamarind",
        "scientific_name": "Tamarindus indica",
        "family": "Fabaceae",
        "status": "native",
        "height_m": [10, 15],
        "canopy_spread_m": [10, 15],
        "growth_rate": "slow",
        "evergreen": True,
        "water_requirement": "low",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["dense shade", "fruit", "long-lived"],
        "best_for": ["park", "open ground", "avenue"],
        "spacing_m": 10,
        "notes": "Slow to establish but very long-lived and drought hardy.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "jackfruit",
        "common_name": "Jackfruit",
        "scientific_name": "Artocarpus heterophyllus",
        "family": "Moraceae",
        "status": "native",
        "height_m": [10, 15],
        "canopy_spread_m": [8, 12],
        "growth_rate": "medium",
        "evergreen": True,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["fruit", "dense shade", "food security"],
        "best_for": ["park", "community garden", "open ground"],
        "spacing_m": 10,
        "notes": "Productive native fruit tree; good for community planting.",
        "source": "Planning reference from published Indian horticultural sources.",
    },
    {
        "id": "pipal",
        "common_name": "Pipal / Sacred Fig",
        "scientific_name": "Ficus religiosa",
        "family": "Moraceae",
        "status": "native",
        "height_m": [15, 25],
        "canopy_spread_m": [15, 20],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["large canopy", "bird habitat", "culturally significant"],
        "best_for": ["park", "open ground", "temple precinct"],
        "spacing_m": 12,
        "notes": "Aggressive roots; needs open space away from structures.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "amaltas",
        "common_name": "Amaltas / Golden Shower",
        "scientific_name": "Cassia fistula",
        "family": "Fabaceae",
        "status": "native",
        "height_m": [5, 9],
        "canopy_spread_m": [4, 6],
        "growth_rate": "medium",
        "evergreen": False,
        "water_requirement": "low",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["showy flowers", "compact size", "drought tolerant"],
        "best_for": ["roadside", "street median", "small spaces"],
        "spacing_m": 6,
        "notes": "Good compact native for constrained roadside planting.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "silver_oak",
        "common_name": "Silver Oak",
        "scientific_name": "Grevillea robusta",
        "family": "Proteaceae",
        "status": "exotic",
        "height_m": [15, 25],
        "canopy_spread_m": [6, 8],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["fast vertical growth", "light shade"],
        "best_for": ["avenue", "boundary planting", "park"],
        "spacing_m": 6,
        "notes": "Fast-growing, narrow crown; common in Bengaluru avenues.",
        "source": "Planning reference from published urban-forestry sources.",
    },
    {
        "id": "teak",
        "common_name": "Teak",
        "scientific_name": "Tectona grandis",
        "family": "Lamiaceae",
        "status": "native",
        "height_m": [20, 30],
        "canopy_spread_m": [10, 15],
        "growth_rate": "medium",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["valuable timber", "large canopy"],
        "best_for": ["park", "large open ground", "greenbelt"],
        "spacing_m": 10,
        "notes": "Deciduous; large tree best for parks and greenbelts.",
        "source": "Planning reference from published Indian forestry sources.",
    },
    {
        "id": "arjuna",
        "common_name": "Arjuna",
        "scientific_name": "Terminalia arjuna",
        "family": "Combretaceae",
        "status": "native",
        "height_m": [15, 25],
        "canopy_spread_m": [10, 15],
        "growth_rate": "medium",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "high",
        "benefits": ["shade", "riparian tolerance", "ornamental bark"],
        "best_for": ["riverbank", "park", "avenue"],
        "spacing_m": 10,
        "notes": "Hardy native, tolerant of periodic waterlogging.",
        "source": "Planning reference from published Indian urban-forestry sources.",
    },
    {
        "id": "bamboo",
        "common_name": "Bamboo",
        "scientific_name": "Bambusa bambos",
        "family": "Poaceae",
        "status": "native",
        "height_m": [15, 25],
        "canopy_spread_m": [3, 5],
        "growth_rate": "very fast",
        "evergreen": True,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["very fast cover", "carbon dense", "soil stabilization"],
        "best_for": ["greenbelt", "buffer planting", "windbreak"],
        "spacing_m": 4,
        "notes": "Clumping bamboo for screening and fast green cover; containment needed.",
        "source": "Planning reference from published Indian forestry sources.",
    },
    {
        "id": "jacaranda",
        "common_name": "Jacaranda",
        "scientific_name": "Jacaranda mimosifolia",
        "family": "Bignoniaceae",
        "status": "exotic",
        "height_m": [10, 15],
        "canopy_spread_m": [10, 15],
        "growth_rate": "medium",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["flowering", "shade", "ornamental"],
        "best_for": ["avenue", "park", "residential"],
        "spacing_m": 9,
        "notes": "Purple flowering; established as an ornamental avenue tree.",
        "source": "Planning reference from published urban-forestry sources.",
    },
    {
        "id": "deodar",
        "common_name": "Deodar / Himalayan Cedar",
        "scientific_name": "Cedrus deodara",
        "family": "Pinaceae",
        "status": "native",
        "height_m": [30, 50],
        "canopy_spread_m": [10, 15],
        "growth_rate": "medium",
        "evergreen": True,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["evergreen", "windbreak", "timber", "long-lived", "cold hardy"],
        "best_for": ["park", "large open ground", "greenbelt", "avenue"],
        "spacing_m": 10,
        "notes": "Cold-hardy conifer of the western Himalaya; needs space and good drainage.",
        "source": "Planning reference from published Himalayan forestry sources.",
    },
    {
        "id": "chinar",
        "common_name": "Chinar / Oriental Plane",
        "scientific_name": "Platanus orientalis",
        "family": "Platanaceae",
        "status": "native",
        "height_m": [20, 30],
        "canopy_spread_m": [20, 30],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "high",
        "benefits": ["very large canopy", "cold hardy", "fast cover", "heritage tree"],
        "best_for": ["park", "avenue", "open ground"],
        "spacing_m": 12,
        "notes": "Kashmir-Himalayan heritage tree; large spreading crown, cold hardy.",
        "source": "Planning reference from published Himalayan urban-forestry sources.",
    },
    {
        "id": "himalayan_poplar",
        "common_name": "Himalayan Poplar",
        "scientific_name": "Populus ciliata",
        "family": "Salicaceae",
        "status": "native",
        "height_m": [15, 25],
        "canopy_spread_m": [10, 18],
        "growth_rate": "fast",
        "evergreen": False,
        "water_requirement": "medium",
        "sun_requirement": "full",
        "pollution_tolerance": "medium",
        "benefits": ["fast growth", "cold hardy", "windbreak", "riverbank tolerance"],
        "best_for": ["roadside", "avenue", "riverbank", "windbreak"],
        "spacing_m": 6,
        "notes": "Fast-growing cold-hardy poplar of the Himalaya; good near water.",
        "source": "Planning reference from published Himalayan forestry sources.",
    },
]

_BY_ID = {s["id"]: s for s in SPECIES}


# ---------------------------------------------------------------------------
# Climate preference attributes (merged into each SPECIES dict at load).
# Planning references compiled from published silvicultural / horticultural
# sources (see module docstring). Used by score_species for location-aware
# ranking so that a materially different location yields a different
# shortlist instead of one static ranking.
# ---------------------------------------------------------------------------

_CLIMATE_ATTRS = {
    "neem": {
        "climate": ["tropical", "subtropical", "arid"],
        "frost_tolerance": "tender",
        "rainfall_preference": "low",
        "elevation_range_m": [0, 1000],
    },
    "banyan": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 800],
    },
    "pongamia": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "low",
        "elevation_range_m": [0, 1200],
    },
    "rain_tree": {
        "climate": ["tropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 600],
    },
    "gulmohar": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 800],
    },
    "coral_tree": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "low",
        "elevation_range_m": [0, 1200],
    },
    "tamarind": {
        "climate": ["tropical", "subtropical", "arid"],
        "frost_tolerance": "tender",
        "rainfall_preference": "low",
        "elevation_range_m": [0, 800],
    },
    "jackfruit": {
        "climate": ["tropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "high",
        "elevation_range_m": [0, 1000],
    },
    "pipal": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 1200],
    },
    "amaltas": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "low",
        "elevation_range_m": [0, 1500],
    },
    "silver_oak": {
        "climate": ["subtropical", "temperate"],
        "frost_tolerance": "moderate",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 1800],
    },
    "teak": {
        "climate": ["tropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "high",
        "elevation_range_m": [0, 900],
    },
    "arjuna": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "tender",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 1000],
    },
    "bamboo": {
        "climate": ["tropical", "subtropical"],
        "frost_tolerance": "moderate",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 1000],
    },
    "jacaranda": {
        "climate": ["subtropical", "temperate"],
        "frost_tolerance": "moderate",
        "rainfall_preference": "medium",
        "elevation_range_m": [0, 1600],
    },
    "deodar": {
        "climate": ["temperate", "montane", "cold"],
        "frost_tolerance": "hardy",
        "rainfall_preference": "medium",
        "elevation_range_m": [800, 3800],
    },
    "chinar": {
        "climate": ["temperate", "montane", "cold"],
        "frost_tolerance": "hardy",
        "rainfall_preference": "medium",
        "elevation_range_m": [300, 3200],
    },
    "himalayan_poplar": {
        "climate": ["temperate", "montane", "cold"],
        "frost_tolerance": "hardy",
        "rainfall_preference": "medium",
        "elevation_range_m": [1000, 3800],
    },
}

for _s in SPECIES:
    _s.update(_CLIMATE_ATTRS.get(_s["id"], {}))


# Maximum achievable rule score — sum of the rubric's reward ceilings.
# 3 (objective) + 1 (native) + 2 (climate) + 1 (frost hardiness) +
# 1 (elevation range) + 1 (low rainfall) + 2 (AQI) = 11.
MAX_RULE_SCORE = 11


# ---------------------------------------------------------------------------
# Planting target (HOW MANY) — transparent arithmetic from the analyzed scene
# ---------------------------------------------------------------------------

def compute_planting_target(scene):
    """Estimate trees needed to reach the 60% canopy target.

    Uses only measured scene values: green cover %, canopy m², estimated
    trees, and (when present) total scene m² from image pixels × scale².
    """
    scene = scene or {}
    gc = scene.get("green_cover_percentage")
    if gc is None:
        gc = scene.get("canopy_percentage")
    trees = scene.get("estimated_trees")
    forest_m2 = scene.get("forest_area_m2")
    total_pixels = scene.get("total_pixels")
    scale = scene.get("scale_used") or scene.get("scale_used_m_per_pixel")

    if gc is None or trees is None or forest_m2 is None or forest_m2 <= 0 or trees <= 0:
        return {
            "computable": False,
            "reason": "Planting target needs measured green cover %, canopy area and tree estimate from an analyzed scene.",
        }

    # Total scene area (m²) derived from measured pixels × scale² when known.
    scene_total_m2 = None
    if total_pixels and scale:
        scene_total_m2 = total_pixels * (scale ** 2)

    current_canopy_m2 = forest_m2
    m2_per_tree = forest_m2 / trees

    if scene_total_m2 is None:
        # Fall back to canopy-share arithmetic (gc% of unknown total).
        # Use canopy m² as the whole when target is expressed as ratio.
        target_canopy_m2 = current_canopy_m2 / (gc / 100.0) * (TARGET_GREEN_COVER / 100.0)
        scene_total_m2 = current_canopy_m2 / (gc / 100.0)

    needed_m2 = max(0.0, scene_total_m2 * (TARGET_GREEN_COVER / 100.0) - current_canopy_m2)
    trees_needed = ceil(needed_m2 / m2_per_tree) if needed_m2 > 0 else 0

    low_reliability = bool(scene.get("vegetation_warning"))

    return {
        "computable": True,
        "target_green_cover": TARGET_GREEN_COVER,
        "current_green_cover": round(gc, 2),
        "current_canopy_m2": round(current_canopy_m2, 2),
        "scene_total_m2": round(scene_total_m2, 2),
        "target_canopy_m2": round(scene_total_m2 * (TARGET_GREEN_COVER / 100.0), 2),
        "needed_canopy_m2": round(needed_m2, 2),
        "canopy_m2_per_tree_assumed": round(m2_per_tree, 2),
        "trees_needed": trees_needed,
        "method": "target canopy = 60% of scene area; each planted tree assumed to add canopy equal to the scene's current measured canopy area per tree (canopy density maintained).",
        "indicative_only": low_reliability,
        "disclosure": (
            "Low-reliability scene estimate — treat the planting number as indicative pending ground verification."
            if low_reliability else
            "Estimated from the analyzed scene; ground verification recommended before procurement."
        ),
    }


# ---------------------------------------------------------------------------
# Species shortlist (WHAT) — transparent rule-based scoring
# ---------------------------------------------------------------------------

def _location_climate(ctx):
    """Extract the live, source-labelled location signals used for conditioning.

    Returns a dict with the raw values (or None when unavailable) plus derived
    plain-language tags. Reads only from the real location context built by
    ``location_context.fetch_location_context`` — never hard-coded.
    """
    info = {
        "temperature": None,
        "elevation": None,
        "rainfall": None,
        "aqi": None,
        "tags": [],
    }
    ctx = ctx or {}
    blocks = ctx.get("blocks") or {}

    wx = blocks.get("weather") or {}
    if wx.get("available") and (wx.get("data") or {}).get("temperature_2m") is not None:
        info["temperature"] = wx["data"]["temperature_2m"]
    if wx.get("available") and (wx.get("data") or {}).get("precipitation") is not None:
        info["rainfall"] = wx["data"]["precipitation"]

    elev = ctx.get("elevation_m")
    if elev is None:
        ev = blocks.get("elevation") or {}
        if ev.get("available"):
            elev = (ev.get("data") or {}).get("elevation_m")
    info["elevation"] = elev

    aq = blocks.get("air_quality") or {}
    if aq.get("available") and (aq.get("data") or {}).get("aqi_us_epa") is not None:
        info["aqi"] = aq["data"]["aqi_us_epa"]

    if info["temperature"] is not None:
        t = info["temperature"]
        if t < 5:
            info["tags"].append("frosty")
        elif t < 15:
            info["tags"].append("cold")
        elif t < 30:
            info["tags"].append("warm")
        else:
            info["tags"].append("hot")
    if info["elevation"] is not None:
        e = info["elevation"]
        if e >= 2000:
            info["tags"].append("montane")
        elif e >= 800:
            info["tags"].append("highland")
        else:
            info["tags"].append("lowland")
    if info["rainfall"] is not None and info["rainfall"] < 0.5:
        info["tags"].append("dry")

    return info


def score_species(species, ctx, goal):
    """Return an integer score plus the plain-language reasons behind it.

    The score is a transparent rubric: objective match (up to 3), native bias
    (1), location-climate match (up to 2), frost hardiness (1), elevation range
    (1), low-rainfall preference (1) and AQI tolerance (2). Location signals
    come from the live context, so rankings legitimately differ by place.
    """
    if isinstance(ctx, str):
        try:
            import json as _json
            ctx = _json.loads(ctx)
        except (ValueError, TypeError):
            ctx = {}
    score = 0
    reasons = []
    clim = _location_climate(ctx)

    if goal == "shade":
        if (species["canopy_spread_m"][1] or 0) >= 12:
            score += 3
            reasons.append("large canopy")
        elif (species["canopy_spread_m"][1] or 0) >= 8:
            score += 1
            reasons.append("medium canopy")
    elif goal == "fast":
        if species["growth_rate"] in ("fast", "very fast"):
            score += 3
            reasons.append("fast growth")
    elif goal == "pollution":
        if species["pollution_tolerance"] == "high":
            score += 3
            reasons.append("high pollution tolerance")
        elif species["pollution_tolerance"] == "medium":
            score += 1
            reasons.append("moderate pollution tolerance")
    elif goal == "biodiversity":
        if any("bird" in b for b in species["benefits"]):
            score += 2
            reasons.append("supports birds")
        if species["status"] == "native":
            score += 2
            reasons.append("native")

    # Native bias (default for municipal planting).
    if species["status"] == "native":
        score += 1
        if not reasons or "native" not in reasons:
            reasons.append("native")

    # Location-climate match (stable elevation signal + live temperature).
    cold_climate = any(tag in ("frosty", "cold", "montane") for tag in clim["tags"])
    warm_climate = any(tag in ("warm", "hot") for tag in clim["tags"])
    if cold_climate:
        if any(c in ("cold", "montane", "temperate") for c in species["climate"]):
            score += 2
            reasons.append("suits cold / montane climate")
        if species["frost_tolerance"] == "hardy":
            score += 1
            reasons.append("frost hardy")
    elif warm_climate:
        if any(c in ("tropical", "subtropical") for c in species["climate"]):
            score += 1
            reasons.append("suits warm climate")

    # Elevation range match.
    if clim["elevation"] is not None:
        lo, hi = species.get("elevation_range_m") or (0, 3000)
        if lo <= clim["elevation"] <= hi:
            score += 1
            reasons.append(
                "within elevation range {}–{} m (location {} m)".format(
                    lo, hi, round(clim["elevation"])
                )
            )

    # Contextual: high measured AQI → reward pollution tolerance.
    if clim["aqi"] is not None and clim["aqi"] > 100:
        if species["pollution_tolerance"] == "high":
            score += 2
            if "pollution tolerant" not in reasons:
                reasons.append("high tolerance to elevated local AQI")

    # Contextual: currently dry → reward low water requirement.
    if "dry" in clim["tags"] and species["rainfall_preference"] == "low":
        score += 1
        reasons.append("low water need in currently dry conditions")

    return score, reasons


def recommend_species(ctx=None, scene=None, goal="shade", top_n=4):
    """Return a ranked shortlist with reasons. Pure rule-based heuristic."""
    seen = set()
    ranked = []
    for s in SPECIES:
        if s["id"] in seen:
            continue
        seen.add(s["id"])
        score, reasons = score_species(s, ctx, goal)
        ranked.append((score, s, reasons))
    ranked.sort(key=lambda x: (x[0], x[1]["growth_rate"] in ("fast", "very fast")), reverse=True)
    shortlist = ranked[:top_n]
    out = []
    for score, s, reasons in shortlist:
        # GreenVision suitability score (0-100): an ABSOLUTE rubric rank
        # (raw rule score / max achievable rule score), never normalised to
        # force the top species to 100. It is a PLANNING RANKING, not a
        # scientific measurement — the frontend must label it as such.
        suitability_score = max(0, min(100, round(score / MAX_RULE_SCORE * 100)))
        out.append({
            "id": s["id"],
            "common_name": s["common_name"],
            "scientific_name": s["scientific_name"],
            "family": s["family"],
            "status": s["status"],
            "height_m": s["height_m"],
            "canopy_spread_m": s["canopy_spread_m"],
            "growth_rate": s["growth_rate"],
            "evergreen": s["evergreen"],
            "water_requirement": s["water_requirement"],
            "sun_requirement": s["sun_requirement"],
            "pollution_tolerance": s["pollution_tolerance"],
            "climate": s.get("climate", []),
            "frost_tolerance": s.get("frost_tolerance", "unknown"),
            "rainfall_preference": s.get("rainfall_preference", "medium"),
            "elevation_range_m": s.get("elevation_range_m", [0, 3000]),
            "benefits": s["benefits"],
            "best_for": s["best_for"],
            "spacing_m": s["spacing_m"],
            "notes": s["notes"],
            "score": score,
            "suitability_score": suitability_score,
            "suitability_label": (
                "GreenVision rule-based planning ranking for the selected objective; "
                "not a scientific species-suitability measurement."
            ),
            "reasons": reasons,
            "source": s["source"],
        })
    return out


# ---------------------------------------------------------------------------
# Full recommendation (WHERE + WHY + WHAT + HOW MANY)
# ---------------------------------------------------------------------------

def build_plant_recommendation(scene=None, ctx=None, goal="shade", location_name=None):
    scene = scene or {}
    if isinstance(ctx, str):
        try:
            import json as _json
            ctx = _json.loads(ctx)
        except (ValueError, TypeError):
            ctx = {}
    gc = scene.get("green_cover_percentage")
    if gc is None:
        gc = scene.get("canopy_percentage")
    priority = scene.get("plantation_priority")
    if priority in (None, "Not Assessed"):
        priority = None

    target = compute_planting_target(scene)
    species = recommend_species(ctx=ctx, scene=scene, goal=goal)
    warning = scene.get("vegetation_warning")

    # Planning-level intervention budget from the trees-needed projection.
    budget = estimate_budget(
        (target or {}).get("trees_needed", 0) or 0,
        years=1,
    )
    if not (target or {}).get("computable"):
        budget = {
            "available": False,
            "reason": (
                "Budget estimate unavailable \u2014 a planting target must be "
                "computed from an analyzed scene first."
            ),
            "disclosure": "Planning estimate \u2014 actual costs vary by municipality, species, procurement, labour and maintenance contracts.",
        }

    # WHY — grounded in the measured canopy gap.
    if gc is None:
        why = ("No measured canopy cover is available for this scene, so a "
               "canopy-target gap cannot be quantified. Upload an analyzed "
               "scene to get a grounded planting target.")
    elif warning:
        why = (f"The scene measures {gc}% canopy but this estimate is flagged "
               f"low-reliability ({warning}) — target the stated planting "
               f"number only after ground verification.")
    elif gc >= TARGET_GREEN_COVER:
        why = f"The scene already reaches {gc}% canopy, meeting the {TARGET_GREEN_COVER:.0f}% target."
    else:
        why = (f"The scene is at {gc}% canopy — {TARGET_GREEN_COVER - gc:.0f} "
               f"points below the {TARGET_GREEN_COVER:.0f}% target.")

    # WHERE — scene-level priority; zones arrive in a later phase.
    where = {
        "scope": "analyzed scene",
        "location": location_name,
        "plantation_priority": priority or "Not assessed",
    }

    # SOIL honesty — only assert when real soil data is available.
    soil = (ctx or {}).get("blocks", {}).get("soil") if ctx else None
    soil_available = bool(soil and soil.get("available"))
    soil_note = (
        f"Live soil moisture at this location: "
        f"0-7cm {soil['data'].get('soil_moisture_0_to_7cm')} "
        f"{soil['data'].get('units', {}).get('soil_moisture_0_to_7cm', '')} "
        f"(source: Open-Meteo). Species choice should still be checked against "
        f"local soil texture and a site-level soil test."
        if soil_available else
        "Soil data is not available at this time. Verify local soil type and "
        "drainage before choosing species — species attributes above are "
        "planning references, not a soil guarantee."
    )

    # Narrative summary.
    if target.get("computable"):
        how_many = f"About {target['trees_needed']:,} additional trees are estimated to reach the {TARGET_GREEN_COVER:.0f}% canopy target."
        if target.get("indicative_only"):
            how_many += " (indicative — verify on the ground.)"
    else:
        how_many = "A planting target cannot be computed until an analyzed scene provides canopy and tree measurements."

    top_species = ", ".join(s["common_name"] for s in species[:3])
    narrative = (
        f"{why} {how_many} Suggested starting palette: {top_species} "
        f"(ranked by a transparent rule-based heuristic for the "
        f"'{goal}' objective)."
    )

    # Location factors — the live signals that conditioned the ranking.
    clim = _location_climate(ctx)
    location_factors = {
        "temperature_c": clim["temperature"],
        "elevation_m": clim["elevation"],
        "rainfall_mm_now": clim["rainfall"],
        "aqi_us_epa": clim["aqi"],
        "tags": clim["tags"],
        "conditioned": any(tag in ("frosty", "cold", "montane", "warm", "hot") for tag in clim["tags"]),
        "disclosure": (
            "Species ranking was conditioned on this location's live context "
            "(elevation, current temperature, rainfall, AQI). It is a planning "
            "heuristic based on current observed conditions — verify "
            "winter-hardiness against local climate normals before procurement."
            if any(tag in ("frosty", "cold", "montane", "warm", "hot") for tag in clim["tags"]) else
            "No live location signals were available for species conditioning — "
            "ranking uses the objective + native-bias rubric only."
        ),
    }

    return {
        "location": {
            "name": location_name,
            "latitude": (ctx or {}).get("latitude"),
            "longitude": (ctx or {}).get("longitude"),
        },
        "where": where,
        "why": why,
        "how_many": how_many,
        "target": target,
        "budget": budget,
        "species": species,
        "soil": {"available": soil_available, "note": soil_note},
        "location_factors": location_factors,
        "recommendation": narrative,
        "disclosures": [
            "Species attributes are planning references from published sources, not site measurements.",
            "Trees-needed is an arithmetic projection assuming canopy density is maintained (canopy m² per tree stays at the scene's current measured value).",
        ],
        "objective": goal,
    }
