"""
GreenVision.AI — Flask API Backend
==================================

Serves the React frontend and wraps the Tree_AI_Backend neural pipeline
(scene classification -> YOLO tree detection -> carbon/oxygen estimation).

Endpoints
---------
GET  /                        Health + route index
GET  /api/health              Health check (engine availability)
POST /api/analyze             Upload an image (multipart field: "image") -> full analysis report
POST /api/climate/simulate    Tree-count -> carbon/oxygen/offset (real estimator math)
POST /api/advisor/ask         Rule-based ClimateGPT assistant grounded in the current report
POST /api/location/context    lat/lng -> Open-Meteo weather, elevation, air quality, soil (30-min cache)
POST /api/location/geocode    place name -> Open-Meteo geocoding results (search box)
POST /api/plant/recommend     lat/lng + scene -> species shortlist + trees-to-60% planting target
POST /api/contributions       Create a Green Contribution record (action, date, location, photo later)
GET  /api/contributions       List Green Contributions (newest first)
GET  /api/contributions/<id>  Fetch one contribution
POST /api/contributions/<id>/evidence   Upload photo evidence (no AI verification)
GET  /api/contributions/<id>/evidence   Serve the evidence photo
GET  /api/leaderboard         GREEN CHAMPIONS top-100 + your position
GET  /api/reports             List saved analysis reports
GET  /api/reports/<id>        Fetch one report
GET  /api/reports/<id>/download   Download one report as JSON
"""

import json
import os
import re
import sys
import time
import uuid
import logging
import numpy as np
from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_file, url_for
from flask_cors import CORS

try:
    from PIL import Image as PILImage
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

try:
    import pymupdf as fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

from location_context import fetch_location_context, geocode_places
from species_data import build_plant_recommendation, SPECIES, score_species, MAX_RULE_SCORE, _BY_ID
from budget_model import estimate_budget
from contributions import (
    ACTIONS,
    ensure_seeded,
    get_contribution,
    list_contributions,
    save_contribution,
    attach_evidence,
    evidence_path,
    leaderboard,
    position_of,
    org_leaderboard,
    POINTS_DISCLAIMER,
    ALLOWED_EVIDENCE_EXTENSIONS,
    MAX_EVIDENCE_MB,
)

# ---------------------------------------------------------------------------
# Tree_AI_Backend bootstrap
#
# pipeline.py / router.py use flat imports ("from config import ..."),
# so the AI_Engine directory itself must be on sys.path.
# ---------------------------------------------------------------------------

SERVER_DIR = Path(__file__).resolve().parent
REPO_ROOT = SERVER_DIR.parent

AI_ENGINE_DIR = None
for candidate in (
    REPO_ROOT / "Tree_AI_Backend" / "AI_Engine",
    SERVER_DIR / "Tree_AI_Backend" / "AI_Engine",
    SERVER_DIR / "AI_Engine",
):
    if (candidate / "pipeline.py").exists():
        AI_ENGINE_DIR = candidate
        break

if AI_ENGINE_DIR is not None and str(AI_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE_DIR))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "50"))
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "tif", "tiff"}

DATA_DIR = SERVER_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
REPORTS_DIR = DATA_DIR / "reports"
OVERLAY_DIR = DATA_DIR / "overlays"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
OVERLAY_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("greenvision")


def _create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
    # CORS: wildcard "*" is DEMO-ONLY so localhost:5173 -> localhost:5000 just
    # works out of the box. For a real deployment set CORS_ORIGINS to a
    # comma-separated allow-list, e.g. "https://greenvision.example.com".
    _origins = os.environ.get("CORS_ORIGINS", "*")
    cors_origins = (
        "*"
        if _origins.strip() == "*"
        else [o.strip() for o in _origins.split(",") if o.strip()]
    )
    CORS(app, resources={r"/api/*": {"origins": cors_origins}}, supports_credentials=False)
    return app


def _generate_heatmap(mask, scene_id):
    """Generate a vegetation heatmap PNG from a binary mask.

    Green = vegetation, dark = non-vegetation.  Returns the filename
    of the saved PNG inside OVERLAY_DIR, or None on failure.
    """
    if mask is None or not _PIL_AVAILABLE:
        return None
    try:
        h, w = mask.shape[:2]
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        veg = mask.astype(bool)
        rgba[veg] = [34, 197, 94, 160]     # green, semi-transparent
        rgba[~veg] = [15, 23, 42, 80]      # dark slate, very faint

        img = PILImage.fromarray(rgba, "RGBA")
        fname = f"{scene_id}.png"
        img.save(OVERLAY_DIR / fname, "PNG")
        return fname
    except Exception:
        logger.exception("Heatmap generation failed")
        return None


app = _create_app()

# ---------------------------------------------------------------------------
# Lazy pipeline singleton (model loading happens on first analyze request)
# ---------------------------------------------------------------------------

_pipeline = None


def get_pipeline():
    global _pipeline
    if AI_ENGINE_DIR is None:
        raise RuntimeError(
            "Tree_AI_Backend AI_Engine not found. Make sure the "
            "Tree_AI_Backend folder sits next to the server folder."
        )
    if _pipeline is None:
        from pipeline import TreeAIPipeline

        logger.info("Loading TreeAI pipeline (scene classifier + models)...")
        _pipeline = TreeAIPipeline()
        logger.info("TreeAI pipeline ready.")
    return _pipeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def allowed_file(name: str) -> bool:
    if not name:
        return False
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return ext in ALLOWED_EXTENSIONS


def make_scene_id() -> str:
    return f"GV-2026-{uuid.uuid4().hex[:8].upper()}"


def _load_estimators():
    """Return the carbon/oxygen/offset estimator functions.

    The Climate simulator performs pure estimator arithmetic (22 kg CO2 and
    118 kg O2 per tree per year) and must keep working even when the ML
    inference engine is unavailable (AI_ENGINE_DIR is None). Prefer the real
    estimators from Tree_AI_Backend when they import cleanly; otherwise fall
    back to identical local arithmetic so the endpoint never 500s.
    """
    try:
        from estimators.carbon import calculate_carbon
        from estimators.oxygen import calculate_oxygen
        from estimators.carbon_offset import calculate_carbon_offset
        return calculate_carbon, calculate_oxygen, calculate_carbon_offset
    except ImportError:
        pass

    def _carbon(tree_count):
        carbon = tree_count["estimated_trees"] * 22
        return {
            "carbon_kg_per_year": round(carbon, 2),
            "carbon_tonnes_per_year": round(carbon / 1000, 2),
        }

    def _oxygen(tree_count):
        oxygen = tree_count["estimated_trees"] * 118
        return {
            "oxygen_kg_per_year": round(oxygen, 2),
            "oxygen_tonnes_per_year": round(oxygen / 1000, 2),
        }

    def _offset(carbon_tonnes_per_year, co2_per_person=4.7):
        return {
            "carbon_offset_tonnes_per_year": round(carbon_tonnes_per_year, 2),
            "assumed_co2_per_person_tonnes_per_year": round(co2_per_person, 2),
            "equivalent_people_offset": round(carbon_tonnes_per_year / co2_per_person, 2),
        }

    return _carbon, _oxygen, _offset


def _dms_to_dec(value):
    try:
        d = float(value[0][0]) / float(value[0][1])
        m = float(value[1][0]) / float(value[1][1])
        s = float(value[2][0]) / float(value[2][1])
        return d + m / 60.0 + s / 3600.0
    except Exception:
        return None


def parse_gps(gps_data):
    """Convert a raw GPS object to {lat, lng} decimal degrees.

    Accepts either a PIL EXIF GPS dict (GPSLatitude/GPSLongitude + refs)
    or a pre-computed {"lat": .., "lng": ..} from GeoTIFF georeferencing.
    """
    if not gps_data:
        return None
    if isinstance(gps_data, dict) and "lat" in gps_data and "lng" in gps_data:
        lat = gps_data.get("lat")
        lng = gps_data.get("lng")
        if lat is None or lng is None:
            return None
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return None
        return {"lat": round(float(lat), 6), "lng": round(float(lng), 6)}
    lat = _dms_to_dec(gps_data.get("GPSLatitude"))
    lng = _dms_to_dec(gps_data.get("GPSLongitude"))
    if lat is None or lng is None:
        return None
    if str(gps_data.get("GPSLatitudeRef", "N")).upper().startswith("S"):
        lat = -lat
    if str(gps_data.get("GPSLongitudeRef", "E")).upper().startswith("W"):
        lng = -lng
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return None
    return {"lat": round(lat, 6), "lng": round(lng, 6)}


def read_image_metadata(image_path):
    try:
        from utils.metadata import extract_metadata

        meta = extract_metadata(image_path)
        gps = parse_gps(meta.get("gps_data"))
        return {
            "camera_make": meta.get("camera_make"),
            "camera_model": meta.get("camera_model"),
            "capture_datetime": meta.get("capture_datetime"),
            "metadata_available": bool(meta.get("metadata_available")),
            "warning": meta.get("warning"),
            "gps": gps,
            "georef": {
                "source": "geotiff" if (meta.get("raster_geo") and gps) else None,
                "crs_epsg": meta.get("crs_epsg"),
                "coords": meta.get("raster_geo"),
                "warning": meta.get("georef_warning"),
            },
            "scale": {
                "available": bool(meta.get("scale_available")),
                "meters_per_pixel": meta.get("meters_per_pixel"),
                "approximation": bool(meta.get("scale_approximation")),
            },
        }
    except Exception as exc:  # metadata is best-effort
        logger.warning("metadata extraction failed: %s", exc)
        return {"camera_make": None, "camera_model": None,
                "capture_datetime": None, "metadata_available": False,
                "warning": str(exc), "gps": None,
                "georef": {"source": None, "crs_epsg": None,
                           "coords": None, "warning": str(exc)},
                "scale": {"available": False, "meters_per_pixel": None}}


def build_result(report, image_path, image_name):
    scene_id = make_scene_id()
    metadata = read_image_metadata(image_path)
    result = {
        "id": scene_id,
        "scene_id": scene_id,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "image_name": image_name,
        "gps": metadata.get("gps"),
        "metadata": metadata,
    }
    result.update(report)
    return result


def save_report(result) -> Path:
    path = REPORTS_DIR / f"{result['id']}.json"
    path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    return path


def _error(message, status):
    return jsonify({"error": message}), status


def _no_engine():
    return _error(
        "Tree_AI_Backend AI_Engine is not available on this server. "
        "Ensure the Tree_AI_Backend directory is present.",
        503,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return jsonify({
        "status": "ok",
        "service": "greenvision-ai backend",
        "endpoints": {
            "health": url_for("health"),
            "analyze": url_for("analyze"),
            "climate_simulate": url_for("climate_simulate"),
            "advisor_ask": url_for("advisor_ask"),
            "location_context": url_for("location_context"),
            "location_geocode": url_for("location_geocode"),
            "plant_recommend": url_for("plant_recommend"),
            "reports": url_for("list_reports"),
        },
        "engine_available": AI_ENGINE_DIR is not None,
    })


@app.get("/api/health")
def health():
    engine_ok = AI_ENGINE_DIR is not None
    pipeline_ready = _pipeline is not None
    return jsonify({
        "status": "ok",
        "service": "greenvision-ai backend",
        "engine_available": engine_ok,
        "pipeline_loaded": pipeline_ready,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    })


@app.post("/api/analyze")
def analyze():
    if AI_ENGINE_DIR is None:
        return _no_engine()

    if "image" not in request.files:
        return _error("No image file provided. Upload with field name 'image'.", 400)

    uploaded = request.files["image"]

    if not uploaded.filename:
        return _error("Empty filename.", 400)

    if not allowed_file(uploaded.filename):
        ext = uploaded.filename.rsplit(".", 1)[-1].lower() if "." in uploaded.filename else ""
        return _error(
            f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
            400,
        )

    original_name = uploaded.filename
    safe_name = f"{uuid.uuid4().hex}.{original_name.rsplit('.', 1)[-1].lower()}"
    saved_path = UPLOAD_DIR / safe_name

    try:
        uploaded.save(saved_path)
    except Exception as exc:
        logger.exception("Failed to save upload")
        return _error(f"Could not store the uploaded file: {exc}", 500)

    try:
        report = get_pipeline().process_image(str(saved_path))
        veg_mask = report.pop("_veg_mask", None)
        result = build_result(report, saved_path, original_name)
        heatmap_fname = _generate_heatmap(veg_mask, result["scene_id"])
        if heatmap_fname:
            result["heatmap_url"] = f"/api/heatmaps/{heatmap_fname}"
    except ValueError as exc:
        return _error(f"Invalid image for analysis: {exc}", 422)
    except RuntimeError as exc:
        import traceback
        logger.exception("Model inference runtime error: %s\n%s", exc, traceback.format_exc())
        return _error(f"Model inference error: {exc}", 500)
    except Exception as exc:
        logger.exception("Analysis pipeline failed")
        return _error(f"AI analysis failed: {exc}", 500)
    finally:
        try:
            saved_path.unlink(missing_ok=True)  # clean up after processing
        except OSError:
            pass

    save_report(result)

    return jsonify(result)


@app.post("/api/climate/simulate")
def climate_simulate():
    # NOTE: this endpoint intentionally does NOT gate on AI_ENGINE_DIR. It is
    # pure estimator arithmetic (22 kg CO2 / 118 kg O2 per tree per year) and
    # must work even when the ML inference engine is unavailable. Temperature
    # / AQI stay explicitly "not modeled" — nothing is fabricated. The budget
    # is a planning ESTIMATE from configurable assumptions (budget_model.py).

    body = request.get_json(silent=True) or {}
    raw = body.get("treeCount", 0)
    try:
        tree_count = max(0, int(raw))
    except (TypeError, ValueError):
        return _error("treeCount must be a non-negative integer.", 400)

    calculate_carbon, calculate_oxygen, calculate_carbon_offset = _load_estimators()

    trees = {"estimated_trees": tree_count}
    carbon = calculate_carbon(trees)
    oxygen = calculate_oxygen(trees)
    offset = calculate_carbon_offset(carbon["carbon_tonnes_per_year"])

    # ------------------------------------------------------------------
    # Scene-aware simulation baseline (optional).
    #
    # When the frontend passes the current analyzed scene, the response
    # projects onto that baseline (current trees / canopy / area / carbon
    # / oxygen). Without a baseline it behaves as a standalone calculator.
    # ------------------------------------------------------------------

    baseline = body.get("baseline") or {}

    baseline_trees = baseline.get("estimated_trees")
    canopy_pct = baseline.get("canopy_percentage")
    forest_m2 = baseline.get("forest_area_m2")

    has_baseline = (
        baseline_trees is not None
        or canopy_pct is not None
        or forest_m2 is not None
    )

    additional = {
        "carbon_tonnes_per_year": round(tree_count * 22 / 1000, 2),
        "oxygen_tonnes_per_year": round(tree_count * 118 / 1000, 2),
        "equivalent_people_offset": round(
            (tree_count * 22 / 1000) / 4.7, 2
        ),
    }

    projected = {
        "trees": tree_count,
        "canopy_percentage": None,
    }

    canopy = {
        "modeled": False,
        "method": None,
        "assumption": None,
        "reason": (
            "Projected canopy requires a measured baseline canopy area and "
            "tree count. Analyze a scene first, then re-run the simulation."
        ),
    }

    recommendation = None

    if has_baseline:
        base_trees = baseline_trees if baseline_trees is not None else 0
        projected_total_trees = base_trees + tree_count
        projected["trees"] = projected_total_trees
        projected["carbon_tonnes_per_year"] = round(
            projected_total_trees * 22 / 1000, 2
        )
        projected["oxygen_tonnes_per_year"] = round(
            projected_total_trees * 118 / 1000, 2
        )
        projected["additional_carbon_tonnes_per_year"] = additional[
            "carbon_tonnes_per_year"
        ]
        projected["additional_oxygen_tonnes_per_year"] = additional[
            "oxygen_tonnes_per_year"
        ]

        # ------------------------------------------------------------------
        # Defensible canopy projection.
        #
        # Only modeled when the baseline has BOTH a measured canopy area and
        # a measured tree count. Each planted tree is assumed to add canopy
        # area equal to the scene's current measured canopy area per tree
        # (i.e. canopy density is maintained). This assumption is returned
        # alongside the number so the UI / report can disclose it.
        # ------------------------------------------------------------------

        if (
            canopy_pct is not None
            and canopy_pct > 0
            and forest_m2 is not None
            and forest_m2 > 0
            and base_trees is not None
            and base_trees > 0
        ):
            canopy_m2_per_tree = forest_m2 / base_trees
            scene_total_m2 = forest_m2 / (canopy_pct / 100.0)
            projected_canopy_m2 = forest_m2 + tree_count * canopy_m2_per_tree
            projected_pct = min(
                100.0,
                projected_canopy_m2 / scene_total_m2 * 100.0
            )

            canopy = {
                "modeled": True,
                "method": "scene canopy density maintained",
                "canopy_m2_per_tree": round(canopy_m2_per_tree, 2),
                "current_canopy_m2": round(forest_m2, 2),
                "scene_total_m2": round(scene_total_m2, 2),
                "projected_canopy_m2": round(projected_canopy_m2, 2),
                "projected_canopy_percentage": round(projected_pct, 2),
                "assumption": (
                    "Each planted tree is assumed to add canopy area equal to "
                    "the scene's current measured canopy area per tree (canopy "
                    "density maintained). This is an explicit assumption for "
                    "planning purposes, not a measured value."
                ),
            }
            projected["canopy_percentage"] = canopy[
                "projected_canopy_percentage"
            ]
        else:
            canopy = {
                "modeled": False,
                "method": None,
                "assumption": None,
                "reason": (
                    "Cannot project canopy from tree count alone: this scene "
                    "has no measured baseline canopy to scale from."
                ),
            }

        # ------------------------------------------------------------------
        # Recommendation grounded in the analyzed scene's own priority.
        #
        # Skipped when the scene's vegetation estimate is flagged
        # low-reliability (street/urban over-detection): we must not assert
        # "meets target" from an unreliable canopy figure.
        # ------------------------------------------------------------------

        target = 60.0
        if baseline.get("vegetation_warning"):
            recommendation = None
        elif canopy_pct is not None:
            if canopy_pct < target:
                recommendation = (
                    f"Plantation intervention is potentially beneficial because "
                    f"the analyzed scene has below-target canopy cover "
                    f"({canopy_pct}% vs the {target}% target)."
                )
            else:
                recommendation = (
                    f"The analyzed scene already meets the {target}% canopy "
                    f"target ({canopy_pct}%); additional planting has limited "
                    f"marginal benefit based on current data."
                )
        elif baseline.get("plantation_priority") == "High":
            recommendation = (
                "Plantation intervention is potentially beneficial because the "
                "analyzed scene is flagged High plantation priority."
            )
        elif baseline.get("plantation_priority") == "Medium":
            recommendation = (
                "Plantation may improve this scene's green cover (flagged "
                "Medium plantation priority)."
            )

    return jsonify({
        "treeCount": tree_count,
        "carbon": carbon,
        "oxygen": oxygen,
        "carbonOffset": offset,
        "budget": estimate_budget(tree_count, years=int(body.get("maintenanceYears", 1))),
        "baseline_applied": has_baseline,
        "additional": additional,
        "projected": projected,
        "canopy": canopy,
        "temperature": {
            "modeled": False,
            "reason": (
                "Temperature reduction is not modeled. It depends on baseline "
                "temperature, local climate, humidity, wind and solar exposure, "
                "which this pipeline does not measure. The endpoint is designed "
                "so a future thermal model can plug in without UI changes."
            ),
        },
        "aqi": {
            "modeled": False,
            "reason": (
                "Air-quality impact is not modeled. No air-quality model or "
                "data source is available in this pipeline."
            ),
        },
        "recommendation": recommendation,
        "formulas": {
            "co2_per_tree_kg_per_year": 22.0,
            "o2_per_tree_kg_per_year": 118.0,
            "co2_per_person_tonnes_per_year": 4.7,
        },
    })


# ---------------------------------------------------------------------------
# ClimateGPT — contextual rule-based assistant
# ---------------------------------------------------------------------------

def advisor_reply(message: str, context: dict) -> tuple:
    """Return (reply, intent). Grounded in the real analysis report context.

    The frontend may attach two extra keys to ``context``:
      * ``_plantCtx`` — the live Open-Meteo location context (weather / AQI /
        soil) so species answers are grounded in the actual place.
      * ``_mode``    — "municipal", "industrial" or "citizen", to tailor framing.
      * ``_userName`` — the user's display name for personalised greetings.
      * ``_last_intent`` — intent of the most recent bot reply (from history).
      * ``_last_species_id`` — id of the last species mentioned by the bot.
      * ``_last_cost`` — last tree count used in a cost query (from history).
    """
    q = message.lower().strip()
    context = context or {}
    warning = context.get("vegetation_warning")
    mode = context.get("_mode") or "citizen"
    user_name = (context.get("_userName") or "").strip()
    plant_ctx = context.get("_plantCtx") or {}
    if isinstance(plant_ctx, str):
        try:
            plant_ctx = json.loads(plant_ctx)
        except (ValueError, TypeError):
            plant_ctx = {}

    # Canonical location name for location-aware responses
    _loc_name = (
        plant_ctx.get("name")
        or context.get("_userLocation", {}).get("name")
        or context.get("location_name")
        or ""
    )
    _loc_hint = f" for {_loc_name}" if _loc_name else ""
    _name_part = f", {user_name}" if user_name else ""
    _greeting_name = f" {user_name}" if user_name else ""

    # ------------------------------------------------------------------
    # Greetings & general conversation — conversational like ChatGPT.
    # ------------------------------------------------------------------
    greeting_pat = re.match(
        r"^(hi|hello|hey|howdy|hola|yo|sup|what'?s up|namaste|good (morning|afternoon|evening)|hii+|heyy+|hiii)\b",
        q,
    )
    if greeting_pat or q in ("", "hii", "hi", "hello", "hey"):
        loc_name = plant_ctx.get("name") or context.get("location_name") or ""
        loc_part = f" in {loc_name}" if loc_name else ""
        if mode == "citizen":
            return (
                f"Hey{_greeting_name}! I'm GreenVision, your environmental advisor.{loc_part} "
                f"I can help you figure out what trees to plant, how much it would cost, "
                f"what one tree does for the environment, and more. "
                f"Just ask me anything — like 'What should I plant here?' or "
                f"'How much would 50 trees cost?'",
                "greeting",
            )
        if mode == "industrial":
            return (
                f"Hello{_greeting_name}! I'm the GreenVision Industrial Advisor. I can help you plan "
                f"a green buffer around this site{loc_part} — suitable species, planting "
                f"quantity, estimated investment, and calculated CO\u2082/O\u2082 contribution. "
                f"Note: GreenVision does not model pollution reduction. "
                f"Ask me something like 'What should we plant around this factory?'",
                "greeting",
            )
        return (
            f"Hello{_greeting_name}! I'm the GreenVision Command Advisor. I can read the current "
            f"analyzed scene{loc_part} and its live location context to answer "
            f"questions about canopy, tree count, carbon/oxygen, plantation priority, "
            f"species, and trees needed. Try 'How many trees are needed?' or "
            f"'What is the plantation recommendation?'",
            "greeting",
        )

    thanks_pat = re.match(r"^(thanks?|thank you|thx|ty|cheers|tysm)\b", q)
    if thanks_pat:
        return (
            "You're welcome! Feel free to ask me anything else about trees, planting, "
            "costs, or your local environment.",
            "thanks",
        )

    how_are_you = re.match(r"^(how (are you|r u)|what'?s up|how'?s it going|how do you do)\b", q)
    if how_are_you:
        return (
            "I'm doing great, thanks for asking! I'm ready to help you plan greener "
            "spaces. You can ask me about species recommendations, planting costs, "
            "environmental context, or anything related to urban greenery.",
            "smalltalk",
        )

    what_are_you = re.match(r"^(who are you|what are you|what do you do|what can you do|help|options|commands)\b", q)
    if what_are_you:
        if mode == "citizen":
            return (
                "I'm GreenVision — an AI-powered green planning assistant. Here's what I can do:\n"
                "• Recommend the best trees for your area based on live weather, air quality, and soil\n"
                "• Tell you how much it would cost to plant any number of trees\n"
                "• Explain why a particular species was recommended\n"
                "• Compare water needs of different trees\n"
                "• Tell you what one tree does for the environment (22 kg CO\u2082, 118 kg O\u2082 per year)\n"
                "• Help you plan a green space\n\n"
                "Just type your question naturally!",
                "help",
            )
        return (
            "I'm GreenVision — an AI-powered environmental planning assistant. I can help with:\n"
            "• Species recommendations ranked by local context\n"
            "• Planting targets (how many trees to reach 60% canopy)\n"
            "• Budget estimates for any number of trees\n"
            "• Carbon sequestration and oxygen production estimates\n"
            "• Environmental context (weather, elevation, air quality)\n\n"
            "Just ask me anything!",
            "help",
        )

    if re.match(r"^(bye|goodbye|see you|gtg|gotta go|cya|good night)\b", q):
        return (
            "Goodbye! Happy planting. Come back anytime you need green planning help!",
            "farewell",
        )

    def caveat():
        return (
            f" Note: this figure is indicative only — {warning}"
            if warning else ""
        )

    def num(*keys):
        for k in keys:
            v = context.get(k)
            if v is not None:
                return v
        return None

    trees = num("estimated_trees")
    green = num("green_cover_percentage", "canopy_percentage")
    carbon = num("carbon_tonnes_per_year")
    oxygen = num("oxygen_tonnes_per_year")
    density = context.get("density_class")
    score = num("density_score")
    scene = context.get("scene")
    conf = num("scene_confidence")
    area_ha = num("forest_area_hectares")
    priority = context.get("plantation_priority")
    rec = context.get("plantation_recommendation")
    summary = context.get("summary")
    people = num("equivalent_people_offset")

    if not trees and not green and not carbon:
        if not plant_ctx:
            pass
        # Location-only grounding: species / how-many answers stay valid even
        # without an analyzed scene; scene-specific intents report UNAVAILABLE.

    # ------------------------------------------------------------------
    # Thermal / AQI impact — explicit "no validated model" answer.
    # GreenVision has NO validated thermal or air-quality impact model, so
    # quantitative predictions ("how many degrees cooler" / "how many AQI
    # points") must be refused explicitly instead of pivoting to an unrelated
    # answer or fabricating a figure.
    # ------------------------------------------------------------------
    thermal_ask = re.search(
        r"\b(cooling effect|heat island|temperature (drop|reduction|reduce|"
        r"lower|decrease)|reduce (the )?temperature|lower (the )?temperature|"
        r"degrees cooler|cooler by|temperature by)\b",
        q,
    )
    aqi_ask = (
        re.search(
            r"\b(aqi|air quality|air pollution|pollutants?|pm2\.5|pm10)\b.*\b"
            r"(reduc\w*|lower\w*|improve\w*|drop\w*|points|percent|by \d+|"
            r"how much|effect|impact|gain)\b",
            q,
        )
        or re.search(
            r"\b(reduc\w*|lower\w*|improve\w*|drop\w*)\b.*\b(aqi|air quality|"
            r"air pollution|pollutants?|pm2\.5|pm10)\b",
            q,
        )
    )
    if thermal_ask or aqi_ask:
        return (
            "GreenVision does not currently have a validated thermal or "
            "air-quality impact model for this location, so it cannot "
            "responsibly predict that value yet — no degree-cooling or AQI-"
            "point figure is available. The analyzed scene does provide "
            "measured canopy cover and tree counts (see the report), and the "
            "planting engine ranks species by planning attributes such as "
            "pollution tolerance as a heuristic — not as a quantified AQI "
            "improvement.",
            "impact_unavailable",
        )

    # ------------------------------------------------------------------
    # Cost / budget — real numbers from the budget model.
    # Placed early so queries like "How much would 100 trees cost?" are
    # caught before the generic tree-count or species patterns.
    # ------------------------------------------------------------------
    cost_match = re.search(
        r"\b(\d[\d,]*)\s*(trees?|saplings?|plants?)\b.*\b(cost|budget|price|invest|spend|pay|how much)\b"
        r"|\b(cost|budget|price|invest|spend|pay|how much)\b.*\b(\d[\d,]*)\s*(trees?|saplings?|plants?)\b",
        q,
    )
    if cost_match:
        num_str = cost_match.group(1) or cost_match.group(5) or "0"
        try:
            tree_count = int(num_str.replace(",", ""))
        except (ValueError, TypeError):
            tree_count = 0
        if tree_count <= 0:
            return (
                "Please specify a number of trees — for example 'How much would 100 trees cost?'",
                "cost_prompt",
            )
        budget = estimate_budget(tree_count, years=1)
        if budget.get("available"):
            return (
                f"Planning budget for {tree_count:,} trees:\n"
                f"  Sapling cost: {budget['line_items']['sapling_cost_inr']:,.0f} INR "
                f"({budget['assumptions']['cost_per_sapling_inr']:.0f} INR/tree)\n"
                f"  Planting labour: {budget['line_items']['planting_labour_inr']:,.0f} INR "
                f"({budget['assumptions']['planting_cost_per_tree_inr']:.0f} INR/tree)\n"
                f"  Maintenance (1 year): {budget['line_items']['maintenance_inr']:,.0f} INR\n"
                f"  Total: {budget['total_estimate_inr_formatted']}\n"
                f"Formula: {budget['formula']}\n"
                f"Disclosure: {budget['disclosure']}",
                "cost",
            )
        return (
            "Budget estimate is unavailable — cost assumptions are not configured. "
            "In a deployment, set the cost-per-sapling and planting-cost-per-tree environment variables.",
            "cost_unavailable",
        )

    # ------------------------------------------------------------------
    # Species "why" — explain why a specific species was recommended.
    # Placed before generic species guidance so "Why Neem?" is caught
    # before the broad species/planting pattern.
    # ------------------------------------------------------------------
    if re.search(r"\bwhy\b", q):
        species_name = None
        for s in SPECIES:
            if s["common_name"].lower() in q or s["id"].lower() in q or s["scientific_name"].lower() in q:
                species_name = s
                break
        if not species_name and re.search(r"\b(this tree|this species|it|that tree|that species)\b", q):
            last_species_id = context.get("_last_species_id")
            if last_species_id:
                species_name = _BY_ID.get(last_species_id)
        if species_name:
            goal = "pollution" if mode == "industrial" else "shade"
            sp_score, reasons = score_species(species_name, plant_ctx, goal)
            suitability = max(0, min(100, round(sp_score / MAX_RULE_SCORE * 100)))
            return (
                f"{species_name['common_name']} ({species_name['scientific_name']}) scored "
                f"{suitability}/100 on the GreenVision rule-based ranking. "
                f"Key factors: {'; '.join(reasons[:5]) or 'baseline score'}. "
                f"Attributes: water {species_name['water_requirement']}, "
                f"sun {species_name['sun_requirement']}, "
                f"pollution tolerance {species_name['pollution_tolerance']}, "
                f"spacing {species_name['spacing_m']} m. "
                f"Climate preference: {', '.join(species_name.get('climate', [])) or 'not specified'}. "
                f"Elevation range: {species_name.get('elevation_range_m', [0, 3000])[0]}–"
                f"{species_name.get('elevation_range_m', [0, 3000])[1]} m. "
                f"Note: this is a planning heuristic, not a scientific measurement.",
                "species_why",
            )
        return (
            "Tell me which species you'd like to understand — for example "
            "'Why Neem?' or 'Why was Pongamia recommended?' and I'll explain "
            "the scoring factors.", "species_why_prompt",
        )

    # ------------------------------------------------------------------
    # Water comparison — compare species by water requirement.
    # ------------------------------------------------------------------
    if re.search(r"\b(less water|water requirement|water need|which.*water|drought|low water)\b", q):
        pl = build_plant_recommendation(scene=context, ctx=plant_ctx, goal="shade")
        top = (pl.get("species") or [])[:4]
        if not top:
            return (
                "I don't have species ranked for the current context to compare water requirements.",
                "species_water",
            )
        water_order = {"low": 0, "medium": 1, "high": 2}
        sorted_by_water = sorted(top, key=lambda s: water_order.get(s.get("water_requirement", "medium"), 1))
        least = sorted_by_water[0]
        loc_clause = f" in your area{_loc_hint}" if _loc_name else ""
        lines = [f"Of the top-ranked species{loc_clause}:"]
        for s in sorted_by_water:
            lines.append(f"  • {s['common_name']}: water requirement = {s['water_requirement']}")
        lines.append(
            f"\n{least['common_name']} has the lowest water need ({least['water_requirement']}). "
            f"Note: water requirements are planning references — actual needs depend on local soil, "
            f"rainfall, and microclimate. Verify with local horticultural guidance."
        )
        return (" ".join(lines), "species_water")

    # ------------------------------------------------------------------
    # Industrial pollution reduction — refused (no validated dispersion model).
    # Must appear BEFORE the industrial green-buffer pattern to catch
    # "pollution reduction" queries before they fall into the buffer plan.
    # ------------------------------------------------------------------
    if mode == "industrial" and re.search(
        r"(pollution reduction|reduce.*pollution|pollution.*reduc|"
        r"air quality improvement|pollutant removal|emission reduction|"
        r"how much.*pollut|pollut.*how much)",
        q,
    ):
        return (
            "GreenVision does not currently have a validated pollutant-dispersion "
            "or air-quality impact model, so it cannot quantify pollution reduction. "
            "The industrial green-buffer plan recommends species ranked by pollution "
            "tolerance as a planning heuristic — not as a quantified air-quality "
            "improvement.",
            "impact_unavailable",
        )

    # ------------------------------------------------------------------
    # Species / planting guidance — grounded in the live location context
    # ------------------------------------------------------------------
    if re.search(
        r"\b(species|what tree|best tree|tree should|recommend a tree|"
        r"suitab\w*|how to care|care for|plant in my|plant here|what can i "
        r"plant|which tree|sapling)\b",
        q,
    ):
        goal = "pollution" if mode == "industrial" else "shade"
        if re.search(r"\b(fast|quick|rapid|cover quickly)\b", q):
            goal = "fast"
        elif re.search(r"\b(pollut|air quality|air-quality|smoke)\b", q):
            goal = "pollution"
        elif re.search(r"\b(biodivers|native|bird|wildlife|habitat)\b", q):
            goal = "biodiversity"

        pl = build_plant_recommendation(scene=context, ctx=plant_ctx, goal=goal)
        top = (pl.get("species") or [])[:3]
        if not top:
            return (
                "I could not rank species for this request — no species are "
                "available for the current objective.", "species",
            )
        audience = {
            "citizen": f"Based on your location{_loc_hint} and local conditions" if _loc_name else "For your area",
            "industrial": f"For an industrial-site green-buffer plan{_loc_hint}",
        }.get(mode, f"For municipal planting{_loc_hint}")
        lines = [f"{audience} (planning objective: {goal}), the rule-based "
                 f"species engine ranks these first:"]
        for i, s in enumerate(top, 1):
            lines.append(
                f"{i}. {s['common_name']} ({s['scientific_name']}) — "
                f"GreenVision suitability {s['suitability_score']}/100 "
                f"({', '.join(s['reasons'][:3]) or 'baseline'}); "
                f"water {s['water_requirement']}, sun {s['sun_requirement']}, "
                f"spacing {s['spacing_m']} m."
            )
        lines.append(
            f"Care: {top[0]['notes']} Full attributes and planning sources are "
            f"on the Planting Plan page."
        )
        return (" ".join(lines), "species")

    # ------------------------------------------------------------------
    # Industrial green-buffer plan (mode-aware).
    # Answer "what should this industrial site do" with a green-buffer
    # recommendation grounded in the planting target, species and budget.
    # Pollutant reduction is NEVER quantified — no validated dispersion model.
    # ------------------------------------------------------------------
    if mode == "industrial" and re.search(
        r"\b(factory|industrial|emission|green.buffer|effluent|footprint|"
        r"chimney)\b",
        q,
    ):
        pl = build_plant_recommendation(
            scene=context, ctx=plant_ctx, goal="pollution", location_name=None
        )
        top = (pl.get("species") or [])[:3]
        names = ", ".join(s["common_name"] for s in top) if top else "n/a"
        target = pl.get("target") or {}
        if target.get("computable"):
            how_many = (
                f"A green-buffer intervention around this site is estimated at "
                f"about {target['trees_needed']:,} trees to reach the "
                f"{target['target_green_cover']:.0f}% canopy target for the "
                f"analyzed scene."
            )
        else:
            how_many = (
                "A planting quantity needs an analyzed site scene (canopy "
                "cover + tree count) to be computed."
            )
        budget = pl.get("budget") or {}
        budget_txt = (
            f"Estimated planning investment: "
            f"{budget['total_estimate_inr_formatted']} "
            f"(planning estimate from configurable assumptions — not an "
            f"official tender)."
            if budget.get("available")
            else "Budget estimate unavailable — configure local cost assumptions."
        )
        return (
            f"Recommended green-buffer intervention for this industrial site: "
            f"establish a vegetation buffer using species that tolerate "
            f"pollution. {how_many} "
            f"Starting species: {names} (ranked by the rule-based species "
            f"engine for a pollution-tolerance objective). {budget_txt} "
            f"GreenVision does not currently have a validated "
            f"pollutant-reduction model, so pollutant reduction is not "
            f"quantified — live AQI is shown only as environmental context.",
            "industrial_buffer",
        )

    # ------------------------------------------------------------------
    # Where-to-plant guidance (grounded in the scene's plantation priority).
    # ------------------------------------------------------------------
    if re.search(r"\bwhere\b.*\b(plant|tree|trees)\b", q):
        if not rec:
            return (
                "No plantation recommendation is available for this scene — a "
                "specific planting zone would require zone-level data this "
                "analysis does not produce.", "plantation",
            )
        return f"Plantation priority: {priority}. {rec}", "plantation"

    # ------------------------------------------------------------------
    # How-many / target guidance
    # ------------------------------------------------------------------
    if re.search(
        r"\b(how many.*(need|plant|target)|trees needed|reach.*target|"
        r"target.*(canopy|green cover)|plant.*trees)\b",
        q,
    ):
        target = build_plant_recommendation(scene=context, ctx=plant_ctx, goal="shade").get("target") or {}
        if target.get("computable"):
            return (
                f"About {target['trees_needed']:,} additional trees are "
                f"estimated to take this scene from {target['current_green_cover']}% "
                f"to the {target['target_green_cover']:.0f}% canopy target "
                f"(assuming each planted tree adds canopy equal to the scene's "
                f"current measured canopy per tree).{caveat()}",
                "target",
            )
        return (
            "I can't compute a trees-needed number until an analyzed scene "
            "provides measured canopy area and tree count.", "target",
        )

    # ------------------------------------------------------------------
    # Per-tree contribution — grounded in the product's documented per-tree
    # estimator constants (22 kg CO2 / 118 kg O2 per tree per year).
    # ------------------------------------------------------------------
    if re.search(r"\b(one tree|per tree|single tree|what does a tree|what do trees do)\b", q):
        fraction = 22.0 / (4.7 * 1000)
        return (
            f"One tree sequesters about 22 kg of CO2 and produces about "
            f"118 kg of oxygen per year (the same per-tree estimator "
            f"constants used across the product). That is roughly "
            f"1/{round(1 / fraction)} of one person's ~4.7 t annual CO2 "
            f"footprint. These are per-tree averages — real values vary with "
            f"species, age, health and local climate.",
            "per_tree",
        )

    if re.search(r"\b(tree|trees|count|trees detected)\b", q):
        if trees is None:
            return "Tree count was not computed for this scene.", "trees"
        if scene == "street":
            detected = context.get("detected_trees")
            det_conf = context.get("tree_detection_confidence")
            det_part = (
                f" The trunk detector separately counted "
                f"{detected:,} visible trunks"
                + (f" (mean confidence {det_conf})" if det_conf is not None else "")
                + "."
                if detected is not None
                else " No trunk detection was run for this scene."
            )
            return (
                f"The scene contains an estimated {trees:,} trees "
                f"(density class: {density or 'n/a'}, density score "
                f"{score if score is not None else 'n/a'}) from canopy "
                f"area × density.{det_part}{caveat()}",
                "trees",
            )
        return (
            f"The scene contains an estimated {trees:,} trees "
            f"(density class: {density or 'n/a'}, density score {score if score is not None else 'n/a'})."
            f"{caveat()}",
            "trees",
        )

    if re.search(r"\b(green cover|canopy|cover)\b", q):
        if green is None:
            return (
                f"Green cover was not computed for this {scene or 'image'} "
                "image.",
                "green_cover",
            )
        target = 60
        gap = max(0, round(target - green))
        suffix = f" It is {gap} percentage points below the 60% target." if gap else " It meets the 60% target."
        return f"Estimated green canopy cover is {green}% of the scene.{suffix}{caveat()}", "green_cover"

    if re.search(r"\b(carbon|co2|sequestr|offset|absorb)\b", q):
        if carbon is None:
            return "Carbon sequestration was not computed for this scene.", "carbon"
        people_txt = f" That is equivalent to offsetting the annual CO₂ of about {people:,} people." if people else ""
        return (
            f"The scene sequesters about {carbon} tonnes of CO₂ per year "
            f"({context.get('carbon_kg_per_year', 0)} kg/yr).{people_txt}{caveat()}",
            "carbon",
        )

    if re.search(r"\b(oxygen|o2|produce|production)\b", q):
        if oxygen is None:
            return "Oxygen production was not computed for this scene.", "oxygen"
        return f"The scene produces about {oxygen} tonnes of oxygen per year.{caveat()}", "oxygen"

    if re.search(r"\b(density|densit|dense|sparse|street|forest)\b", q):
        if density is None:
            return "Density classification is unavailable for this scene.", "density"
        return (
            f"The canopy density classifier rated the scene '{density}' "
            f"(score {score if score is not None else 'n/a'}). "
            f"Forest area is {area_ha} hectares." if area_ha is not None else
            f"The canopy density classifier rated the scene '{density}' "
            f"(score {score if score is not None else 'n/a'}).",
            "density",
        )

    if re.search(r"\b(plant|recommend|priority|what should|action)\b", q):
        if not rec:
            return "No plantation recommendation is available for this scene.", "plantation"
        return f"Plantation priority: {priority}. {rec}", "plantation"

    if re.search(r"\b(area|hectare|size|extent|large)\b", q):
        if area_ha is None:
            return "Forest area was not computed for this scene.", "area"
        return (
            f"The detected canopy covers {area_ha} hectares "
            f"({context.get('forest_area_m2', 0)} m²).{caveat()}", "area",
        )

    if re.search(r"\b(scene|type|model|classif)\b", q):
        return (
            f"This image was classified as a '{scene}' scene with {conf}% "
            f"confidence and analyzed with the canopy-segmentation model "
            f"(scale source: {context.get('scale_source', 'unknown')}).", "scene",
        )

    if re.search(r"\b(summary|overview|brief|report)\b", q):
        return summary or "No summary is available for this scene.", "summary"

    if re.search(r"\b(60|target|goal)\b", q):
        if green is None:
            return "Green cover is not computed for this scene type, so I can't compare against the 60% target.", "target"
        status = "meets or exceeds" if green >= 60 else "is below"
        return f"Green cover is {green}%, which {status} the 60% municipal canopy target.", "target"

    if re.search(r"\b(where|location|place|area|city|region|lat|lng|coordinates)\b", q):
        loc_name = plant_ctx.get("name") or context.get("location_name") or context.get("image_name")
        lat = plant_ctx.get("latitude") or plant_ctx.get("lat")
        lng = plant_ctx.get("longitude") or plant_ctx.get("lng")
        parts = []
        if loc_name:
            parts.append(f"Location: {loc_name}")
        if lat is not None and lng is not None:
            try:
                parts.append(f"Coordinates: {float(lat):.4f}, {float(lng):.4f}")
            except (TypeError, ValueError):
                parts.append(f"Coordinates: {lat}, {lng}")
        elev = plant_ctx.get("elevation_m")
        if elev is not None:
            parts.append(f"Elevation: {elev} m")
        weather = plant_ctx.get("blocks", {}).get("weather", {})
        if weather.get("available"):
            temp = weather.get("temperature_2m")
            if temp is not None:
                parts.append(f"Temperature: {temp}°C")
        if parts:
            return " | ".join(parts) + ". This data comes from the Open-Meteo API for environmental context.", "location"
        return (
            "I don't have a specific location for this analysis yet. "
            "Use the Location input on the Planting Plan page to set your "
            "area and I'll pull live weather, elevation and soil context for that spot.",
            "location_unavailable",
        )

    # ------------------------------------------------------------------
    # Follow-up: "another option" / "something else" / "give me another"
    # Re-rank species excluding the ones already mentioned.
    # ------------------------------------------------------------------
    if re.search(r"\b(another|something else|other option|different one|other tree|other species|not this)\b", q):
        last_list = context.get("_last_species_list") or []
        last_id = context.get("_last_species_id")
        exclude_ids = set(last_list)
        if last_id:
            exclude_ids.add(last_id)

        goal = "pollution" if mode == "industrial" else "shade"
        pl = build_plant_recommendation(scene=context, ctx=plant_ctx, goal=goal)
        all_species = pl.get("species") or []
        # Filter out already-shown species
        remaining = [s for s in all_species if s["id"] not in exclude_ids][:3]
        if not remaining:
            # All species already shown — reset and show the full list again
            remaining = all_species[:3]
            exclude_ids = set()

        loc_clause = f" for your area{_loc_hint}" if _loc_name else ""
        lines = [f"Here are other options{loc_clause}:"]
        for i, s in enumerate(remaining, 1):
            lines.append(
                f"{i}. {s['common_name']} ({s['scientific_name']}) — "
                f"GreenVision suitability {s['suitability_score']}/100; "
                f"water {s['water_requirement']}, sun {s['sun_requirement']}, "
                f"spacing {s['spacing_m']} m."
            )
        lines.append(f"Care: {remaining[0]['notes']}")
        return (" ".join(lines), "species")

    # ------------------------------------------------------------------
    # Follow-up: "can I plant X" / "is X good" / "what about X"
    # If X is a known species, explain it. Otherwise, general advice.
    # ------------------------------------------------------------------
    can_plant_match = re.search(
        r"\b(can i|should i|is it (good|ok|fine|suitable)|what about|how about|what do you think about)\b.*"
        r"\b([a-z]+(?:\s+[a-z]+)?)\b",
        q,
    )
    if can_plant_match:
        potential_name = can_plant_match.group(3).strip()
        # Check if it's a known species
        matched_species = None
        for s in SPECIES:
            if (
                s["common_name"].lower() == potential_name
                or s["common_name"].lower() in potential_name
                or potential_name in s["common_name"].lower()
            ):
                matched_species = s
                break
        if matched_species:
            goal = "pollution" if mode == "industrial" else "shade"
            sp_score, reasons = score_species(matched_species, plant_ctx, goal)
            suitability = max(0, min(100, round(sp_score / MAX_RULE_SCORE * 100)))
            loc_clause = f" in {_loc_name}" if _loc_name else ""
            return (
                f"{matched_species['common_name']} ({matched_species['scientific_name']}) is "
                f"{'a good' if suitability >= 60 else 'a moderate' if suitability >= 40 else 'a less ideal'} "
                f"choice{loc_clause}. "
                f"GreenVision suitability: {suitability}/100. "
                f"Key factors: {'; '.join(reasons[:3]) or 'baseline score'}. "
                f"Water: {matched_species['water_requirement']}, "
                f"Sun: {matched_species['sun_requirement']}, "
                f"Spacing: {matched_species['spacing_m']} m. "
                f"Note: this is a planning heuristic — verify with local horticultural guidance.",
                "species_eval",
            )
        # Not a known species — natural response
        return (
            f"I don't have specific data on '{potential_name}' in the GreenVision species database, "
            f"so I can't score it with confidence. I'd recommend checking with your local "
            f"forestry department or nursery for species suited to your area{_loc_hint}. "
            f"I can show you what the species engine ranks highly if you'd like.",
            "species_unknown",
        )

    # ------------------------------------------------------------------
    # Follow-up: "what about 200" / "how about 500" (cost follow-up after
    # a previous cost query)
    # ------------------------------------------------------------------
    number_match = re.match(r"^(\d[\d,]*)\s*(trees?|saplings?|plants?)?\s*\??$", q)
    if number_match and context.get("_last_intent") in ("cost", "cost_prompt", "target", "industrial_buffer"):
        try:
            tree_count = int(number_match.group(1).replace(",", ""))
        except (ValueError, TypeError):
            tree_count = 0
        if tree_count > 0:
            budget = estimate_budget(tree_count, years=1)
            if budget.get("available"):
                return (
                    f"Planning budget for {tree_count:,} trees:\n"
                    f"  Sapling cost: {budget['line_items']['sapling_cost_inr']:,.0f} INR "
                    f"({budget['assumptions']['cost_per_sapling_inr']:.0f} INR/tree)\n"
                    f"  Planting labour: {budget['line_items']['planting_labour_inr']:,.0f} INR\n"
                    f"  Maintenance (1 year): {budget['line_items']['maintenance_inr']:,.0f} INR\n"
                    f"  Total: {budget['total_estimate_inr_formatted']}",
                    "cost",
                )

    # ------------------------------------------------------------------
    # Personal messages / name sharing — respond like a friendly assistant.
    # ------------------------------------------------------------------
    name_match = re.match(
        r"(?:my name is|i'?m|i am|this is|call me|name's?)\s+(.+)",
        q,
    )
    if name_match:
        user_name_from_msg = name_match.group(1).strip().rstrip(".,!?;:").title()
        loc_clause = f" for {user_name_from_msg} in {_loc_name}" if _loc_name else f", {user_name_from_msg}"
        if mode == "citizen":
            return (
                f"Nice to meet you{loc_clause}! I'm GreenVision. "
                f"I can help you find the best trees for your area, estimate planting costs, "
                f"and answer environmental questions. What would you like to know?",
                "personal",
            )
        return (
            f"Nice to meet you, {user_name_from_msg}! I'm the GreenVision advisor. "
            f"Ask me about species, planting targets, budgets, or environmental context.",
            "personal",
        )

    age_match = re.match(r"(?:i am|i'?m|i'm)\s+(\d+)\s*(?:years?\s*old|yo|y/?o)?", q)
    if age_match:
        return (
            "Thanks for sharing! I'm an AI assistant focused on urban greening and environmental planning. "
            "How can I help you with trees, planting, or your local environment?",
            "personal",
        )

    if re.search(r"\b(what('?s| is) your name|who are you|who.?s asking)\b", q):
        return (
            "I'm GreenVision — your AI-powered green planning assistant. "
            "I help cities, industries and citizens plan greener spaces using real data. "
            "Ask me anything about trees, planting, costs, or the environment!",
            "identity",
        )

    if re.search(r"\b(how (are you|r u doing)|how'?s life|you good|you okay)\b", q):
        return (
            "I'm doing great, thanks! Ready to help you plan greener spaces. "
            "Ask me about trees, planting costs, your local environment, or anything green!",
            "smalltalk",
        )

    if re.search(r"\b(tell me a joke|funny|joke|humor)\b", q):
        return (
            "Here's one: Why did the tree go to the dentist? To get a root canal! "
            "But seriously, trees are amazing — one tree absorbs about 22 kg of CO\u2082 per year. "
            "Want to know more about what trees can do for your area?",
            "humor",
        )

    if re.search(r"\b(thank|thx|ty|cheers|appreciate)\b", q):
        return (
            "You're welcome! Feel free to ask me anything else about trees, planting, "
            "costs, or your local environment. Happy to help!",
            "thanks",
        )

    if re.search(r"\b(bye|goodbye|see you|gtg|gotta go|cya|good night|goodnight)\b", q):
        return (
            "Goodbye! Happy planting. Come back anytime you need green planning help!",
            "farewell",
        )

    if re.search(r"\b(nice|cool|awesome|great|good|amazing)\b", q) and len(q.split()) <= 3:
        return (
            "Thanks! I'm here whenever you need help with trees, planting, or environmental planning. "
            "Just ask me anything!",
            "positive_feedback",
        )

    if re.search(r"\b(no|nah|nope|nothing|nm|not really)\b", q) and len(q.split()) <= 2:
        return (
            "No problem! I'm here if you need anything. You can ask me about "
            "trees to plant, estimated costs, carbon impact, or your local environment.",
            "dismissal",
        )

    return (
        "I'm GreenVision — your green planning assistant. I can help with:\n"
        "• What trees to plant in your area\n"
        "• How much planting would cost\n"
        "• Carbon and oxygen impact of trees\n"
        "• Local weather, air quality, and soil conditions\n"
        "• Species recommendations based on your location\n\n"
        "Try asking something like 'What should I plant here?' or "
        "'How much would 50 trees cost?'",
        "fallback",
    )


@app.post("/api/advisor/ask")
def advisor_ask():
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    context = body.get("context") or {}
    conversation_history = body.get("conversation_history") or []
    if not message:
        return _error("message is required.", 400)

    # Extract richer context from conversation history for follow-up handling
    if conversation_history:
        last_intent = None
        last_species_id = None
        last_cost = None
        last_species_list = []

        for msg in reversed(conversation_history):
            if msg.get("sender") == "bot" and msg.get("text"):
                text = msg["text"].lower()
                # Track the last intent
                if not last_intent and msg.get("intent"):
                    last_intent = msg["intent"]
                # Find last species mentioned
                if not last_species_id:
                    for sp in SPECIES:
                        if sp["common_name"].lower() in text:
                            last_species_id = sp["id"]
                            break
                # Find last cost figure
                if not last_cost:
                    cost_m = re.search(r"(\d[\d,]*)\s*trees?.*total.*?([\d,]+)\s*inr", text, re.IGNORECASE)
                    if cost_m:
                        try:
                            last_cost = int(cost_m.group(1).replace(",", ""))
                        except (ValueError, TypeError):
                            pass
                # Collect all species mentioned (for "another option")
                if not last_species_list:
                    for sp in SPECIES:
                        if sp["common_name"].lower() in text:
                            if sp["id"] not in last_species_list:
                                last_species_list.append(sp["id"])

        if last_intent:
            context["_last_intent"] = last_intent
        if last_species_id:
            context["_last_species_id"] = last_species_id
        if last_cost:
            context["_last_cost"] = last_cost
        if last_species_list:
            context["_last_species_list"] = last_species_list

    reply, intent = advisor_reply(message, context)
    return jsonify({"reply": reply, "intent": intent})


# ---------------------------------------------------------------------------
# Location context + species planning (P3/P4)
# ---------------------------------------------------------------------------

def _parse_coords(body):
    """Extract and validate lat/lng; return (lat, lng, err)."""
    try:
        lat = float(body.get("lat"))
        lng = float(body.get("lng"))
    except (TypeError, ValueError):
        return None, None, "lat and lng must be numbers."
    if not (-90 <= lat <= 90):
        return None, None, "lat must be between -90 and 90."
    if not (-180 <= lng <= 180):
        return None, None, "lng must be between -180 and 180."
    return lat, lng, None


def _scene_from_body(body):
    """Accept a scene object or a report_id to look up a saved report."""
    scene = body.get("scene")
    if scene and isinstance(scene, dict):
        return scene
    report_id = body.get("report_id")
    if report_id:
        safe = re.sub(r"[^A-Za-z0-9._-]", "", report_id)
        path = REPORTS_DIR / f"{safe}.json"
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return None
    return scene or {}


@app.post("/api/location/context")
def location_context():
    body = request.get_json(silent=True) or {}
    lat, lng, err = _parse_coords(body)
    if err:
        return _error(err, 400)
    name = (body.get("name") or "").strip() or None
    ctx = fetch_location_context(lat=lat, lng=lng, name=name)
    return jsonify(ctx)


@app.post("/api/location/geocode")
def location_geocode():
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return _error("query is required.", 400)
    if len(query) > 200:
        return _error("query is too long.", 400)
    count = min(int(body.get("count") or 5), 10)
    return jsonify(geocode_places(query, count=count))


@app.post("/api/location/reverse")
def location_reverse():
    """Reverse-geocode lat/lng to a place name using Open-Meteo geocoding search."""
    body = request.get_json(silent=True) or {}
    lat, lng, err = _parse_coords(body)
    if err:
        return _error(err, 400)

    # Use Open-Meteo geocoding search — search for cities near the point
    params = urlencode({
        "name": f"{lat:.2f} {lng:.2f}",
        "count": 1,
        "language": "en",
        "format": "json",
    })
    url = f"{OPEN_METEO_GEO}/search?{params}"

    # Better approach: use the forecast API which returns the timezone/city
    # Or just do a direct search with nearby city names
    # Simplest reliable approach: use Nominatim (OpenStreetMap) reverse geocoding
    nominatim_url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&addressdetails=1"
    try:
        from urllib.request import Request, urlopen as _urlopen
        req = Request(nominatim_url, headers={"User-Agent": "GreenVision-AI/1.0"})
        resp = _urlopen(req, timeout=5)
        data = json.loads(resp.read().decode())
        address = data.get("address", {})
        city = address.get("city") or address.get("town") or address.get("village") or address.get("county") or ""
        state = address.get("state") or ""
        country = address.get("country") or ""
        display = data.get("display_name", "")
        parts = [p for p in [city, state, country] if p]
        name = ", ".join(parts) if parts else (display[:80] if display else "")
        return jsonify({
            "name": name,
            "display_name": display[:200] if display else name,
            "latitude": lat,
            "longitude": lng,
            "available": True,
        })
    except Exception as exc:
        logger.debug("Reverse geocode failed: %s", exc)
        return jsonify({
            "name": None,
            "latitude": lat,
            "longitude": lng,
            "available": False,
        })


@app.post("/api/plant/recommend")
def plant_recommend():
    body = request.get_json(silent=True) or {}
    lat, lng, err = _parse_coords(body)
    if err:
        return _error(err, 400)
    name = (body.get("name") or "").strip() or None
    goal = (body.get("objective") or "shade").strip().lower()
    if goal not in {"shade", "fast", "pollution", "biodiversity"}:
        return _error("objective must be one of: shade, fast, pollution, biodiversity.", 400)

    ctx = fetch_location_context(lat=lat, lng=lng, name=name)
    scene = _scene_from_body(body) or {}

    rec = build_plant_recommendation(
        scene=scene,
        ctx=ctx,
        goal=goal,
        location_name=name or (ctx.get("name") or None),
    )
    return jsonify(rec)


# ---------------------------------------------------------------------------
# Green Contribution + Green Champions (demo-grade identity, no accounts)
# ---------------------------------------------------------------------------

@app.post("/api/contributions")
def create_contribution():
    ensure_seeded()
    body = request.get_json(silent=True) or {}
    record, err = save_contribution(body)
    if err:
        return _error(err, 400)
    return jsonify(record), 201


@app.get("/api/contributions")
def api_list_contributions():
    ensure_seeded()
    return jsonify({"items": list_contributions(limit=200), "points_disclaimer": POINTS_DISCLAIMER})


@app.get("/api/contributions/<cid>")
def api_get_contribution(cid):
    ensure_seeded()
    record = get_contribution(cid)
    if record is None:
        return _error("Contribution not found.", 404)
    return jsonify(record)


@app.post("/api/contributions/<cid>/evidence")
def api_attach_evidence(cid):
    ensure_seeded()
    record = get_contribution(cid)
    if record is None:
        return _error("Contribution not found.", 404)
    file = request.files.get("photo")
    if file is None or not file.filename:
        return _error("photo is required (multipart field 'photo').", 400)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
        return _error("photo must be jpg, jpeg, png or webp.", 400)
    if file.content_length and file.content_length > MAX_EVIDENCE_MB * 1024 * 1024:
        return _error(f"photo exceeds the {MAX_EVIDENCE_MB} MB limit.", 400)
    chunk = file.read(MAX_EVIDENCE_MB * 1024 * 1024 + 1)
    if len(chunk) > MAX_EVIDENCE_MB * 1024 * 1024:
        return _error(f"photo exceeds the {MAX_EVIDENCE_MB} MB limit.", 400)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", record["id"])
    filename = f"{safe}-evidence.{ext}"
    (DATA_DIR / "uploads" / "evidence").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "uploads" / "evidence" / filename).write_bytes(chunk)
    record, err = attach_evidence(cid, filename)
    if err:
        return _error(err, 400)
    return jsonify(record)


@app.get("/api/contributions/<cid>/evidence")
def api_get_evidence(cid):
    ensure_seeded()
    path, err = evidence_path(cid)
    if err:
        return _error(err, 404)
    return send_file(path, mimetype="image/jpeg")


@app.get("/api/leaderboard")
def api_leaderboard():
    ensure_seeded()
    board, disclaimer = leaderboard(limit=100)
    contributor_id = (request.args.get("contributor_id") or "").strip() or None
    mine = position_of(contributor_id) if contributor_id else None
    org_type_filter = (request.args.get("org_type") or "").strip() or None
    orgs = org_leaderboard(org_type=org_type_filter, limit=50)
    return jsonify({
        "title": "GREEN CHAMPIONS",
        "entries": board,
        "organizations": orgs,
        "my_position": mine,
        "points_disclaimer": disclaimer,
        "verification_note": (
            "Contributions are community-reported; photo verification is not "
            "implemented in this release."
        ),
    })


# ---------------------------------------------------------------------------
# Reports (saved analysis history)
# ---------------------------------------------------------------------------

@app.get("/api/reports")
def list_reports():
    entries = []
    if REPORTS_DIR.exists():
        for path in sorted(REPORTS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            entries.append({
                "id": data.get("id") or path.stem,
                "scene_id": data.get("scene_id"),
                "image_name": data.get("image_name"),
                "timestamp": data.get("timestamp"),
                "estimated_trees": data.get("estimated_trees"),
                "green_cover_percentage": data.get("green_cover_percentage"),
                "carbon_tonnes_per_year": data.get("carbon_tonnes_per_year"),
                "oxygen_tonnes_per_year": data.get("oxygen_tonnes_per_year"),
                "density_class": data.get("density_class"),
            })
    return jsonify({"reports": entries})


@app.get("/api/reports/<report_id>")
def get_report(report_id):
    safe = re.sub(r"[^A-Za-z0-9._-]", "", report_id)
    path = REPORTS_DIR / f"{safe}.json"
    if not path.exists():
        return _error("Report not found.", 404)
    try:
        return jsonify(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError) as exc:
        return _error(f"Could not read report: {exc}", 500)


@app.get("/api/reports/<report_id>/download")
def download_report(report_id):
    safe = re.sub(r"[^A-Za-z0-9._-]", "", report_id)
    path = REPORTS_DIR / f"{safe}.json"
    if not path.exists():
        return _error("Report not found.", 404)
    return send_file(
        path,
        as_attachment=True,
        download_name=f"greenvision-{safe}.json",
        mimetype="application/json",
    )


# ---------------------------------------------------------------------------
# Heatmap overlay images
# ---------------------------------------------------------------------------

@app.get("/api/heatmaps/<filename>")
def serve_heatmap(filename):
    safe = re.sub(r"[^A-Za-z0-9._-]", "", filename)
    path = OVERLAY_DIR / safe
    if not path.exists():
        return _error("Heatmap not found.", 404)
    return send_file(path, mimetype="image/png")


# ---------------------------------------------------------------------------
# Temporal comparison endpoint
# ---------------------------------------------------------------------------

@app.post("/api/compare")
def compare_reports():
    body = request.get_json(silent=True) or {}
    id_a = (body.get("report_a") or "").strip()
    id_b = (body.get("report_b") or "").strip()
    if not id_a or not id_b:
        return _error("Both report_a and report_b are required.", 400)

    def _load(rid):
        safe = re.sub(r"[^A-Za-z0-9._-]", "", rid)
        path = REPORTS_DIR / f"{safe}.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    ra = _load(id_a)
    rb = _load(id_b)
    if ra is None or rb is None:
        return _error("One or both reports not found.", 404)

    metrics = {}
    for key, label, unit in [
        ("green_cover_percentage", "Canopy cover", "%"),
        ("estimated_trees", "Estimated trees", ""),
        ("carbon_tonnes_per_year", "CO2 sequestration", "t/yr"),
        ("oxygen_tonnes_per_year", "Oxygen production", "t/yr"),
        ("forest_area_hectares", "Forest area", "ha"),
        ("density_score", "Density score", ""),
    ]:
        va = ra.get(key)
        vb = rb.get(key)
        delta_val = None
        if va is not None and vb is not None:
            try:
                delta_val = round(float(vb) - float(va), 4)
            except (TypeError, ValueError):
                delta_val = None
        metrics[key] = {
            "label": label,
            "unit": unit,
            "value_a": va,
            "value_b": vb,
            "delta": delta_val,
        }

    return jsonify({
        "report_a": {
            "id": ra.get("id"),
            "timestamp": ra.get("timestamp"),
            "image_name": ra.get("image_name"),
            "scene": ra.get("scene"),
        },
        "report_b": {
            "id": rb.get("id"),
            "timestamp": rb.get("timestamp"),
            "image_name": rb.get("image_name"),
            "scene": rb.get("scene"),
        },
        "metrics": metrics,
    })


@app.post("/api/historical/upload")
def upload_historical():
    """Upload a historical image or PDF for comparison."""
    if "file" not in request.files:
        return _error("No file uploaded.", 400)

    f = request.files["file"]
    if not f.filename:
        return _error("No file selected.", 400)

    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    year = (request.form.get("year") or "").strip()

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_id = re.sub(r"[^A-Za-z0-9._-]", "", f"{int(time.time())}_{f.filename}")
    path = os.path.join(UPLOAD_DIR, safe_id)
    f.save(path)

    if ext == "pdf":
        if not PDF_AVAILABLE:
            return jsonify({
                "type": "pdf",
                "status": "partial",
                "filename": f.filename,
                "year": year or None,
                "message": "PDF text extraction is not available (PyMuPDF not installed). The file has been saved but content could not be extracted.",
                "extracted": {},
            }), 200

        try:
            doc = fitz.open(path)
            text_parts = []
            for page in doc:
                text_parts.append(page.get_text())
            full_text = "\n".join(text_parts)
            doc.close()

            if not year:
                year_match = re.search(r"\b(20[0-2]\d|19\d{2})\b", full_text)
                if year_match:
                    year = year_match.group(1)

            canopy_match = re.search(
                r"(?:canopy|green\s*cover|vegetation)\s*(?:cover)?\s*(?:[:=is\s]+)\s*(\d+\.?\d*)\s*%",
                full_text, re.IGNORECASE
            )
            tree_match = re.search(
                r"(?:trees?|tree\s*count|estimated\s*trees?)\s*(?:[:=is\s]+)\s*(\d[\d,]*)",
                full_text, re.IGNORECASE
            )

            extracted = {}
            if canopy_match:
                extracted["green_cover_percentage"] = float(canopy_match.group(1))
            if tree_match:
                extracted["estimated_trees"] = int(tree_match.group(1).replace(",", ""))
            if full_text.strip():
                extracted["raw_text_preview"] = full_text[:2000]

            return jsonify({
                "type": "pdf",
                "status": "extracted" if extracted else "saved",
                "filename": f.filename,
                "year": year or None,
                "message": (
                    f"PDF processed. {'Extracted: ' + ', '.join(extracted.keys()) + '.' if extracted else 'No structured data found in the PDF.'}"
                    + " The file has been saved for reference."
                ),
                "extracted": extracted,
                "saved_path": f"/uploads/{safe_id}",
            }), 200

        except Exception as e:
            return jsonify({
                "type": "pdf",
                "status": "error",
                "filename": f.filename,
                "year": year or None,
                "message": f"PDF extraction failed: {str(e)}. The file has been saved.",
                "extracted": {},
                "saved_path": f"/uploads/{safe_id}",
            }), 200

    # For images: run the ML analysis pipeline so results are directly comparable.
    try:
        report = get_pipeline().process_image(path)
        veg_mask = report.pop("_veg_mask", None)
        result = build_result(report, Path(path), f.filename)
        heatmap_fname = _generate_heatmap(veg_mask, result["scene_id"])
        if heatmap_fname:
            result["heatmap_url"] = f"/api/heatmaps/{heatmap_fname}"
        if year:
            result["year"] = year
            result["image_name"] = f"{f.filename} ({year})"
        save_report(result)
        return jsonify({
            "type": "image",
            "status": "analyzed",
            "filename": f.filename,
            "year": year or None,
            "message": "Image analyzed and saved as a report. You can now compare it in Historical Comparison.",
            "report_id": result.get("scene_id"),
            "extracted": {
                "green_cover_percentage": result.get("green_cover_percentage"),
                "estimated_trees": result.get("estimated_trees"),
            },
        }), 200
    except Exception as exc:
        logger.warning("Historical image analysis failed, saving as reference: %s", exc)
        return jsonify({
            "type": "image",
            "status": "saved",
            "filename": f.filename,
            "year": year or None,
            "message": "Image could not be analyzed (analysis failed). The file has been saved for reference.",
            "extracted": {},
            "saved_path": f"/uploads/{safe_id}",
        }), 200


# ---------------------------------------------------------------------------
# Error handlers -> JSON
# ---------------------------------------------------------------------------

@app.errorhandler(413)
def too_large(_err):
    return _error(f"File too large. Maximum upload size is {MAX_UPLOAD_MB} MB.", 413)


@app.errorhandler(404)
def not_found(_err):
    return _error("Endpoint not found.", 404)


@app.errorhandler(405)
def method_not_allowed(_err):
    return _error("Method not allowed for this endpoint.", 405)


@app.errorhandler(500)
def server_error(err):
    logger.exception("Unhandled server error")
    return _error(f"Internal server error: {err}", 500)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
