# GreenVision.AI 🌿🛰️

AI-GIS Based Urban Green Cover Assessment for Carbon Sequestration and Oxygen Estimation.



## Project Structure
```
greenvision-ai/
├── greenvision-ai/          # React + Vite + Tailwind CSS Frontend
├── server/                  # Flask API Backend
└── Tree_AI_Backend/         # AI Engine (YOLO + segmentation models, planning logic)
```

## Running Locally

### 1. Frontend
```bash
cd greenvision-ai
npm install
npm run dev
```
Runs at `http://localhost:5173`.

### 2. Backend
```bash
cd server
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```
Runs at `http://localhost:5000`.

## Deployment
- **Frontend**: Deployed on [Vercel](https://vercel.com).
  - Import the repo, set **Root Directory** to `greenvision-ai`.
  - Add environment variable `VITE_API_URL` = your backend URL (see `.env.example`).
- **Backend**: Deployed on **Oracle Cloud Always Free** (ARM, 4 OCPU / 24 GB RAM)
  using `deploy/oracle_setup.sh` (installs CPU PyTorch + systemd service on port 5000).
  Full walkthrough in `DEPLOY_GUIDE.md`.

> The tree-detection engine peaks near 650 MB RSS, so free tiers with 512 MB RAM
> (Render/Koyeb/Glitch) are not viable hosts for this stack.

### Live architecture
```
Browser (Vercel: greenvision-ai/dist)
   ├── /api/analyze      ─┐
   ├── /api/climate/...  ─┼─► Oracle Cloud free VM (Flask + AI Engine on CPU)
   ├── /api/chatbot      ─┘
   └── real Open-Meteo / Nominatim calls made directly from the browser
```

### Demo image
A ready-to-run sample scene ships with a one-click "Try a sample scene" button on the Analyze page
(`greenvision-ai/public/sample-scene.jpg`, sourced from `demo/low_canopy_urban_aerial.jpg`).

### Repo layout
```
Dockerfile / .dockerignore    # kept for reference (HuggingFace/other container hosts)
deploy/oracle_setup.sh        # Oracle Always Free provisioning (backend)
deploy/systemd                # service unit template
```
