"""
carbon_offset.py

Estimates the equivalent number of people whose annual
CO2 emissions could be offset by the forest's estimated
annual CO2 sequestration.
"""

# Default annual CO2 emissions per person.
# Keep this configurable so it can be changed later.
DEFAULT_CO2_PER_PERSON = 4.7


def calculate_carbon_offset(
    carbon_tonnes_per_year,
    co2_per_person=DEFAULT_CO2_PER_PERSON
):
    """
    Parameters
    ----------
    carbon_tonnes_per_year : float
        Estimated annual CO2 sequestration in tonnes.

    co2_per_person : float
        Assumed annual CO2 emissions per person in tonnes.

    Returns
    -------
    dict
    """

    if carbon_tonnes_per_year < 0:
        raise ValueError(
            "Carbon sequestration cannot be negative."
        )

    if co2_per_person <= 0:
        raise ValueError(
            "CO2 per person must be greater than zero."
        )

    equivalent_people = (
        carbon_tonnes_per_year /
        co2_per_person
    )

    return {
        "carbon_offset_tonnes_per_year":
            round(carbon_tonnes_per_year, 2),

        "assumed_co2_per_person_tonnes_per_year":
            round(co2_per_person, 2),

        "equivalent_people_offset":
            round(equivalent_people, 2)
    }
