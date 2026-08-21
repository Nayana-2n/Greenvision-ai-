"""
router.py

Purpose
-------
Uses the Scene Classifier to determine:

1. Scene Type
2. Confidence
3. Which model should be used
"""

from ultralytics import YOLO
import cv2

from config import (
    DENSE_MODEL,
    SPARSE_MODEL,
    STREET_MODEL
)
class SceneRouter:

    def __init__(self, classifier_path):

        self.model = YOLO(classifier_path)

        # Registry of all models
        self.model_paths = {

        "dense": DENSE_MODEL,

        "sparse": SPARSE_MODEL,

        "street": STREET_MODEL

    }

    def classify_scene(self, image_path):

        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")

        results = self.model.predict(
            source=image,
            verbose=False
        )

        result = results[0]

        class_id = result.probs.top1
        class_name = result.names[class_id].lower()
        confidence = float(result.probs.top1conf)

        return {

            "scene": class_name,

            "confidence": round(confidence, 4),

            "model_path": self.model_paths[class_name]

        }
