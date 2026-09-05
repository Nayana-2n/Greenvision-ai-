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
  - Add environment variable `VITE_API_URL` = your HuggingFace Space URL (see `.env.example`).
- **Backend**: Deployed as a [HuggingFace Space](https://huggingface.co/docs/hub/spaces) (free CPU runtime, 16 GB RAM) using the repo-root `Dockerfile`.
  - Create a new Space and choose **Docker** for the SDK/Space runtime, then import/push this GitHub repo.
  - The Space reads `PORT` (HuggingFace sets it to `7860`) — no other config needed.
  - Trained model weights live in `Tree_AI_Backend/models/` and ship inside the image.

### Live architecture
```
Browser (Vercel: greenvision-ai/dist)
   ├── /api/analyze      ─┐
   ├── /api/climate/...  ─┼─► HuggingFace Space (Flask + AI Engine on CPU)
   ├── /api/chatbot      ─┘
   └── real Open-Meteo / Nominatim calls made directly from the browser
```

### Demo image
A ready-to-run sample scene ships with a one-click "Try a sample scene" button on the Analyze page
(`greenvision-ai/public/sample-scene.jpg`, sourced from `demo/low_canopy_urban_aerial.jpg`).
