"""
forest_density.py

Estimate forest density using canopy features.
"""


def estimate_forest_density(green_cover, features):
    """
    Parameters
    ----------
    green_cover : dict
        Output from green_cover.py

    features : dict
        Output from mask_features.py

    Returns
    -------
    dict
    """

    gc = green_cover["statistics"]["green_cover_percentage"]

    lpr = (
        features["largest_patch"]
        / green_cover["statistics"]["forest_pixels"]
        if green_cover["statistics"]["forest_pixels"] > 0
        else 0
    )

    fragmentation = features["fragmentation_index"]

    edge_density = features["edge_density"]

    density_score = (
        0.5 * (gc / 100)
        + 0.3 * lpr
        - 0.1 * fragmentation
        - 0.1 * edge_density
    )

    density_score = max(0.0, min(1.0, density_score))

    if density_score < 0.30:
        density = "Sparse"
        trees_per_m2 = 0.03

    elif density_score < 0.60:
        density = "Moderate"
        trees_per_m2 = 0.06

    elif density_score < 0.80:
        density = "Dense"
        trees_per_m2 = 0.09

    else:
        density = "Very Dense"
        trees_per_m2 = 0.12

    confidence = (
    (gc / 100) * 100
    - (fragmentation * 1000)
    )

    confidence = max(50, min(99, confidence))

    return {

        "density_score": round(density_score, 3),

        "density_class": density,

        "trees_per_m2": trees_per_m2,

        "confidence": round(confidence, 1)

    }
