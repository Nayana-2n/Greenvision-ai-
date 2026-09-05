"""
contributions.py
================

Green Contribution records + Green Points + the GREEN CHAMPIONS leaderboard.

Honesty contract
----------------
* Green Points are PRODUCT GAMIFICATION points — a participation score, NOT a
  scientific measurement. A point total is never converted to CO2/O2/rupees.
* Photo evidence is stored and shown, but there is NO AI verification in this
  release. Every contribution is "Community reported" and remains
  "Verification pending". Verification is a PLANNED feature.
* Identity is demo-grade: a browser-generated contributor ID + editable display
  name. There are no accounts or passwords.
* Storage is flat JSON in server/data/contributions (same pattern as reports).
"""

import json
import logging
import os
import random
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
DATA_DIR = SERVER_DIR / "data"
CONTRIBUTIONS_DIR = DATA_DIR / "contributions"
EVIDENCE_DIR = DATA_DIR / "uploads" / "evidence"
CONTRIBUTIONS_DIR.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("greenvision")

ALLOWED_EVIDENCE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_EVIDENCE_MB = 8

# ---------------------------------------------------------------------------
# Action catalogue + Green Points (product gamification values).
# ---------------------------------------------------------------------------

ACTIONS = {
    "plant_tree": {
        "label": "Planted a tree",
        "points": 100,
    },
    "maintain_tree": {
        "label": "Maintained a tree",
        "points": 50,
    },
    "community_plantation": {
        "label": "Community plantation",
        "points": 100,
    },
    "green_space_project": {
        "label": "Green-space project",
        "points": 300,
    },
}

POINTS_DISCLAIMER = (
    "Green Points are a participation score for motivating action. They are "
    "not a scientific measurement and do not correspond to a fixed amount of "
    "CO2, oxygen or rupees."
)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _cid():
    return f"GV-C-{uuid.uuid4().hex[:8].upper()}"


def _safe_id(value):
    return re.sub(r"[^A-Za-z0-9._-]", "", value or "")[:64]


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def _path(cid):
    return CONTRIBUTIONS_DIR / f"{_safe_id(cid)}.json"


def get_contribution(cid):
    path = _path(cid)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def list_contributions(limit=200):
    entries = []
    for path in CONTRIBUTIONS_DIR.glob("*.json"):
        try:
            entries.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    entries.sort(key=lambda c: c.get("created_at") or "", reverse=True)
    return entries[:limit]


def save_contribution(payload):
    """Create a contribution record. Returns (record, error)."""
    action = (payload or {}).get("action_type")
    if action not in ACTIONS:
        return None, "action_type must be one of: " + ", ".join(sorted(ACTIONS))
    date = (payload.get("date") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        return None, "date must be YYYY-MM-DD."
    contributor_id = (payload.get("contributor_id") or "").strip() or "anonymous"
    name = (payload.get("contributor_name") or "").strip() or "Green Citizen"
    lat = payload.get("latitude")
    lng = payload.get("longitude")
    try:
        lat = round(float(lat), 6) if lat not in (None, "") else None
        lng = round(float(lng), 6) if lng not in (None, "") else None
    except (TypeError, ValueError):
        lat = lng = None

    record = {
        "id": _cid(),
        "action_type": action,
        "action_label": ACTIONS[action]["label"],
        "points": ACTIONS[action]["points"],
        "date": date,
        "latitude": lat,
        "longitude": lng,
        "place_name": (payload.get("place_name") or "").strip() or None,
        "description": (payload.get("description") or "").strip()[:1000] or None,
        "contributor_name": name[:80],
        "contributor_id": contributor_id[:64],
        "organization_type": (payload.get("organization_type") or "").strip() or None,
        "organization_name": (payload.get("organization_name") or "").strip() or None,
        "evidence": None,
        "status": "community_reported",
        "verification_status": "pending",
        "verification_note": (
            "Photo verification is not implemented in this release. "
            "Contributions are community-reported and remain pending "
            "verification."
        ),
        "demo": bool(payload.get("demo", False)),
        "created_at": _now_iso(),
    }
    path = _path(record["id"])
    path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record, None


def attach_evidence(cid, filename):
    """Attach an uploaded evidence file name to a contribution."""
    record = get_contribution(cid)
    if record is None:
        return None, "Contribution not found."
    record["evidence"] = filename
    path = _path(cid)
    path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record, None


def evidence_path(cid):
    """Return (path, error) for a contribution's evidence file."""
    record = get_contribution(cid)
    if record is None:
        return None, "Contribution not found."
    if not record.get("evidence"):
        return None, "No evidence photo for this contribution."
    path = EVIDENCE_DIR / record["evidence"]
    if not path.exists():
        return None, "Evidence file missing."
    return path, None


# ---------------------------------------------------------------------------
# Leaderboard (GREEN CHAMPIONS — individual, top 100).
# ---------------------------------------------------------------------------

def _aggregate(limit=500):
    """Aggregate contributions per contributor_id.

    Returns dict keyed by contributor_id with name/points/counts, plus the
    full roster for rank lookups.
    """
    aggregates = {}
    for c in list_contributions(limit=limit):
        cid = c.get("contributor_id") or "anonymous"
        name = c.get("contributor_name") or "Green Citizen"
        agg = aggregates.setdefault(
            cid,
            {"id": cid, "name": name, "points": 0, "contributions": 0, "verified": 0},
        )
        agg["name"] = name  # keep the most recent display name
        agg["points"] += int(c.get("points") or 0)
        agg["contributions"] += 1
        if c.get("verification_status") == "verified":
            agg["verified"] += 1
    return aggregates


def leaderboard(limit=100):
    """Aggregate contributions per contributor; rank by Green Points.

    Returns (board, disclaimer). Board entries: rank, name, points,
    contributions, verified_contributions.
    """
    aggregates = _aggregate()
    rows = sorted(
        aggregates.values(),
        key=lambda a: (a["points"], a["contributions"], a["name"]),
        reverse=True,
    )[:limit]

    board = []
    for rank, a in enumerate(rows, start=1):
        board.append({
            "rank": rank,
            "name": a["name"],
            "points": a["points"],
            "contributions": a["contributions"],
            "verified_contributions": a["verified"],
        })
    return board, POINTS_DISCLAIMER


def position_of(contributor_id, limit=100):
    """Return {rank, name, points} for the user, or None if not ranked."""
    contributor_id = (contributor_id or "").strip()
    if not contributor_id:
        return None
    aggregates = _aggregate()
    if contributor_id not in aggregates:
        return None
    user = aggregates[contributor_id]
    rows = sorted(
        aggregates.values(),
        key=lambda a: (a["points"], a["contributions"], a["name"]),
        reverse=True,
    )[:limit]
    rank = next((i + 1 for i, a in enumerate(rows) if a["id"] == contributor_id), None)
    if rank is None:
        return None
    return {
        "rank": rank,
        "name": user["name"],
        "points": user["points"],
        "contributions": user["contributions"],
    }


# ---------------------------------------------------------------------------
# Organisation leaderboard — aggregate contributions by organisation.
# ---------------------------------------------------------------------------

_VALID_ORG_TYPES = {"company", "college", "school", "ngo", "community"}


def org_leaderboard(org_type=None, limit=50):
    """Aggregate contributions by organisation.

    Returns a list of dicts: {name, type, participants, contributions, points}.
    ``org_type`` optionally filters to one type (company / college / ...).
    """
    orgs = {}
    for c in list_contributions(limit=500):
        otype = (c.get("organization_type") or "").strip().lower()
        oname = (c.get("organization_name") or "").strip()
        if not otype or otype == "individual" or not oname:
            continue
        if otype not in _VALID_ORG_TYPES:
            continue
        if org_type and otype != org_type:
            continue
        key = f"{otype}::{oname.lower()}"
        agg = orgs.setdefault(key, {
            "name": oname,
            "type": otype,
            "participants": set(),
            "contributions": 0,
            "points": 0,
        })
        agg["participants"].add(c.get("contributor_id") or "anonymous")
        agg["contributions"] += 1
        agg["points"] += int(c.get("points") or 0)

    rows = []
    for agg in orgs.values():
        rows.append({
            "name": agg["name"],
            "type": agg["type"],
            "participants": len(agg["participants"]),
            "contributions": agg["contributions"],
            "points": agg["points"],
        })
    rows.sort(key=lambda a: (a["points"], a["contributions"], a["name"]), reverse=True)
    return rows[:limit]


# ---------------------------------------------------------------------------
# Demo seed data (approved for the demonstration).
# Deterministic so the leaderboard is stable. Marked ``demo: true``.
# ---------------------------------------------------------------------------

_DEMO_NAMES = [
    "Ananya Sharma", "Ravi Kumar", "Meera Nair", "Arjun Reddy", "Sneha Iyer",
    "Vikram Singh", "Priya Patel", "Karthik Rao", "Divya Menon", "Aditya Verma",
    "Nisha Agarwal", "Rohan Fernandes", "Priti Choudhary", "Amit Shetty", "Lata Kulkarni",
    "Manoj Sharma", "Swati Dixit", "Rajiv Menon", "Sunita Reddy", "Ajay Bhatt",
    "Geeta Kaur", "Deepa Mohan", "Kiran Patil", "Rekha Jolly", "Sudhir Pandey",
    "Asha Pillai", "Bharat Gowda", "Chitra Venkatesh", "Darshan Rao", "Fathima Beevi",
    "Girish Mallya", "Hema Devi", "Irfan Pathan", "Janaki Raman", "Kamala Nair",
    "Lingeswaran S", "Meenal Joshi", "Naveen Kumar", "Omkar Shinde", "Parvathi Menon",
    "Qadir Hussain", "Rajeshwari Devi", "Sunil Dutt", "Usha Rajan", "Venkatesh Iyer",
    "Waseem Ahmed", "Yamini Priya", "Zakir Khan", "Abhishek Pandey", "Bhavani Shankar",
    "Chandrika Prasad", "Durga Prasad", "Ezhil Selvan", "Firoz Shaikh", "Gopalakrishnan M",
    "Hari Prasad", "Indira Sarma", "Jai Shankar", "Keshav Raj", "Leela Devi",
    "Manasa Hegde", "Nagaraj S", "Opinder Singh", "Padmavathi R", "Rahul Bhat",
    "Sarojini Devi", "Tilak Raj", "Vasanthi Kumar", "Yogesh Naik", "Zareena Begum",
    "Arun Prakash", "Bhoomika R", "Chandan Singh", "Deepika Sharma", "Eswar Reddy",
    "Fauzia Khan", "Girija Shankar", "Harish Babu", "Indumathi P", "Jagdish Chandra",
    "Kamlesh Gupta", "Lalitha Bai", "Mohan Das", "Nirmala Devi", "Om Prakash",
    "Pushpa Latha", "Rajendra Prasad", "Savithri Amma", "Thirumalai R", "Uday Shankar",
    "Vani Shree", "Yashpal Singh", "Aarti Jha", "Balu Nair", "Chandrakala Devi",
    "Dhananjay Kumar", "Eknath Shinde", "Firdaus Ahmed", "Gopala Krishna", "Hemant Reddy",
    "Indrani Bose", "Jagadeesh N", "Kaveri R", "Lalitha Nair", "Murugesan S",
    "Nirmal Kaur", "Padma Shankar", "Raghunath Rao", "Sarojini D", "Trilochan Singh",
    "Usha Devi", "Venkataramana P", "Yamuna Bai", "Lakshmi Krishnan", "Rahul Joshi",
    "Pooja Desai", "Suresh Naidu", "Neha Gupta", "Farhan Ali", "Kavya Bhat",
    "Nikhil Das", "Ritika Bansal", "Mohammed Irfan", "Sanjay Pillai", "Aishwarya Hegde",
    "Varun Malhotra", "Shreya Kulkarni", "Harsha Vardhan", "Tanvi Sharma", "Ganesh Iyer",
    "Ishita Bose", "Rohit Mehta", "Anjali Nair", "Deepak Chandra", "Sana Sheikh",
    "Pranav Kulkarni", "Nandini Rao", "Vivek Anand", "Shruti Sinha", "Manish Tiwari",
    "Divya Suresh", "Arjun Nair", "Kavya Rao",
]

# Demo organisation assignments - colleges, companies, NGOs, communities.
_DEMO_ORGS = {
    0: ("company", "Infosys"),
    1: ("company", "Infosys"),
    10: ("company", "Wipro Technologies"),
    11: ("company", "Wipro Technologies"),
    12: ("company", "HCL Technologies"),
    13: ("company", "HCL Technologies"),
    14: ("company", "Reliance Industries"),
    15: ("company", "Reliance Industries"),
    18: ("company", "Tech Mahindra"),
    19: ("company", "Tech Mahindra"),
    80: ("company", "Tata Consultancy Services"),
    81: ("company", "Tata Consultancy Services"),
    82: ("company", "Mindtree"),
    83: ("company", "Mindtree"),
    84: ("company", "L&T Infotech"),
    85: ("company", "L&T Infotech"),
    86: ("company", "Flipkart"),
    87: ("company", "Flipkart"),
    88: ("company", "Zoho Corporation"),
    89: ("company", "Zoho Corporation"),
    2: ("college", "IISc Bengaluru"),
    3: ("college", "IISc Bengaluru"),
    20: ("college", "JSS Academy of Technical Education"),
    21: ("college", "JSS Academy of Technical Education"),
    22: ("college", "NITK Surathkal"),
    23: ("college", "NITK Surathkal"),
    24: ("college", "RV College of Engineering"),
    25: ("college", "RV College of Engineering"),
    26: ("college", "PES University"),
    27: ("college", "PES University"),
    28: ("college", "BMS College of Engineering"),
    29: ("college", "BMS College of Engineering"),
    30: ("college", "MS Ramaiah Institute of Technology"),
    31: ("college", "MS Ramaiah Institute of Technology"),
    32: ("college", "IIIT Bengaluru"),
    33: ("college", "IIIT Bengaluru"),
    34: ("college", "Manipal Institute of Technology"),
    35: ("college", "Manipal Institute of Technology"),
    36: ("college", "SRM Institute of Science and Technology"),
    37: ("college", "SRM Institute of Science and Technology"),
    38: ("college", "VIT Vellore"),
    39: ("college", "VIT Vellore"),
    90: ("college", "Christ University Bengaluru"),
    91: ("college", "Christ University Bengaluru"),
    92: ("college", "Bangalore University"),
    93: ("college", "Bangalore University"),
    94: ("college", "Jain College Bengaluru"),
    95: ("college", "Jain College Bengaluru"),
    96: ("college", "St. Josephs College of Engineering"),
    97: ("college", "St. Josephs College of Engineering"),
    98: ("college", "Dayananda Sagar College of Engineering"),
    99: ("college", "Dayananda Sagar College of Engineering"),
    100: ("college", "New Horizon College of Engineering"),
    101: ("college", "New Horizon College of Engineering"),
    4: ("ngo", "Hasiru Dala"),
    5: ("ngo", "Hasiru Dala"),
    40: ("ngo", "Green Bangalore Association"),
    41: ("ngo", "Green Bangalore Association"),
    42: ("ngo", "Bangalore Environment Trust"),
    43: ("ngo", "Bangalore Environment Trust"),
    44: ("ngo", "Arghyam Foundation"),
    45: ("ngo", "Arghyam Foundation"),
    46: ("ngo", "Jhatkaa.org"),
    47: ("ngo", "Jhatkaa.org"),
    48: ("ngo", "eCoexist Foundation"),
    49: ("ngo", "eCoexist Foundation"),
    50: ("ngo", "Air Quality Monitoring Network"),
    51: ("ngo", "Air Quality Monitoring Network"),
    52: ("ngo", "Indus Women Collectives"),
    53: ("ngo", "Indus Women Collectives"),
    54: ("ngo", "Open Space Foundation"),
    55: ("ngo", "Open Space Foundation"),
    56: ("ngo", "Nirmiti Kendra"),
    57: ("ngo", "Nirmiti Kendra"),
    58: ("ngo", "SankalpTaru Foundation"),
    59: ("ngo", "SankalpTaru Foundation"),
    6: ("community", "Koramangala Green Collective"),
    7: ("community", "Koramangala Green Collective"),
    60: ("community", "Whitefield Rising"),
    61: ("community", "Whitefield Rising"),
    62: ("community", "Indiranagar Green Brigade"),
    63: ("community", "Indiranagar Green Brigade"),
    64: ("community", "HSR Layout Residents Association"),
    65: ("community", "HSR Layout Residents Association"),
    66: ("community", "JP Nagar Tree Guardians"),
    67: ("community", "JP Nagar Tree Guardians"),
    68: ("community", "BTM Green Warriors"),
    69: ("community", "BTM Green Warriors"),
    70: ("community", "Jayamahal Park Friends"),
    71: ("community", "Jayamahal Park Friends"),
    72: ("community", "Malleshwaram Greens"),
    73: ("community", "Malleshwaram Greens"),
    74: ("community", "Electronic City Eco Club"),
    75: ("community", "Electronic City Eco Club"),
    76: ("community", "Sarjapur Road Green Alliance"),
    77: ("community", "Sarjapur Road Green Alliance"),
    78: ("community", "Yelahanka Urban Forest Club"),
    79: ("community", "Yelahanka Urban Forest Club"),
    102: ("community", "Hebbal Lake Conservation Group"),
    103: ("community", "Hebbal Lake Conservation Group"),
    104: ("community", "Frazer Town Green Alliance"),
    105: ("community", "Frazer Town Green Alliance"),
    106: ("community", "Bannerghatta Wildlife Support"),
    107: ("community", "Bannerghatta Wildlife Support"),
    108: ("community", "Basavanagudi Green Army"),
    109: ("community", "Basavanagudi Green Army"),
    110: ("community", "Vijayanagar Tree Planters"),
    111: ("community", "Vijayanagar Tree Planters"),
    112: ("community", "Rajajinagar Eco Warriors"),
    113: ("community", "Rajajinagar Eco Warriors"),
    114: ("community", "Nagasandra Green Cell"),
    115: ("community", "Nagasandra Green Cell"),
    116: ("community", "Peenya Industrial Green Zone"),
    117: ("community", "Peenya Industrial Green Zone"),
    118: ("community", "Kengeri Habitat Friends"),
    119: ("community", "Kengeri Habitat Friends"),
}

_DEMO_PLACES = [
    ("Bengaluru", 12.9766, 77.5929), ("Mysuru", 12.2958, 76.6394),
    ("Hyderabad", 17.3850, 78.4867), ("Pune", 18.5204, 73.8567),
    ("Chennai", 13.0827, 80.2707), ("Mumbai", 19.0760, 72.8777),
]

_DEMO_ACTIONS = ["plant_tree", "maintain_tree", "community_plantation", "green_space_project"]

_SEED_LOCK = False


def ensure_seeded():
    """Seed ~40 demo contributions the first time the module is used.

    Idempotent (only when the directory is empty) and disabled by setting
    GV_SEED_DEMO=0. Every seeded record is flagged ``demo: true`` so the UI
    can show a "demo data" disclosure.
    """
    global _SEED_LOCK
    if _SEED_LOCK:
        return
    if os.environ.get("GV_SEED_DEMO", "1") == "0":
        _SEED_LOCK = True
        return
    existing = list(CONTRIBUTIONS_DIR.glob("*.json"))
    if existing:
        _SEED_LOCK = True
        return
    rng = random.Random(2026)
    created = 0
    for idx, name in enumerate(_DEMO_NAMES):
        place = _DEMO_PLACES[idx % len(_DEMO_PLACES)]
        action = _DEMO_ACTIONS[idx % len(_DEMO_ACTIONS)]
        org_info = _DEMO_ORGS.get(idx)
        # Points skew: wider spread so org rankings are meaningful.
        repeat = rng.choice([1, 1, 2, 3, 4, 5, 6, 8, 10])
        for _ in range(repeat):
            date = f"2026-{rng.randint(1, 8):02d}-{rng.randint(1, 28):02d}"
            payload = {
                "action_type": action,
                "date": date,
                "contributor_id": f"demo-{idx:02d}",
                "contributor_name": name,
                "latitude": place[1],
                "longitude": place[2],
                "place_name": place[0],
                "description": "Demo contribution seeded for the Green Champions board.",
                "demo": True,
            }
            if org_info:
                payload["organization_type"] = org_info[0]
                payload["organization_name"] = org_info[1]
            record, err = save_contribution(payload)
            if record:
                created += 1
    logger.info("Seeded %d demo contributions.", created)
    _SEED_LOCK = True
