# Demo Assets & Runbook

Four files — two high-canopy forest scenes plus one **low-canopy urban scene** in four encodings. Use them to show how scene type and georeferencing change the analysis. All values below were verified live against the running backend (sparse.pt canopy segmentation + street.pt trunk detector + scene classifier).

| File | Type | What it demonstrates | Verified result |
|---|---|---|---|
| `bengaluru_cubbon_park.tif` | GeoTIFF | Real georeferencing: **EPSG:32643 (UTM 43N), 0.30 m/px ground scale, GPS pin at Cubbon Park** | 90.21% canopy, **Dense** density, **7,662 trees**, 8.51 ha, 168.56 t CO₂/yr, 904.12 t O₂/yr |
| `bengaluru_cubbon_park.jpg` | JPEG | Same scene without metadata → honest **default scale (0.25 m/px)** + **No GPS** path | 90.16% canopy, **Dense** density, **5,318 trees**, 5.91 ha, 117.00 t CO₂/yr, 627.52 t O₂/yr |
| `hero_aerial.jpg` | JPEG | Quick second scene for the plain upload flow | 86.16% canopy, **Dense** density, **5,082 trees**, 5.65 ha, 111.80 t CO₂/yr, 599.68 t O₂/yr |
| `low_canopy_urban_aerial.jpg` | JPEG | A **low-canopy urban/industrial** scene — the honest contrast case: colourful roofs/roads (passes the reliability gate) with sparse real green crowns | 7.92% canopy, **Sparse** density, **156 trees**, 0.52 ha, 3.43 t CO₂/yr, 18.41 t O₂/yr, **High** plantation priority |

Same scene, different numbers — that is the point. Georeferencing (true ground resolution) is what makes the area/tree figures real: the GeoTIFF knows it is 0.30 m/px, so it covers 8.51 ha; the metadata-less JPEG is read at the 0.25 m/px default, so the same canopy covers 5.91 ha.

Scene label vs density class: the scene classifier labels the aerial-vegetation images `sparse` (~99% confidence — its nearest aerial class) and the urban scene `street` (~98% confidence); the canopy-density estimator measures 86–90% cover on the forest scenes (`Dense`, score 0.73–0.75) and 7.92% on the urban scene (`Sparse`, score 0.167). All are real outputs and all are shown honestly in the UI/report.

The low-canopy figure is **measured, not hard-coded** — the previous demo brief listed a placeholder "8.2% canopy / 988 trees / HIGH priority" that was never produced by the model. The current row is the actual live output of the pipeline on `demo/low_canopy_urban_aerial.jpg` (regenerate with `python generate_demo_assets.py`, re-analyze, and re-verify if the models change).

## Species classifier demo images

The species classifier only runs on **street scenes** (photo taken at ground level) where the trunk detector finds visible tree trunks. Each detected trunk is then classified by the DeepForest species model into Birch / Coniferous Tree / Deciduous Tree / Pine / Spruce / pinus spp. All values below are the live backend output (scene classifier + `street.pt` trunk detector + species `CropModel`).

| File | What it demonstrates | Verified result |
|---|---|---|
| `species_scots_pine.jpg` | Single isolated Scots pine at ground level | **street** scene, **2 trunks** detected → `Coniferous Tree` (0.62, 0.79) |
| `species_old_growth_forest.jpg` | Multi-trunk forest photo — species for every detected tree | **street** scene, **7 trunks** detected → `Coniferous Tree` (0.51–0.999) |
| `species_single_oak.jpg` | Single deciduous tree | **street** scene, **1 trunk** detected → `Deciduous Tree` (0.96) |
| `species_yellow_birch.jpg` | Real birch trunk photo — honest model behaviour | **street** scene, **2 trunks** detected → `Coniferous Tree` (0.998). The species model is not perfect: it reads this birch as coniferous, so report confidences alongside species. |

Graceful-failure cases (expected — keep these honest in demos): an aerial park image like `bengaluru_cubbon_park.jpg` returns no trunks (`detected_trees: null`, `species: []`); a fuzzy/distant "fir tree" photo was classified `sparse` with no trunks. Species output requires a crisp ground-level view of the trunk.

---

## 1. Start the app

```bash
# Backend (terminal 1)
cd server
venv\Scripts\activate
flask run --port 5000

# Frontend (terminal 2)
cd greenvision-ai
npm run dev
```

Open `http://localhost:5173`.

## 2. Demo flow (~4 minutes)

1. **Home** — hero + tagline. "AI-powered green cover assessment: canopy segmentation, tree estimates, carbon & oxygen math."
2. **Upload `hero_aerial.jpg`** (350 KB) → watch the processing animation → Dashboard.
   - Point out the **scale note**: *"0.25 m/px estimated — upload a GeoTIFF for real ground resolution."*
   - Point out **"Estimated Trees"** is a methodology-driven estimate, not detection.
3. **Upload `bengaluru_cubbon_park.tif`** — the flagship moment.
   - Dashboard shows **Ground scale: 0.30 m/px from metadata**.
   - Open **Map View** → marker pinned at **Cubbon Park, Bengaluru** (real coords from the GeoTIFF).
   - Contrast the numbers: 7,662 vs 5,318 trees, 8.51 vs 5.91 ha — *"the GeoTIFF knows its true scale."*
4. **Upload `low_canopy_urban_aerial.jpg`** — the low-canopy contrast.
   - Dashboard shows ~8% canopy, **Sparse** density, **High** plantation priority and a large planting gap to the 60% target — a real low-canopy reading, not a canned demo number.
   - The reliability gate passes (the scene is a real colour aerial), so the full planting-plan flow works.
5. **Climate Lab** — move the trees slider → numbers change live (real estimator math via backend).
6. **Species classifier (new)** — upload `species_old_growth_forest.jpg` (or `species_single_oak.jpg`) → the trunk detector counts the trees and the species model labels each one. Open **Climate Lab** → the "Estimated trees" card shows `Species: Coniferous Tree, Coniferous Tree, …` per detected trunk.
7. **ClimateGPT / Advisor** — ask *"How many trees are estimated?"* and *"What is the plantation recommendation?"*.
8. **Reports** — open the saved report; print/download; show the **Methodology & Assumptions** section.

## 3. Honest answers to likely questions

- **How do you count trees?** We don't detect each tree. Canopy cover (from segmentation) × a density heuristic (0.03–0.12 trees/m² by density class) gives an **estimated** count. The UI says "Estimated". For street scenes, a separate trunk detector counts visible trunks and reports that number distinctly.
- **Why do the two files give different numbers?** GeoTIFF carries real ground resolution (0.30 m/px); the JPEG falls back to a default 0.25 m/px, so areas are approximate.
- **Is that the real Cubbon Park?** The GeoTIFF is a georeferenced scene placed at Cubbon Park coordinates; the imagery is a procedurally rendered, representative aerial canopy sample (see `demo/generate_demo_assets.py`). It is a **proof-of-concept**.
- **Which models are actually used?** `models/sparse/best.pt` (trained canopy segmentation, ~45 MB) for every scene, `models/street/best.pt` (trained trunk detector) for street scenes, and the scene classifier. The old `models/dense/best.pt` was an untrained epoch-0 checkpoint and is retired.
- **Carbon/Oxygen?** Annual averages: 22 kg CO₂ and 118 kg O₂ per tree per year — clearly labeled as an estimate, not a full biomass model.
- **Is the Climate Lab real?** Yes — the sliders run the backend estimator, not a canned animation. The demo-only historical/heat sections are explicitly labeled demo.
- **AI model?** YOLO-based segmentation (canopy) + scene classification; density/heat badges are derived scores, shown as High/Medium/Low.

## 4. If something breaks

- Backend down? Check `http://localhost:5000/api/health` → expect `{"status":"ok"}`.
- No upload response? Restart Flask (`flask run --port 5000`) and retry.
- Frontend can't reach API? Confirm `greenvision-ai/.env` has `VITE_API_URL=http://localhost:5000` and **restart `npm run dev`** after changing it.
