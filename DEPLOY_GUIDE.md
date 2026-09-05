# Deploying GreenVision.AI — Step-by-Step

GreenVision.AI runs in two pieces:
1. **Backend (Flask + PyTorch AI Engine)** → **Oracle Cloud Always Free** VM
   (ARM, 4 OCPU / 24 GB RAM — the engine needs ~650 MB at peak, so anything
   smaller, like Render's free 512 MB, will be OOM-killed).
2. **Frontend (React + Vite)** → **Vercel** (free, built from `greenvision-ai/`).

Time: ~45 minutes (mostly waiting for Oracle provisioning + dependency install).

---

## Part 1 — Oracle Cloud VM (backend)

### 1.1 Create the account + VM
1. Go to https://signup.oraclecloud.com and create an account
   (credit card required for identity verification only — **you are never charged**
   while you stay inside the Always Free tier).
2. Sign in to the console → **Compute → Instances → Create instance**.
3. Configure:
   - **Name**: `greenvision-backend`
   - **Image**: **Canonical Ubuntu 22.04 (aarch64)** (or "Minimal")
   - **Shape**: change to **VM.Standard.A1.Flex** (Always Free eligible)
     - OCPU count: **4** · Memory: **24 GB**
   - **Networking**: default VCN/subnet; check **Assign a public IPv4 address**
   - **SSH**: add a public key (your laptop's `id_rsa.pub`, or the Oracle Web
     Console SSH key option)
4. Click **Create**. Wait ~2–3 minutes for the instance to be **Running**.
   - If you get "Out of capacity", retry in another **Availability Domain** or
     region with A1 capacity (e.g. Ashburn, Mumbai, Frankfurt).
5. Copy the instance's **public IP**.

### 1.2 Open the API port
1. Console → **Networking → Virtual Cloud Networks → your VCN → Security Lists →
   Default Security List → Add Ingress Rules**.
2. Add:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: **TCP**
   - Destination Port Range: **5000**
   - (Source port range: 5000 is left empty; the rule is destination-based)

### 1.3 Install the backend (one command from the VM)
SSH in (`ssh ubuntu@<PUBLIC_IP>`) and run:

```bash
git clone https://github.com/Nayana-2n/Greenvision-ai-.git greenvision-SETUP_REPO
cd greenvision-SETUP_REPO  # or deploy/oracle_setup.sh path
bash deploy/oracle_setup.sh
```

The script installs Python 3.10 + CPU PyTorch, clones the repo to `/opt/greenvision`,
and registers a `greenvision-backend` systemd service on port **5000**.

### 1.4 Verify
From your laptop:
```bash
curl http://<PUBLIC_IP>:5000/api/health
# -> {"engine_available":true,"pipeline_loaded":false,"status":"ok",...}
```
Then run one analyze through the API with the sample scene to confirm the full model
pipeline works (first call takes a bit on CPU — that's normal):
```bash
curl -X POST http://<PUBLIC_IP>:5000/api/analyze \
  -F "image=@greenvision-ai/public/sample-scene.jpg"
```

---

## Part 2 — Vercel (frontend)

1. https://vercel.com → **Add New Project** → import the repo.
2. Set: **Root Directory** = `greenvision-ai` · **Framework Preset** = Vite ·
   Build `npm run build` · Output `dist`.
3. Add environment variable **Production**:
   - `VITE_API_URL` = `http://<PUBLIC_IP>:5000`
4. Deploy. Visit the live URL → **Try a sample scene →** — you should get real
   ML results from the Oracle VM.

> **HTTPS note:** Vercel is HTTPS, the API is HTTP. Browsers will block the
> mixed-content call unless the page is loaded over HTTP or the API gets TLS.
> Two easy fixes:
> - During the demo, open the Vercel URL as `http://…vercel.app` (allowed for a
>   quick demo), or
> - Put a free TLS terminator in front of the API (e.g. `sudo apt install caddy`
>   and reverse-proxy `http://<PUBLIC_IP>:5000` → `https://api.greenvision.example`).

---

## Part 3 — Keeping it alive & hard limits

- The free tier VM costs ₹0 but the **A1 shape is not guaranteed**; keep your
  current local copy as the safe fallback (see below).
- The VM has no GPU — each analyze reuses the warm process, so first call after a
  restart is slow (~10–20 s), subsequent calls are fast.
- Backup plan if the VM is ever down: run the backend locally and expose it with a
  free Cloudflare tunnel (`cloudflared tunnel --url http://localhost:5000`), then
  point the frontend at that URL.

---

## Local run (unchanged)

```bash
# Backend — Python 3.11 (with CPU torch)
cd server && python app.py        # http://localhost:5000

# Frontend
cd greenvision-ai && npm run dev  # http://localhost:5173
```
Without `VITE_API_URL`, the frontend falls back to `http://localhost:5000`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Out of capacity` on A1 | Pick another Availability Domain or retry later. |
| `curl` to :5000 times out | Ingress rule missing — re-check Security List → TCP 5000. |
| First analyze is slow/bw 20s | Normal: lazy torch + model load on first request. |
| Browser blocks API calls | Mixed content → serve the page over HTTP for the demo, or add Caddy TLS. |
| Backend dies | `journalctl -u greenvision-backend -e`; the service has `Restart=always`. |