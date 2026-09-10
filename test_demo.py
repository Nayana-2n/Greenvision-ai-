import requests, json, sys
for path in sys.argv[1:]:
    try:
        r = requests.post("http://localhost:5000/api/analyze",
            files={"image": ("img.jpg", open(path, "rb"), "image/jpeg")}, timeout=600)
        d = r.json()
        print(path)
        print("  status:", r.status_code)
        if r.status_code != 200:
            print("  error:", d.get("error"))
            continue
        scene = d.get("scene")
        detected = d.get("detected_trees")
        method = d.get("tree_detection_method")
        sp = d.get("species")
        print("  scene:", scene, "| detected_trees:", detected, "| method:", method)
        if sp:
            print("  species:", json.dumps(sp, indent=2))
        else:
            print("  species: []")
    except Exception as e:
        print(path, "EXC", e)