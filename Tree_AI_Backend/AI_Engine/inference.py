"""
inference.py

Runs the selected AI model on an image.
"""

from ultralytics import YOLO
import cv2


class InferenceEngine:

    def __init__(self):
        self.loaded_models = {}

    def load_model(self, model_path):

        if model_path not in self.loaded_models:
            self.loaded_models[model_path] = YOLO(model_path)

        return self.loaded_models[model_path]

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
