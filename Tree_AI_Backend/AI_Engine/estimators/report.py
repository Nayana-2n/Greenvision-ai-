"""
report.py
"""

import json
import os


def generate_report(
    green,
    features,
    density,
    trees,
    carbon,
    oxygen,
    scene=None
):

    report = {

        **green["statistics"],

        **features,

        **density,

        **trees,

        **carbon,

        **oxygen
    }

    canopy = green["statistics"]["green_cover_percentage"]
    area_ha = green["statistics"]["forest_area_hectares"]
    scene_label = scene or "analyzed"

    report["summary"] = (

        f"The uploaded image is classified as a "
        f"{scene_label} scene with {canopy}% canopy cover "
        f"spanning {area_ha} hectares. Estimated tree count is "
        f"{trees['estimated_trees']}. "
        f"Estimated annual carbon sequestration is "
        f"{carbon['carbon_tonnes_per_year']} tonnes "
        f"and oxygen production is "
        f"{oxygen['oxygen_tonnes_per_year']} tonnes."

    )

    return report


def save_report(report, image_name):

    os.makedirs("reports", exist_ok=True)

    filename = os.path.splitext(image_name)[0]

    with open(
        f"reports/{filename}.json",
        "w"
    ) as f:

        json.dump(
            report,
            f,
            indent=4
        )
