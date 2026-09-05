# GreenVision.AI backend - HuggingFace Space (Docker runtime)
# Runs the Flask API + AI Engine on free CPU hardware. Port is read from
# the PORT env var (HF Spaces sets PORT=7860 automatically).

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

# opencv-python needs libGL at runtime on slim images
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch keeps the image small and works on free CPU Spaces
RUN pip install --no-cache-dir \
        torch==2.2.2+cpu \
        torchvision==0.17.2+cpu \
        --index-url https://download.pytorch.org/whl/cpu

COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt
RUN pip install --no-cache-dir "numpy==1.26.4"

# Backend API
COPY server /app/server

# AI Engine + trained model weights (joined multi-structure lidar scene)
COPY Tree_AI_Backend /app/Tree_AI_Backend

EXPOSE 7860

CMD ["sh", "-c", "cd /app/server && python app.py"]