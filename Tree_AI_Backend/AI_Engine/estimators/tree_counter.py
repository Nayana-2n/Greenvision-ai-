"""
tree_counter.py

Estimate the number of trees from forest area and density.
"""


def estimate_tree_count(green_cover, forest_density):
    """
    Parameters
    ----------
    green_cover : dict
        Output from green_cover.py

    forest_density : dict
        Output from forest_density.py

    Returns
    -------
    dict
    """

    area = green_cover["statistics"]["forest_area_m2"]

    trees_per_m2 = forest_density["trees_per_m2"]

    estimated_trees = round(area * trees_per_m2)

    return {

        "estimated_trees": estimated_trees,

        "trees_per_m2": trees_per_m2,

        "density_class": forest_density["density_class"],

        "density_score": forest_density["density_score"],
        "confidence": forest_density["confidence"]

    }
