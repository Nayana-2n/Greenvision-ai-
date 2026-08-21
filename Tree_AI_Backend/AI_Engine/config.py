"""
config.py

Central configuration for the AI Engine.
Model paths are resolved relative to the project,
so the backend can be moved to another computer.
"""

from pathlib import Path


# AI_Engine directory
AI_ENGINE_DIR = Path(__file__).resolve().parent

# Project root
PROJECT_ROOT = AI_ENGINE_DIR.parent


# ===========================
# Model Paths
# ===========================

SCENE_CLASSIFIER = (
    PROJECT_ROOT
    / "models"
    / "scene_classifier"
    / "best.pt"
)

DENSE_MODEL = (
    PROJECT_ROOT
    / "models"
    / "dense"
    / "best.pt"
)

SPARSE_MODEL = (
    PROJECT_ROOT
    / "models"
    / "sparse"
    / "best.pt"
)

STREET_MODEL = (
    PROJECT_ROOT
    / "models"
    / "street"
    / "best.pt"
)


# ===========================
# Default Scale
# ===========================

DEFAULT_SCALE = 0.25
