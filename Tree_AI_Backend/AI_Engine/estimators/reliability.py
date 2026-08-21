"""
reliability.py

Input-domain gate for canopy segmentation.

The canopy-segmentation model is trained on RGB aerial/satellite imagery of
vegetation. A nearly-colorless image (grayscale, flat synthetic fill, heavily
desaturated screenshot) is outside that domain: its segmentation output is
not a reliable measurement, and reporting canopy / tree / carbon / oxygen
figures from it would present model noise as fact.

This module computes a cheap, model-independent colour-content signal and
gates the report when the input is essentially achromatic.

Measured reference values (verified during P0 work):
  - real aerial demo assets (hero_aerial, Cubbon Park GeoTIFF): mean_sat ~0.38
  - near-grayscale / bad synthetic images:                    mean_sat < 0.05
"""

import cv2
import numpy as np

# Minimum mean HSV saturation (0-1) for an image to be treated as a colour
# aerial photo the segmentation model was trained to measure. Deliberately
# conservative: real aerial imagery sits near 0.38 while achromatic inputs sit
# below 0.05, so the threshold leaves a wide margin and never gates valid
# imagery.
MEAN_SATURATION_GATE = 0.10

RECOVERY_MESSAGE = (
    "Vegetation cannot be measured reliably from this image. "
    "Upload a top-down aerial/satellite/GeoTIFF image or provide a location."
)


def assess_image_reliability(image):
    """
    Return a reliability verdict plus the colour-content signal for a BGR image.

    Parameters
    ----------
    image : numpy.ndarray
        BGR image as read by cv2.imread.

    Returns
    -------
    dict
        {
            "reliable": bool,
            "signal":   {"mean_saturation": float,
                         "green_pixel_fraction": float,
                         "width": int, "height": int},
            "reason":   str | None,
            "message":  str | None
        }
    """

    height, width = image.shape[:2]
    total = height * width

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1].astype(np.float32) / 255.0
    mean_saturation = float(saturation.mean())

    bgr = image.astype(np.float32)
    b, g, r = bgr[:, :, 0], bgr[:, :, 1], bgr[:, :, 2]
    green_fraction = float(((g > r) & (g > b)).sum() / total)

    reliable = mean_saturation >= MEAN_SATURATION_GATE

    return {
        "reliable": bool(reliable),
        "signal": {
            "mean_saturation": round(mean_saturation, 4),
            "green_pixel_fraction": round(green_fraction, 4),
            "width": int(width),
            "height": int(height),
        },
        "reason": None if reliable else "achromatic_low_color_content",
        "message": None if reliable else RECOVERY_MESSAGE,
    }
