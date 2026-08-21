def recommend_plantation(
    green_cover_percentage=None,
    density_class="Unknown"
):
    """
    Returns a plantation priority based on
    available green-cover and density information.
    """

    density = density_class.lower()

    # Street/sparse models don't currently calculate
    # green cover, so don't make a false recommendation.
    if green_cover_percentage is None:

        if density == "sparse":
            return {
                "plantation_priority": "Medium",
                "plantation_recommendation":
                    "Additional plantation may improve tree density."
            }

        return {
            "plantation_priority": "Not Assessed",
            "plantation_recommendation":
                "Plantation priority cannot be determined "
                "without green-cover information."
        }

    if green_cover_percentage < 20:

        return {
            "plantation_priority": "High",
            "plantation_recommendation":
                "High priority plantation recommended."
        }

    elif green_cover_percentage < 40:

        return {
            "plantation_priority": "Medium",
            "plantation_recommendation":
                "Moderate plantation recommended "
                "to improve green cover."
        }

    elif density == "sparse":

        return {
            "plantation_priority": "Medium",
            "plantation_recommendation":
                "Additional plantation may improve tree density."
        }

    else:

        return {
            "plantation_priority": "Low",
            "plantation_recommendation":
                "No immediate plantation priority based "
                "on current green cover."
        }
