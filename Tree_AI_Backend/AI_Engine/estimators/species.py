import json
import logging
import torch
from PIL import Image
from torchvision import transforms

from config import PROJECT_ROOT

logger = logging.getLogger(__name__)

_LABELS = None
_MODEL = None
_TRANSFORM = None
_IDX_TO_LABEL = None


def _ensure_loaded():
    global _LABELS, _MODEL, _TRANSFORM, _IDX_TO_LABEL
    if _MODEL is not None:
        return

    from safetensors.torch import load_file
    from deepforest.model import CropModel

    model_dir = PROJECT_ROOT / "species_model"

    with open(model_dir / "labels.json") as f:
        _LABELS = json.load(f)

    _IDX_TO_LABEL = {v: k for k, v in _LABELS.items()}

    _MODEL = CropModel()
    _MODEL.create_model(len(_LABELS))

    STATE = load_file(str(model_dir / "model.safetensors"))
    _MODEL.load_state_dict(STATE)
    _MODEL.eval()

    _TRANSFORM = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

    logger.info(
        "Species classifier loaded (%d classes)", len(_LABELS)
    )


def predict_species(image, boxes):

    _ensure_loaded()

    results = []

    for box in boxes:

        x1, y1, x2, y2 = map(int, box)

        crop = image[y1:y2, x1:x2]

        if crop.size == 0:
            continue

        crop = Image.fromarray(crop[:, :, ::-1])

        tensor = _TRANSFORM(crop).unsqueeze(0)

        with torch.no_grad():
            output = _MODEL.model(tensor)
            probabilities = torch.softmax(output, dim=1)

        confidence, class_id = torch.max(probabilities, dim=1)

        results.append({
            "species": _IDX_TO_LABEL[int(class_id)],
            "confidence": round(float(confidence), 4)
        })

    return results
