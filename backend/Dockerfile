# Backend API (FastAPI + YOLO on CPU).
# The model is not baked into the image: mount it at /app/models/best.pt (see docker-compose.yml).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# OpenCV needs these system libraries
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch first (much smaller than the default CUDA build), then the rest
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY doctor.py seed_demo.py ./

# Database, uploads and logs live in /app/data (a volume), the model in /app/models
ENV DATABASE_URL=sqlite:////app/data/farm.db \
    UPLOAD_DIR=/app/data/uploads \
    LOG_DIR=/app/data/logs \
    MODEL_PATH=/app/models/best.pt \
    CONF_THRESHOLD=0.45
RUN mkdir -p /app/data /app/models

EXPOSE 8000
# --proxy-headers: take the client IP from nginx (used by the login rate limit). Only safe because
# the backend port is not published; all traffic comes through the frontend container.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
