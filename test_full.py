"""Full regression: start server as subprocess, run all checks."""
import subprocess, time, sys, requests, os, json

PYTHON = r"C:\Users\naya1\AppData\Local\Programs\Python\Python311\python.exe"
SERVER_DIR = os.path.join(os.path.dirname(__file__), "server")
IMG = os.path.join(os.path.dirname(__file__), "demo", "low_canopy_urban_aerial.jpg")
BASE = "http://localhost:5000"
PASS = 0
FAIL = 0

def check(label, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [PASS] {label} -- {detail}")
    else:
        FAIL += 1
        print(f"  [FAIL] {label} -- {detail}")

proc = subprocess.Popen(
    [PYTHON, "app.py"],
    cwd=SERVER_DIR,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
)

try:
    for _ in range(30):
        time.sleep(1)
        try:
            r = requests.get(f"{BASE}/api/health", timeout=2)
            if r.status_code == 200:
                break
        except:
            pass
    else:
        print("TIMEOUT"); sys.exit(1)

    # A. ML Analyze
    print("\nA. ML Analyze")
    with open(IMG, "rb") as f:
        r = requests.post(f"{BASE}/api/analyze", files={"image": f}, timeout=180)
    d = r.json()
    check("Analyze returns 200", r.status_code == 200, f"status={r.status_code}")
    check("Canopy = 7.92%", d.get("green_cover_percentage") == 7.92, f"got {d.get('green_cover_percentage')}")
    check("Trees = 156", d.get("estimated_trees") == 156, f"got {d.get('estimated_trees')}")
    check("Priority = High", d.get("plantation_priority") == "High", f"got {d.get('plantation_priority')}")
    check("CO2 = 3.43", d.get("carbon_tonnes_per_year") == 3.43, f"got {d.get('carbon_tonnes_per_year')}")
    check("O2 = 18.41", d.get("oxygen_tonnes_per_year") == 18.41, f"got {d.get('oxygen_tonnes_per_year')}")
    check("Scene = street", d.get("scene") == "street", f"got {d.get('scene')}")
    check("Area = 0.5191 ha", d.get("forest_area_hectares") == 0.5191, f"got {d.get('forest_area_hectares')}")

    # B. Species Divergence
    print("\nB. Species Divergence")
    scene_beng = {"scene": "street", "green_cover_percentage": 7.92, "canopy_percentage": 7.92,
                  "estimated_trees": 156, "forest_area_hectares": 0.5191, "forest_area_m2": 5190.94,
                  "total_pixels": 1048576, "scale_used": 0.25, "plantation_priority": "High"}
    rB = requests.post(f"{BASE}/api/plant/recommend",
        json={"lat": 12.97, "lng": 77.59, "scene": scene_beng}, timeout=30).json()
    rL = requests.post(f"{BASE}/api/plant/recommend",
        json={"lat": 34.15, "lng": 77.58, "scene": {"scene": "desert", "green_cover_percentage": 2.1, "canopy_percentage": 2.1, "estimated_trees": 45, "forest_area_hectares": 0.1}}, timeout=30).json()
    bSp = [s["common_name"] for s in rB.get("species", [])]
    lSp = [s["common_name"] for s in rL.get("species", [])]
    check("Bengaluru has species", len(bSp) > 0, bSp[:2])
    check("Leh has species", len(lSp) > 0, lSp[:2])
    check("Bengaluru != Leh top species", bSp[:2] != lSp[:2], f"B={bSp[:2]} L={lSp[:2]}")
    target = rB.get("target", {})
    check("Bengaluru trees_needed", target.get("trees_needed") == 1026, f"got {target.get('trees_needed')}")
    check("Bengaluru budget available", "budget" in rB, "yes")

    # C. Chatbot Intents
    print("\nC. Chatbot Intents")
    ctx = {**d, "location": {"name": "Bengaluru", "latitude": 12.97, "longitude": 77.59},
           "_plantCtx": {"name": "Bengaluru", "latitude": 12.97, "longitude": 77.59,
                         "climate": {"zone": "tropical"}}}

    rC = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "How much will 100 trees cost?", "context": ctx}, timeout=10).json()
    check("Cost intent detected", rC.get("intent") == "cost", f"got {rC.get('intent')}")
    check("Cost mentions INR", "INR" in rC.get("reply", ""), rC.get("reply", "")[:80])

    rW = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "Why was Neem recommended?", "context": ctx}, timeout=10).json()
    check("Species-why detected", rW.get("intent") == "species_why", f"got {rW.get('intent')}")
    check("Species-why has factors", "scored" in rW.get("reply", "").lower() or "factors" in rW.get("reply", "").lower(), rW.get("reply", "")[:80])

    rT = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "How many degrees will this reduce temperature?", "context": ctx}, timeout=10).json()
    check("Thermal refusal", rT.get("intent") == "impact_unavailable", f"got {rT.get('intent')}")
    check("Thermal refusal honest", "not currently" in rT.get("reply", "").lower() or "don't have" in rT.get("reply", "").lower() or "not validated" in rT.get("reply", "").lower() or "unable" in rT.get("reply", "").lower() or "cannot" in rT.get("reply", "").lower() or "can't" in rT.get("reply", "").lower(), rT.get("reply", "")[:120])

    rPoll = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "How much will pollution decrease?", "context": ctx}, timeout=10).json()
    check("Industrial pollution refusal", rPoll.get("intent") in ("impact_unavailable", "fallback"), f"got {rPoll.get('intent')}")

    # Greeting
    rHi = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "hii", "context": ctx}, timeout=10).json()
    check("Greeting returns greeting intent", rHi.get("intent") == "greeting", f"got {rHi.get('intent')}")
    check("Greeting mentions GreenVision", "GreenVision" in rHi.get("reply", ""), rHi.get("reply", "")[:80])

    # Thanks
    rThx = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "thanks", "context": ctx}, timeout=10).json()
    check("Thanks intent", rThx.get("intent") == "thanks", f"got {rThx.get('intent')}")

    # What can you do
    rHelp = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "what can you do", "context": ctx}, timeout=10).json()
    check("Help intent", rHelp.get("intent") == "help", f"got {rHelp.get('intent')}")
    check("Help mentions species", "species" in rHelp.get("reply", "").lower() or "tree" in rHelp.get("reply", "").lower(), rHelp.get("reply", "")[:80])

    rCtx = requests.post(f"{BASE}/api/advisor/ask",
        json={"message": "Why is that?", "context": ctx,
              "conversation_history": [{"sender": "user", "text": "What tree should I plant?"},
                          {"sender": "bot", "text": "Neem recommended"}]}, timeout=10).json()
    check("Follow-up with context", rCtx.get("intent") in ("species_why", "species_why_prompt", "species_recommend", "species_water"), f"got {rCtx.get('intent')}")

    # D. Climate Simulate
    print("\nD. Climate Simulate")
    rD = requests.post(f"{BASE}/api/climate/simulate", json={"treeCount": 500}, timeout=10).json()
    check("Climate: 500 trees", rD.get("treeCount") == 500, f"got {rD.get('treeCount')}")
    check("Climate: CO2 = 11.0", rD.get("additional", {}).get("carbon_tonnes_per_year") == 11.0, f"got {rD.get('additional', {}).get('carbon_tonnes_per_year')}")

    # E. Location Context
    print("\nE. Location Context")
    rE = requests.post(f"{BASE}/api/location/context", json={"lat": 12.97, "lng": 77.59}, timeout=30).json()
    check("Location: has blocks", "blocks" in rE, f"keys={list(rE.keys())[:5]}")
    check("Location: weather", rE.get("blocks", {}).get("weather") is not None, "yes")

    # F. Leaderboard
    print("\nF. Leaderboard")
    rF = requests.get(f"{BASE}/api/leaderboard", timeout=10).json()
    check("Leaderboard: entries", len(rF) > 0, f"count={len(rF)}")

    # G. Reports
    print("\nG. Reports")
    rG = requests.get(f"{BASE}/api/reports", timeout=10).json()
    check("Reports: entries", len(rG) > 0, f"count={len(rG)}")

    # H. Contributions
    print("\nH. Contributions")
    rH = requests.get(f"{BASE}/api/contributions", timeout=10).json()
    items = rH.get("items", []) if isinstance(rH, dict) else rH
    check("Contributions: entries", len(items) > 0, f"count={len(items)}")

    # I. Historical Upload
    print("\nI. Historical Upload")
    with open(IMG, "rb") as f:
        rI = requests.post(f"{BASE}/api/historical/upload",
            files={"file": f}, data={"year": "2024"}, timeout=30)
    check("Historical upload: 200", rI.status_code == 200, f"status={rI.status_code}")

    # J. Server stability
    print("\nJ. Server Stability")
    rJ = requests.get(f"{BASE}/api/health", timeout=5)
    check("Server alive after all tests", rJ.status_code == 200, "yes")

    print(f"\n{'='*50}")
    print(f"RESULTS: {PASS} passed, {FAIL} failed out of {PASS+FAIL}")
    if FAIL == 0:
        print("ALL CHECKS PASSED")
    print("="*50)

finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except:
        proc.kill()
