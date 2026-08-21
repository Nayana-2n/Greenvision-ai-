"""
Diagnostic: Start server as subprocess, test HTTP file upload.
This avoids Start-Job issues.
"""
import subprocess, time, sys, requests, os

PYTHON = r"C:\Users\naya1\AppData\Local\Programs\Python\Python311\python.exe"
SERVER_DIR = os.path.join(os.path.dirname(__file__), "server")
IMG = os.path.join(os.path.dirname(__file__), "demo", "low_canopy_urban_aerial.jpg")
PORT = 5000
BASE = f"http://localhost:{PORT}"

print("=== GREENVISION SERVER DIAGNOSTIC ===")
print(f"Python: {PYTHON}")
print(f"Server dir: {SERVER_DIR}")
print(f"Image: {IMG} ({os.path.getsize(IMG)} bytes)")

# Start server
print("\n[1] Starting server...")
proc = subprocess.Popen(
    [PYTHON, "app.py"],
    cwd=SERVER_DIR,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
)
print(f"    PID: {proc.pid}")

# Wait for server to be ready
print("\n[2] Waiting for server...")
for i in range(30):
    time.sleep(1)
    try:
        r = requests.get(f"{BASE}/api/health", timeout=2)
        if r.status_code == 200:
            print(f"    Server ready after {i+1}s")
            break
    except:
        pass
else:
    print("    TIMEOUT: Server not ready after 30s")
    proc.terminate()
    proc.wait()
    sys.exit(1)

# Test 1: Health check
print("\n[3] Health check...")
try:
    r = requests.get(f"{BASE}/api/health", timeout=5)
    print(f"    Status: {r.status_code}")
    print(f"    Body: {r.json()}")
except Exception as e:
    print(f"    FAILED: {e}")

# Test 2: ML Analyze (file upload)
print("\n[4] ML Analyze (file upload)...")
try:
    with open(IMG, "rb") as f:
        r = requests.post(f"{BASE}/api/analyze", files={"image": f}, timeout=180)
    print(f"    Status: {r.status_code}")
    d = r.json()
    print(f"    canopy={d.get('canopy_pct')} trees={d.get('trees')} scene={d.get('scene')} priority={d.get('plantation_priority')}")
except Exception as e:
    print(f"    FAILED: {e}")
    # Check if server is still alive
    try:
        r2 = requests.get(f"{BASE}/api/health", timeout=5)
        print(f"    Server still alive: {r2.status_code}")
    except:
        print("    Server DIED!")
        # Get server output
        proc.terminate()
        proc.wait()
        output = proc.stdout.read().decode(errors='replace')
        print(f"\n    SERVER STDOUT/STDERR:\n{output[-3000:]}")
        sys.exit(1)

# Test 3: Health check AFTER analyze
print("\n[5] Health check after analyze...")
try:
    r = requests.get(f"{BASE}/api/health", timeout=5)
    print(f"    Status: {r.status_code} pipeline_loaded={r.json().get('pipeline_loaded')}")
except Exception as e:
    print(f"    FAILED: {e}")

# Test 4: Second analyze
print("\n[6] Second analyze...")
try:
    with open(IMG, "rb") as f:
        r = requests.post(f"{BASE}/api/analyze", files={"image": f}, timeout=180)
    print(f"    Status: {r.status_code}")
    d = r.json()
    print(f"    canopy={d.get('canopy_pct')} trees={d.get('trees')}")
except Exception as e:
    print(f"    FAILED: {e}")

# Test 5: Non-upload endpoints
print("\n[7] Climate simulate...")
try:
    r = requests.post(f"{BASE}/api/climate/simulate", json={"treeCount": 100}, timeout=10)
    print(f"    Status: {r.status_code}")
except Exception as e:
    print(f"    FAILED: {e}")

print("\n[8] Advisor...")
try:
    r = requests.post(f"{BASE}/api/advisor/ask", json={"message": "what tree should I plant"}, timeout=10)
    print(f"    Status: {r.status_code}")
except Exception as e:
    print(f"    FAILED: {e}")

print("\n[9] Leaderboard...")
try:
    r = requests.get(f"{BASE}/api/leaderboard", timeout=10)
    print(f"    Status: {r.status_code}")
except Exception as e:
    print(f"    FAILED: {e}")

print("\n[10] Historical upload...")
try:
    with open(IMG, "rb") as f:
        r = requests.post(f"{BASE}/api/historical/upload",
            files={"file": f},
            data={"year": "2024"},
            timeout=30)
    print(f"    Status: {r.status_code}")
    print(f"    Body: {r.text[:200]}")
except Exception as e:
    print(f"    FAILED: {e}")
    # Check if server survived
    try:
        r2 = requests.get(f"{BASE}/api/health", timeout=5)
        print(f"    Server still alive: {r2.status_code}")
    except:
        print("    Server DIED!")
        proc.terminate()
        proc.wait()
        output = proc.stdout.read().decode(errors='replace')
        print(f"\n    SERVER STDOUT/STDERR:\n{output[-3000:]}")
        sys.exit(1)

# Cleanup
print("\n[CLEANUP] Stopping server...")
proc.terminate()
try:
    proc.wait(timeout=5)
except:
    proc.kill()

print("\n=== DIAGNOSTIC COMPLETE ===")
