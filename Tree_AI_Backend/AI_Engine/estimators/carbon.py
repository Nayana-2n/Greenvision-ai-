"""
carbon.py
"""


def calculate_carbon(tree_count):
    """
    Average carbon sequestration:
    22 kg CO₂/tree/year
    """

    trees = tree_count["estimated_trees"]

    carbon = trees * 22

    return {
        "carbon_kg_per_year": round(carbon, 2),
        "carbon_tonnes_per_year": round(carbon / 1000, 2)
    }
