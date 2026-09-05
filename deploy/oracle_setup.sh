#!/usr/bin/env bash
#
# GreenVision.AI — Oracle Cloud Always Free provisioning script.
#
# Runs on the VM as the default (opc/ubuntu) user. Installs the CPU-only
# PyTorch + tree-detection pipeline, clones the repo, and registers a
# systemd service so the backend stays up and restarts on reboot.
#
# Usage (from the VM):
#   bash deploy/oracle_setup.sh
#
set -euo pipefail

APP_USER="${SUDO_USER:-$(whoami)}"
APP_DIR="/opt/greenvision"
REPO_URL="https://github.com/Nayana-2n/Greenvision-ai-.git"
PORT="${PORT:-5000}"

echo "==> Installing system packages (python3.10, git, opencv runtime libs)"
sudo apt-get update -y
sudo apt-get install -y \
  python3.10 python3.10-venv python3-pip git curl \
  libgl1 libglib2.0-0 ca-certificates

echo "==> Cloning repository into ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${APP_USER}" "${APP_DIR}"
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

echo "==> Creating virtualenv + installing dependencies"
cd "${APP_DIR}"
python3.10 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
python -m pip install --upgrade pip

# CPU-only PyTorch keeps the install small and works on ARM (A1) VMs.
pip install --no-cache-dir \
  torch==2.2.2+cpu \
  torchvision==0.17.2+cpu \
  --index-url https://download.pytorch.org/whl/cpu

pip install --no-cache-dir -r server/requirements.txt
pip install --no-cache-dir numpy==1.26.4

echo "==> Writing systemd unit (greenvision-backend.service)"
cat <<EOF | sudo tee /etc/systemd/system/greenvision-backend.service >/dev/null
[Unit]
Description=GreenVision.AI backend (Flask + AI Engine)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/server
ExecStart=${APP_DIR}/venv/bin/gunicorn --workers 1 --threads 1 --timeout 600 --bind 0.0.0.0:${PORT} app:app
Restart=always
RestartSec=5
Environment=PORT=${PORT}
User=${APP_USER}

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable greenvision-backend
sudo systemctl restart greenvision-backend

echo "==> Waiting for the API to come up…"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "==> HEALTH OK: http://127.0.0.1:${PORT}/api/health"
    curl -fsS "http://127.0.0.1:${PORT}/api/health"
    echo
    echo "==> Open TCP ${PORT} in the Oracle security list to expose it publicly."
    exit 0
  fi
  sleep 2
done

echo "==> Backend did not become healthy in time. Check: journalctl -u greenvision-backend -e" >&2
exit 1