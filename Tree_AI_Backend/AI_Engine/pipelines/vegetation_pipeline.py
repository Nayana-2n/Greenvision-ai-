"""
vegetation_pipeline.py

Unified vegetation / canopy analysis pipeline.

Runs for EVERY scene type. Scene classification labels the environment
(dense / sparse / street); it does NOT gate vegetation analysis — an
urban, industrial or residential scene can still contain measurable
canopy, so the same canopy-segmentation analysis runs regardless of the
scene label. If the segmentation model genuinely detects no canopy, the
measured values are 0 (a genuine measurement, not "unavailable").
"""

from estimators.green_cover import calculate_green_cover
from estimators.mask_features import extract_mask_features
from estimators.forest_density import estimate_forest_density
from estimators.tree_counter import estimate_tree_count
from estimators.carbon import calculate_carbon
from estimators.oxygen import calculate_oxygen
from estimators.report import generate_report
from estimators.carbon_offset import calculate_carbon_offset
from estimators.plantation_recommendation import recommend_plantation


def process(results, image, meters_per_pixel, scene=None):

    # -----------------------------
    # Green cover / canopy mask
    # -----------------------------

    green = calculate_green_cover(
        results[0],
        image,
        meters_per_pixel
    )

    # -----------------------------
    # Mask features
    # -----------------------------

    features = extract_mask_features(
        green["mask"]
    )

    # -----------------------------
    # Forest density
    # -----------------------------

    density = estimate_forest_density(
        green,
        features
    )

    # -----------------------------
    # Tree count (canopy-area heuristic)
    # -----------------------------

    trees = estimate_tree_count(
        green,
        density
    )

    # -----------------------------
    # Carbon / oxygen
    # -----------------------------

    carbon = calculate_carbon(
        trees
    )

    oxygen = calculate_oxygen(
        trees
    )

    # -----------------------------
    # Base report
    # -----------------------------

    report = generate_report(
        green,
        features,
        density,
        trees,
        carbon,
        oxygen,
        scene=scene
    )

    # -----------------------------
    # Carbon footprint offset
    # -----------------------------

    offset = calculate_carbon_offset(
        report["carbon_tonnes_per_year"]
    )

    report.update(offset)

    # -----------------------------
    # Plantation recommendation
    # -----------------------------

    plantation = recommend_plantation(
        report.get("green_cover_percentage"),
        report.get("density_class", "Unknown")
    )

    report.update(plantation)

    return report, green["mask"]
