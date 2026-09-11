# GreenVision.AI 🌿🛰️

AI-GIS Based Urban Green Cover Assessment for Carbon Sequestration, Oxygen Estimation and **Tree Species Identification from a photo**.

Built for **Innovate4Impact AI4SDG 2026** (Team I4I 633 · Problem Statement PS-I04).

---

## What it does

Upload **any** scene — a top-down aerial / satellite image OR a ground-level street photo — and GreenVision returns an honest environmental report:

| Output | Source |
|---|---|
| Scene type (`street` / `aerial` / `sparse`) + confidence | YOLO scene classifier |
| Green canopy cover %, forest area, density / fragmentation | Canopy segmentation model |
| Estimated tree count | canopy area × density heuristic (**not** individual detection) |
| **Measured** trunk count | YOLO tree-trunk detector (street scenes only) |
| **Per-trunk tree species + confidence** | DeepForest CropModel on each detected trunk |
| CO₂ offset / O₂ production (t/yr) | fixed per-tree arithmetic (22 / 118 kg) |
| Planting gap to 60% canopy target | transparent arithmetic |
| Species shortlist + budget estimates | rule-based planting engine conditioned on live weather/soil/elevation |
| Vegetation reliability gate | withholds every metric when the image is out-of-domain (never invents numbers) |

Design principle: **honesty over shine.** Every prediction ships with a confidence label; concepts without a validated model are shown as explicitly *not assessed* — never fabricated.

## Three modes

- **Municipal** — Green Cover Diagnosis command center: canopy, planting gap, plantation priority, per-trunk species, reports.
- **Industrial** — Site Green Buffer / compliance dashboard: buffer gap, ESG framing, **Tree Species on Site** (image-based), buffer-species planning.
- **Citizen** — personal green area: location-first, species advice, Green Champions contributions.

Navigation top bar and left sidebar share one source of truth (`src/utils/navLinks.js`), so modes never show dead-end links.

## Project Structure

```
greenvision-ai/
├── greenvision-ai/            # React 19 + Vite 8 + Tailwind v4 frontend
│   ├── src/pages/             # Dashboard, ClimateLab, Planting, Advisor, Reports, ...
│   ├── src/components/        # ImpactSimulator, MapView, EnvironmentalContext, ...
│   └── src/utils/             # navLinks, resultMapper, sceneMath, sceneStore, locationStore
├── server/                    # Flask 3 API (port 5000) + planning logic
└── Tree_AI_Backend/           # AI Engine
    ├── models/                # scene_classifier / sparse (canopy) / street (trunk) / dense(disabled)
    ├── species_model/         # per-trunk species weights (safetensors ~90 MB) + labels.json
    └── AI_Engine/             # pipeline.py (orchestration), router.py, inference.py, estimators/
```

## Running Locally

### 1. Backend (port 5000)

```bash
cd server
python -m venv venv
# Windows:  venv\Scripts\activate      # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
# CPU PyTorch is installed separately (see requirements.txt comment):
#   pip install torch==2.2.2+cpu torchvision==0.17.2+cpu --index-url https://download.pytorch.org/whl/cpu
python app.py
```

> Important: `numpy` is pinned to `1.26.4` and `deepforest==2.1.0` to `2.1.0`
> — a newer numpy breaks torch at import (`"Numpy is not available"`). If torch
> fails after an upgrade, force-reinstall `numpy==1.26.4`.

Health check: `GET /api/health` → `{"status":"ok","engine_available":true,"pipeline_loaded":true}`.

### 2. Frontend (port 5173)

```bash
cd greenvision-ai
npm install
npm run dev        # lint: npm run lint (oxlint) · build: npm run build
```

## Demo images (verified end-to-end)

Analyze any of these on the **Analyze** page, then open **Diagnosis** (Municipal) or **Site Buffer** (Industrial) — the TREE SPECIES card shows each trunk's species plus two **separate, never-conflated** metrics: **Coverage %** (measured trunk area ÷ image area, from the detector's bounding boxes) and **Confidence %** (the species classifier's per-trunk score). Coverage is computed from geometry, never approximated from confidence.

| File | Verified result |
|---|---|
| `demo/species_pine_reserve.jpg` | 2 trunks → **Pine 0.96** + Deciduous 0.95 |
| `demo/species_scots_pine_grove.jpg` | 7 trunks → **Pine 0.48** + Deciduous ×6 |
| `demo/species_silver_birch_grove.jpg` | 2 trunks → **Spruce 0.83** + Coniferous 0.71 |
| `demo/species_single_oak.jpg` | 1 trunk → **Deciduous 0.96** |
| `demo/species_old_growth_forest.jpg` | 7 trunks → Coniferous 0.51–0.999 |
| `demo/species_scots_pine.jpg` | 2 trunks → Coniferous 0.62 / 0.79 |
| `demo/species_yellow_birch.jpg` | 2 trunks → Coniferous 0.998 (honest miss — real birch read as coniferous; confidence makes the limitation visible) |
| `demo/low_canopy_urban_aerial.jpg` | canonical aerial: 156 trees, ~7.9% canopy, species `[]` |

All species photos are public-domain Wikimedia Commons imagery. Full table + graceful-failure cases in `demo/README.md`.

## Tests

```bash
python test_demo.py demo/species_pine_reserve.jpg   # quick per-image species check
python test_full.py                                 # full API regression (35/35)
```

## Deployment

- **Frontend**: Vercel — import the repo, Root Directory `greenvision-ai`, env `VITE_API_URL` (see `.env.example`).
- **Backend**: **Oracle Cloud Always Free** (ARM, 4 OCPU / 24 GB RAM) via `deploy/oracle_setup.sh` + systemd unit (`deploy/systemd`), full walkthrough in `DEPLOY_GUIDE.md`.

> The engine peaks near **639 MB RSS** (torch 1-thread, single-model eviction), so free tiers with 512 MB RAM (Render/Koyeb/Glitch) are not viable hosts.

### API endpoints (server/app.py)

```
GET  /api/health · POST /api/analyze · POST /api/climate/simulate
POST /api/advisor/ask · POST /api/location/context · /geocode · /reverse
POST /api/plant/recommend
POST /api/contributions (CRUD + evidence) · GET /api/leaderboard
GET  /api/reports (+ download) · GET /api/heatmaps/<file> · POST /api/compare · POST /api/historical/upload
```

## Honest limits (by design)

- No temperature-reduction, AQI/pollution-reduction or biodiversity-impact numbers — those models do not exist in the backend, so the UI never shows dead "UNAVAILABLE" tiles.
- `detected_trees` (measured trunk count) is never conflated with `estimated_trees` (area×density heuristic).
- `models/dense/best.pt` is an untrained epoch-0 checkpoint and is **disabled**; `models/sparse/best.pt` (the trained canopy model) runs for every scene type.
- Street scenes with measured canopy > 40% are flagged *indicative-only* because the canopy model can over-detect on roofs/roads/shadows.