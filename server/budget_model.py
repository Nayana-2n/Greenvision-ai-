"""
budget_model.py
===============

Planning-level intervention budget estimation for GreenVision.AI.

Honesty contract
----------------
* This is a PLANNING ESTIMATE built from configurable assumptions — NOT an
  official government tender or an audited expenditure figure.
* Every number returned carries the assumption it was derived from, a visible
  formula, and the standard caption below. If the assumptions are not
  configured the endpoint reports "Budget estimate unavailable".
* The defaults below are editable in ONE place (this module or the
  GV_COST_* environment variables). They are illustrative planning
  assumptions for the demonstration, not local tender prices.
"""

import os

# ---------------------------------------------------------------------------
# Configurable assumptions (single source of truth).
#
# Override any of these with environment variables, e.g.
#   GV_COST_PER_SAPLING=200 GV_COST_PLANTING_PER_TREE=100
# ---------------------------------------------------------------------------

_DEFAULTS = {
    "cost_per_sapling": 150.0,
    "planting_cost_per_tree": 80.0,
    "maintenance_cost_per_tree_per_year": 40.0,
}

_OVERRIDES = {
    "cost_per_sapling": "GV_COST_PER_SAPLING",
    "planting_cost_per_tree": "GV_COST_PLANTING_PER_TREE",
    "maintenance_cost_per_tree_per_year": "GV_COST_MAINTENANCE_PER_TREE_YEAR",
}

DISCLOSURE = (
    "Planning estimate \u2014 actual costs vary by municipality, species, "
    "procurement, labour and maintenance contracts."
)

FORMULA = (
    "Total = (trees \u00d7 sapling cost) + (trees \u00d7 planting cost) "
    "+ (trees \u00d7 maintenance cost \u00d7 years)"
)

ALLOWED_MAINTENANCE_YEARS = (0, 1, 3, 5)


def budget_assumptions():
    """Return the active cost assumptions plus a ``configured`` flag.

    ``configured`` is True whenever at least the sapling and planting costs
    are known (positive numbers). The demo ships editable defaults so the
    estimate renders; deployments can clear them to force the
    "Budget estimate unavailable" state.
    """
    assumptions = {}
    for key, env in _OVERRIDES.items():
        raw = os.environ.get(env)
        try:
            value = float(raw) if raw is not None else _DEFAULTS[key]
        except (TypeError, ValueError):
            value = _DEFAULTS[key]
        assumptions[key] = value

    configured = (
        assumptions["cost_per_sapling"] is not None
        and assumptions["cost_per_sapling"] >= 0
        and assumptions["planting_cost_per_tree"] is not None
        and assumptions["planting_cost_per_tree"] >= 0
    )
    return {"configured": configured, "values": assumptions}


def format_inr(amount):
    """Format a number as Indian grouped rupees (e.g. 12,34,000)."""
    amount = int(round(amount))
    s = str(abs(amount))
    if len(s) <= 3:
        digits = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        groups = []
        while rest:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        digits = ",".join(groups) + "," + last3
    return ("-" if amount < 0 else "") + digits


def estimate_budget(tree_count, years=1):
    """Estimate the planning-level intervention budget for ``tree_count``.

    Returns a dict with ``available`` (bool), the assumptions used, line
    items, a total, the visible formula, and a ``reason`` when unavailable.
    """
    try:
        tree_count = max(0, int(tree_count))
    except (TypeError, ValueError):
        tree_count = 0

    try:
        years = int(years)
    except (TypeError, ValueError):
        years = 1
    if years not in ALLOWED_MAINTENANCE_YEARS:
        years = 1

    cfg = budget_assumptions()
    if not cfg["configured"]:
        return {
            "available": False,
            "reason": (
                "Budget estimate unavailable \u2014 configure local cost "
                "assumptions."
            ),
            "assumptions": cfg["values"],
            "formula": FORMULA,
            "disclosure": DISCLOSURE,
        }

    v = cfg["values"]
    sapling_cost = tree_count * v["cost_per_sapling"]
    planting_cost = tree_count * v["planting_cost_per_tree"]
    maintenance_cost = tree_count * v["maintenance_cost_per_tree_per_year"] * years
    total = sapling_cost + planting_cost + maintenance_cost

    return {
        "available": True,
        "tree_count": tree_count,
        "maintenance_years": years,
        "assumptions": {
            "cost_per_sapling_inr": v["cost_per_sapling"],
            "planting_cost_per_tree_inr": v["planting_cost_per_tree"],
            "maintenance_cost_per_tree_per_year_inr": v[
                "maintenance_cost_per_tree_per_year"
            ],
        },
        "line_items": {
            "sapling_cost_inr": round(sapling_cost, 2),
            "planting_labour_inr": round(planting_cost, 2),
            "maintenance_inr": round(maintenance_cost, 2),
        },
        "total_estimate_inr": round(total, 2),
        "total_estimate_inr_formatted": "₹" + format_inr(total),
        "formula": FORMULA,
        "disclosure": DISCLOSURE,
        "method": (
            "Planning estimate from configurable cost assumptions. Not an "
            "official tender or audited expenditure."
        ),
    }
