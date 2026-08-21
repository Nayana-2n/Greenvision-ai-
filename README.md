# GreenVision.AI 🌿🛰️

AI-GIS Based Urban Green Cover Assessment for Carbon Sequestration and Oxygen Estimation.

## Team
- **Nayana**: Frontend, UI Architecture, GIS Integration (Leaflet & Chart.js), Flask Integration Layer.
- **Kasumurthi Rishitha Sree**: AI/ML Lead (Tree Detection & Segmentation Models, Ecological Impact Logic).

## Project Structure
```
greenvision-ai/
├── greenvision-ai/   # React + Vite + Tailwind CSS Frontend
└── server/           # Flask API Backend Shell
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
- **Frontend**: Deployed on [Vercel](https://vercel.com) (Root Directory: `greenvision-ai`).
- **Backend**: Deployed on [Render](https://render.com) (Root Directory: `server`, Start Command: `gunicorn app:app`).
