"""
oxygen.py
"""


def calculate_oxygen(tree_count):
    """
    Average oxygen production:
    118 kg/tree/year
    """

    trees = tree_count["estimated_trees"]

    oxygen = trees * 118

    return {
        "oxygen_kg_per_year": round(oxygen, 2),
        "oxygen_tonnes_per_year": round(oxygen / 1000, 2)
    }
