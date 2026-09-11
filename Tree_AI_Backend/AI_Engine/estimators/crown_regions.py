"""
crown_regions.py

Extract individual tree-crown regions from the trained canopy
segmentation output for AERIAL / DRONE imagery.

Purpose
-------
The species classifier was trained on crops of individual tree crowns
in aerial/overhead imagery. Aerial images therefore must obtain
tree-crown regions BEFORE species classification — never trunk regions
(the street detector's domain).

The canopy-segmentation model (``models/sparse/best.pt``, class
"Forest") is the trained, validated segmentation model in this repo.
``models/dense/best.pt`` is an untrained epoch-0 checkpoint
(mAP 0.009) and is NOT used. Crown regions are derived from the
segmentation mask via connected components after a light
morphological closing that merges fragments of a single crown.

Each region returns the crown bounding box and the EXACT crown mask
area (pixels) so species coverage can be computed from measured
crown area — never from classifier confidence.
"""

import cv2
import numpy as np


def extract_crown_regions(mask, min_area=64, close_kernel=7):
    """Extract tree-crown regions from a binary canopy mask.

    Parameters
    ----------
    mask : numpy.ndarray
        Binary canopy segmentation mask (0/1 or 0/255) at full image
        resolution.
    min_area : int
        Minimum region area in pixels. Smaller blobs are treated as
        segmentation noise and dropped.
    close_kernel : int
        Diameter of the elliptical kernel used for the morphological
        closing that merges fragments belonging to one crown. 0 skips
        the closing.

    Returns
    -------
    list of dict
        Each entry::

            {
                "box": [x1, y1, x2, y2],
                "area": int                  # exact crown mask area (px)
            }

        Sorted by area (largest first). Empty list when no canopy is
        present.
    """

    if mask is None:
        return []

    if mask.size == 0:
        return []

    binary = (np.asarray(mask) > 0).astype(np.uint8)

    if int(binary.sum()) == 0:
        return []

    if close_kernel and close_kernel > 1:

        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (close_kernel, close_kernel)
        )

        binary = cv2.morphologyEx(
            binary,
            cv2.MORPH_CLOSE,
            kernel
        )

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8
    )

    height, width = binary.shape

    regions = []

    # label 0 is the background
    for label in range(1, num_labels):

        x, y, box_w, box_h, area = stats[label]

        if area < min_area:
            continue

        x1 = max(0, int(x))
        y1 = max(0, int(y))
        x2 = min(width, int(x + box_w))
        y2 = min(height, int(y + box_h))

        if (x2 - x1) < 3 or (y2 - y1) < 3:
            continue

        regions.append({
            "box": [x1, y1, x2, y2],
            "area": int(area),
        })

    regions.sort(key=lambda r: r["area"], reverse=True)

    return regions