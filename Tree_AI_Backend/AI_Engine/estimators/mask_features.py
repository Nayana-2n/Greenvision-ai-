"""
mask_features.py

Purpose
-------
Extract structural canopy features from a binary forest mask.

These features are later used for tree density estimation.
"""

import cv2
import numpy as np


def extract_mask_features(mask):
    """
    Parameters
    ----------
    mask : numpy.ndarray
        Binary canopy mask (0 or 1)

    Returns
    -------
    dict
    """

    # Convert mask to uint8
    binary = (mask > 0).astype(np.uint8)

    # Find connected canopy patches
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8
    )

    # Ignore background
    patch_areas = []

    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        patch_areas.append(area)

    number_of_patches = len(patch_areas)

    if number_of_patches == 0:

        return {

            "number_of_patches": 0,

            "largest_patch": 0,

            "smallest_patch": 0,

            "average_patch": 0,

            "fragmentation_index": 0,

            "edge_density": 0

        }

    largest_patch = max(patch_areas)

    smallest_patch = min(patch_areas)

    average_patch = np.mean(patch_areas)

    total_patch_area = np.sum(patch_areas)

    fragmentation_index = (
        number_of_patches / total_patch_area
    )

    # -----------------------------------
    # Edge Density
    # -----------------------------------

    edges = cv2.Canny(binary * 255, 100, 200)

    edge_pixels = np.sum(edges > 0)

    edge_density = edge_pixels / total_patch_area

    return {

        "number_of_patches": int(number_of_patches),

        "largest_patch": int(largest_patch),

        "smallest_patch": int(smallest_patch),

        "average_patch": round(float(average_patch), 2),

        "fragmentation_index": round(
            float(fragmentation_index), 6
        ),

        "edge_density": round(
            float(edge_density), 6
        )

    }
