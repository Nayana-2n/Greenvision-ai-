"""
scale.py

Purpose:
--------
Determine the image scale (meters per pixel)
using metadata whenever possible.
"""

from typing import Dict


def determine_scale(metadata: Dict) -> Dict:
    """
    Determines the scale information from metadata.

    Returns:
        {
            "scale_available": bool,
            "meters_per_pixel": float | None,
            "source": str,
            "accuracy": str,
            "warning": str | None
        }
    """

    result = {

        "scale_available": False,

        "meters_per_pixel": None,

        "source": "Unknown",

        "accuracy": "Low",

        "warning": None
    }

    # --------------------------------------------------
    # Scale sources, in priority order:
    #   1. GeoTIFF pixel scale (ModelPixelScale) - real ground resolution
    #      - accuracy "High" for projected CRS (UTM metres)
    #      - accuracy "Approximate" for geographic CRS (degree -> metre)
    #   2. Fall back to a default (handled by the pipeline).
    # --------------------------------------------------

    if metadata.get("scale_available"):

        result["scale_available"] = True

        result["meters_per_pixel"] = metadata["meters_per_pixel"]

        if metadata.get("crs_epsg"):

            result["source"] = "GeoTIFF"

        else:

            result["source"] = "Image Metadata"

        if metadata.get("scale_approximation"):

            result["accuracy"] = "Approximate"

        else:

            result["accuracy"] = "High"

    else:

        result["warning"] = (
            "Scale information not found in metadata."
        )

    return result
