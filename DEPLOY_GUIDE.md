# Deploying GreenVision.AI — Step-by-Step

GreenVision.AI is deployed as two pieces:
1. **Backend (Flask + AI Engine)** → HuggingFace Space (free CPU, 16 GB RAM).
   A `Dockerfile` at the repo root builds it. Model weights (~142 MB) are committed
   in `Tree_AI_Backend/models/` so the image contains everything.
2. **Frontend (React + Vite)** → Vercel (free). Served from the `greenvision-ai/` folder.

Time needed: ~20 minutes.

---

## Part 1 — HuggingFace Space (backend)

1. Go to https://huggingface.co and create a free account (or sign in).
2. Create the backend Space:
   - Top-right **+ New** → **Space**.
   - **Owner**: your username.
   - **Space name**: `greenvision-ai` (the URL will be the API host for the frontend).
   - **License**: MIT.
   - **SDK / Space hardware**: choose **Docker** (not Gradio/Streamlit).
   - **Space hardware**: `CPU basic · 2 vCPU · 16 GB · Free` ← important, newer
     accounts default to a paid GPU; switch it to the **free CPU** tier.
   - Click **Create Space**.
3. Push the code. The simplest way when the GitHub repo already exists:
   - Options in your Space page may let you import a GitHub repo directly.
   - Otherwise, from your repo root:
     ```bash
     git remote add hf https://huggingface.co/spaces/<USERNAME>/greenvision-ai
     git push hf main
     ```
   - Easiest reliable option: run `pip install huggingface_hub` then
     `huggingface_hub`'s `upload_folder` — or just follow the "Clone the repo"
     button on the Space page and drag-and-drop these paths into it:
     - `Dockerfile`, `.dockerignore` (repo root)
     - `server/`  (the whole folder)
     - `Tree_AI_Backend/` (the whole folder, **including `models/`**)
4. Wait for the build. It first downloads the Python image and CPU PyTorch
   (takes ~3–5 min), then copies the app. Watch the **Logs** tab: you should see
   ```
   Running on http://0.0.0.0:7860 (Press CTRL+C to quit)
   ```
   and the app is ready when `https://<USERNAME>-greenvision-ai.hf.space/api/health`
   returns `{"status":"ok",...}`.
5. First analyze will be slow (~2–5 min) because the Space is CPU-only and lazy-loads
   torch; every request after that is fast.

> If you get a 502/504 while building, stay on the Space page for a few minutes —
> the free tier sleeps when idle and cold-starts on demand (official behavior).

---

## Part 2 — Vercel (frontend)

1. Go to https://vercel.com → sign in with GitHub → **Add New Project**.
2. **Import** the `greenvision-ai` GitHub repository.
3. In the import screen set:
   - **Framework Preset**: Vite.
   - **Root Directory**: `greenvision-ai`.
   - **Build Command**: `npm run build`.
   - **Output Directory**: `dist`.
4. Add one environment variable (click **Environment Variables** → Production):
   - Name: `VITE_API_URL`
   - Value: `https://<USERNAME>-greenvision-ai.hf.space`
5. Click **Deploy**. Wait ~1–2 min. Vercel shows you the live URL
   (e.g. `https://greenvision-ai-<something>.vercel.app`).
6. Open the live URL → click **Try a sample scene →**. You should get real
   analysis results proxied from the HuggingFace Space.

---

## Part 3 — Wiring CORS (only if API calls are blocked)

The backend allows all origins by default (demo). To lock it down after testing,
set a Secret on the Space:
```
CORS_ORIGINS=https://greenvision-ai-<something>.vercel.app
```
(Settings → Variables and secrets → New variable.)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Space build fails on `pip install torch` | Hardware selection must be CPU (free). No other change needed. |
| Frontend "Network Error" | `VITE_API_URL` not set (or Space asleep). Open the Space page to wake it, then retry. |
| First analyze very slow | Expected — CPU torch cold start. Re-run the same image; it loads once. |
| `localStorage 'gv-theme'` / dark flash | Normal; theme code runs before the bundle loads. |

---

## Local run (unchanged)

```bash
# Backend  — Python 3.11 (with torch installed)
cd server && python app.py        # http://localhost:5000

# Frontend
cd greenvision-ai && npm run dev  # http://localhost:5173
```
Without `VITE_API_URL`, the frontend falls back to `http://localhost:5000`.