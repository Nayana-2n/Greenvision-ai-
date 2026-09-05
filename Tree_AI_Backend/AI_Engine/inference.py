"""
inference.py

Runs the selected AI model on an image.
Only one inference model is kept in memory at a time (the canopy
segmentation model and the street-trunk detector are used sequentially),
which keeps the memory footprint low enough for constrained hosts
such as Render's free tier.
"""

import gc
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import torch
from ultralytics import YOLO
import cv2

# Cap torch to a single thread before any tensor work: the CPU kernels
# allocate per-thread scratch buffers, and constrained hosts (Render,
# free VMs) are far more sensitive to RSS than to parallelism.
torch.set_num_threads(1)
torch.set_num_interop_threads(1)


class InferenceEngine:

    def __init__(self):
        self._current_model_path = None
        self._current_model = None

    def load_model(self, model_path):

        if self._current_model is not None and self._current_model_path == model_path:
            return self._current_model

        # Evict the previous model before loading a new one.
        self._current_model_path = None
        self._current_model = None
        gc.collect()

        model = YOLO(model_path)
        self._current_model = model
        self._current_model_path = model_path

        return model

    def predict(self, model_path, image_path):

        model = self.load_model(model_path)

        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")

        results = model.predict(
            source=image,
            verbose=False
        )

        return results, image
