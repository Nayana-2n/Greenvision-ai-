"""
green_cover.py

Purpose
-------
Calculates:

1. Forest Pixels
2. Total Pixels
3. Green Cover Percentage
4. Forest Area (m²)
5. Forest Area (hectares)

This module accepts the raw YOLO segmentation result,
combines all forest masks into one binary canopy mask,
and returns statistics for further processing.
"""

import cv2
import numpy as np


def calculate_green_cover(result, image, meters_per_pixel):
    """
    Parameters
    ----------
    result : ultralytics.engine.results.Results

    image : numpy.ndarray

    meters_per_pixel : float

    Returns
    -------
    dict
    """

    height, width = image.shape[:2]

    total_pixels = height * width

    combined_mask = np.zeros(
        (height, width),
        dtype=np.uint8
    )

    # -------------------------------------
    # No forest detected
    # -------------------------------------

    if result.masks is None:

        return {

            "statistics": {

                "image_width": width,

                "image_height": height,

                "total_pixels": total_pixels,

                "forest_pixels": 0,

                "green_cover_percentage": 0.0,

                "canopy_percentage": 0.0,

                "forest_area_m2": 0.0,

                "forest_area_hectares": 0.0,

                "scale_used": meters_per_pixel

            },

            "mask": combined_mask

        }

    # -------------------------------------
    # Merge all segmentation masks
    # -------------------------------------

    masks = result.masks.data.cpu().numpy()

    for mask in masks:

        resized = cv2.resize(
            mask,
            (width, height),
            interpolation=cv2.INTER_NEAREST
        )

        binary = (resized > 0.5).astype(np.uint8)

        combined_mask = np.maximum(
            combined_mask,
            binary
        )

    forest_pixels = int(np.sum(combined_mask))

    green_cover_percentage = (
        forest_pixels / total_pixels
    ) * 100

    forest_area = (
        forest_pixels *
        (meters_per_pixel ** 2)
    )

    hectares = forest_area / 10000

    statistics = {

        "image_width": width,

        "image_height": height,

        "total_pixels": total_pixels,

        "forest_pixels": forest_pixels,

        "green_cover_percentage": round(
            green_cover_percentage,
            2
        ),

        # Added for clarity
        "canopy_percentage": round(
            green_cover_percentage,
            2
        ),

        "forest_area_m2": round(
            forest_area,
            2
        ),

        "forest_area_hectares": round(
            hectares,
            4
        ),

        # Store the scale used
        "scale_used": meters_per_pixel

    }

    return {

        "statistics": statistics,

        "mask": combined_mask

    }
