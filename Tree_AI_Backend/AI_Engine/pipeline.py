"""
pipeline.py

Master AI Pipeline

Flow:
Image / Folder
    ↓
Metadata
    ↓
Scale
    ↓
Scene Classifier
    ↓
Selected Model
    ↓
Scene-specific Pipeline
    ↓
Final Report
"""

import os

from router import SceneRouter
from inference import InferenceEngine
from estimators.species import predict_species

from config import (
    SCENE_CLASSIFIER,
    SPARSE_MODEL,
    STREET_MODEL,
    DEFAULT_SCALE
)

from utils.metadata import extract_metadata
from utils.scale import determine_scale

from pipelines import vegetation_pipeline

from estimators.reliability import assess_image_reliability
from estimators.crown_regions import extract_crown_regions

# Aerial evidence threshold: when the scene classifier labels a photo a
# street/urban scene but the trained canopy segmentation measures a
# meaningful amount of vegetation and the trunk detector finds no trunks,
# the image is far more likely to be aerial imagery that the classifier
# mislabelled than an empty ground-level street photo. It is then routed
# through the aerial tree-crown path instead of the trunk path. Confidence
# is never used as coverage; this is purely a routing decision.
AERIAL_OVERRIDE_MIN_CANOPY_PERCENT = 2.0


def compute_species_coverage(species_entries, image):
    """Species coverage from measured detection geometry.

    Coverage is the area actually occupied by each detected species as a
    fraction of the whole image:

        species_coverage_percentage =
            (sum of measured areas for that species / image area) * 100

    The measured area is the region the detector produced:
      - aerial crown path  -> exact crown mask area (entry["area"])
      - street trunk path  -> trunk bounding-box area (entry["box"])
    It is deliberately independent of the species classifier confidence —
    confidence never becomes coverage.
    """
    height, width = image.shape[:2]
    image_area = width * height

    if not species_entries or not image_area:
        return []

    per_species = {}

    for entry in species_entries:

        label = entry.get("species")
        if label is None:
            continue

        measured_area = entry.get("area")

        if measured_area is None:

            box = entry.get("box")
            if not box or len(box) != 4:
                continue

            x1, y1, x2, y2 = box
            measured_area = max(0, x2 - x1) * max(0, y2 - y1)

        if measured_area <= 0:
            continue

        item = per_species.setdefault(label, {
            "species": label,
            "area": 0.0,
            "confidence_sum": 0.0,
            "trunk_count": 0,
        })

        item["area"] += measured_area
        item["confidence_sum"] += entry.get("confidence") or 0.0
        item["trunk_count"] += 1

    result = []

    for label, item in per_species.items():

        result.append({
            "species": label,
            "coverage_percentage": round(
                (item["area"] / image_area) * 100, 2
            ),
            "classification_confidence": round(
                item["confidence_sum"] / item["trunk_count"], 4
            ),
            "trunk_count": item["trunk_count"],
        })

    result.sort(key=lambda r: r["coverage_percentage"], reverse=True)

    return result


class TreeAIPipeline:

    def __init__(self):

        # Scene classifier / router
        self.router = SceneRouter(
            SCENE_CLASSIFIER
        )

        # Model inference engine
        self.engine = InferenceEngine()

    # =========================================================
    # SINGLE IMAGE
    # =========================================================

    def process_image(self, image_path):

        print(
            f"\nProcessing: "
            f"{os.path.basename(image_path)}"
        )

        # -----------------------------------------------------
        # 1. Metadata
        # -----------------------------------------------------

        metadata = extract_metadata(
            image_path
        )

        # -----------------------------------------------------
        # 2. Scale
        # -----------------------------------------------------

        scale = determine_scale(
            metadata
        )

        if scale["scale_available"]:

            meters_per_pixel = (
                scale["meters_per_pixel"]
            )

        else:

            meters_per_pixel = DEFAULT_SCALE

            print(
                "Warning: Image metadata does not "
                "contain usable scale information."
            )

            print(
                f"Using default scale: "
                f"{DEFAULT_SCALE} meters/pixel"
            )

        # -----------------------------------------------------
        # 3. Scene Classification
        # -----------------------------------------------------

        route = self.router.classify_scene(
            image_path
        )

        scene = route["scene"]
        confidence = route["confidence"]

        print(
            f"Scene       : {scene}"
        )

        print(
            f"Confidence  : {confidence}"
        )

        # -----------------------------------------------------
        # 4. Run vegetation (canopy segmentation) model
        # -----------------------------------------------------
        #
        # The scene classifier labels the ENVIRONMENT (dense /
        # sparse / street). It does NOT gate vegetation analysis:
        # an urban or industrial scene can still contain measurable
        # canopy, so the canopy-segmentation model runs for every
        # scene type. If it detects no canopy, the measured value
        # is genuinely zero — not "unavailable".
        #
        # Model routing (hackathon fix):
        #  - models/dense/best.pt was an untrained (epoch-0, mAP 0.009)
        #    checkpoint that over-segmented roofs/roads/shadows, so it is
        #    no longer used for inference.
        #  - models/sparse/best.pt is the trained canopy-segmentation model
        #    and is used for every scene type.
        #  - models/street/best.pt is a trained tree-TRUNK detector; for
        #    street/urban scenes it additionally reports a measured trunk
        #    count, separate from the area×density estimate (see step 5b).

        results, image = self.engine.predict(
            SPARSE_MODEL,
            image_path
        )

        # -----------------------------------------------------
        # 5. Unified vegetation analysis
        # -----------------------------------------------------

        report = vegetation_pipeline.process(
            results,
            image,
            meters_per_pixel,
            scene=scene
        )
        # vegetation_pipeline now returns (report, mask)
        if isinstance(report, tuple):
            report, _veg_mask = report
        else:
            _veg_mask = None

        # -----------------------------------------------------
        # 5b. Scene-specific tree detection + species classification
        # -----------------------------------------------------
        #
        # The species classifier was trained on crops of individual tree
        # crowns in aerial/overhead imagery. Aerial imagery (scene in
        # dense/sparse) MUST therefore be species-classified from TREE-CROWN
        # regions derived from the trained canopy segmentation — never from
        # trunk detections. The street trunk detector is used exclusively
        # for street-labelled scenes.
        #
        # Routing rules:
        #   - dense / sparse  -> AERIAL crown path (segmentation crowns).
        #   - street          -> trunk path, PLUS an aerial-evidence
        #                        override: if the segmentation measures
        #                        meaningful canopy and the trunk detector
        #                        finds zero trunks, the image is almost
        #                        certainly aerial imagery the classifier
        #                        mislabelled as "street", so it is routed
        #                        through the crown path and the trunk
        #                        result is never presented.
        #
        # A dense/sparse scene is NEVER sent to the street trunk detector.

        report["detected_trees"] = None

        report["tree_detection_method"] = None

        report["tree_detection_confidence"] = None

        report["species"] = []

        report["species_coverage"] = []

        view = "aerial" if scene in ("dense", "sparse") else "street"

        report["analysis_view"] = view

        report["species_scope"] = (
            "aerial_crowns" if view == "aerial" else "street_trunks"
        )

        if view == "aerial":

            report = self._run_aerial_crown_pipeline(
                report, image_path, _veg_mask
            )

        else:

            report = self._run_street_trunk_pipeline(
                report, image_path
            )

            green_pct = report.get("green_cover_percentage") or 0.0

            if (
                report.get("detected_trees") == 0
                and green_pct >= AERIAL_OVERRIDE_MIN_CANOPY_PERCENT
            ):

                report["analysis_view"] = "aerial"

                report["species_scope"] = "aerial_crowns"

                report = self._run_aerial_crown_pipeline(
                    report, image_path, _veg_mask
                )

        # -----------------------------------------------------
        # 6. Add common pipeline information
        # -----------------------------------------------------

        report["scene"] = scene

        report["scene_confidence"] = confidence

        report["scale_source"] = (
            "metadata"
            if scale["scale_available"]
            else "default_estimation"
        )

        # -----------------------------------------------------
        # 6b. Reliability gate for out-of-domain inputs
        # -----------------------------------------------------
        #
        # The canopy-segmentation model is trained on colour aerial RGB
        # imagery. A nearly-colorless input (grayscale, flat synthetic
        # fill, heavily desaturated render) is outside that domain, so
        # its segmentation output is NOT a reliable measurement. When the
        # gate trips, every vegetation-derived metric is withheld (nulled)
        # and the report exposes an honest "cannot be measured reliably"
        # state plus a recovery message, instead of presenting model noise
        # as fact.

        reliability = assess_image_reliability(image)

        report["vegetation_reliability"] = reliability

        if not reliability["reliable"]:

            for key in (
                "green_cover_percentage",
                "canopy_percentage",
                "forest_pixels",
                "forest_area_m2",
                "forest_area_hectares",
                "estimated_trees",
                "carbon_tonnes_per_year",
                "oxygen_tonnes_per_year",
                "equivalent_people_offset",
                "density_class",
                "density_score",
                "number_of_patches",
                "largest_patch",
                "smallest_patch",
                "average_patch",
                "fragmentation_index",
                "edge_density",
                "detected_trees",
                "tree_detection_method",
                "tree_detection_confidence",
                "species",
                "species_coverage",
                "plantation_priority",
                "plantation_recommendation",
            ):
                report[key] = None

            report["summary"] = reliability["message"]

        # -----------------------------------------------------
        # 7. Reliability disclosure for built-environment scenes
        # -----------------------------------------------------
        #
        # The canopy-segmentation model is trained on vegetated aerial
        # imagery. On a street/urban scene it can over-detect canopy on
        # roofs, roads and shadows. When the measured canopy is high for
        # such a scene, the estimate is flagged as indicative-only and
        # green-cover-based plantation priority is not asserted, rather
        # than presenting an over-detected figure as fact.

        canopy_pct = report.get("green_cover_percentage")

        if scene == "street" and canopy_pct is not None and canopy_pct > 40:

            detected = report.get("detected_trees")

            if report.get("analysis_view") == "aerial":

                detection_note = (
                    f" The aerial tree-crown analysis identified "
                    f"{detected} crown regions from the canopy "
                    f"segmentation."
                    if detected is not None
                    else ""
                )

            else:

                detection_note = (
                    f" Separately, the trunk detector measured "
                    f"{detected} visible trunks."
                    if detected is not None
                    else ""
                )

            report["vegetation_warning"] = (
                f"This image was classified as a street/urban scene. The "
                f"canopy segmentation model is trained on vegetated aerial "
                f"imagery and can over-detect canopy on roofs, roads and "
                f"shadows, so the {canopy_pct}% canopy and "
                f"{report['estimated_trees']} estimated trees are indicative "
                f"only and should be verified on the ground before acting."
                f"{detection_note}"
            )

            report["plantation_priority"] = "Not Assessed"

            report["plantation_recommendation"] = (
                "Plantation priority cannot be determined reliably for this "
                "street/urban scene because canopy measurement is uncertain "
                "for built surfaces. Ground verification is recommended."
            )

        else:

            report["vegetation_warning"] = None

        report["_veg_mask"] = _veg_mask

        return report

    # =========================================================
    # AERIAL TREE-CROWN PIPELINE
    # =========================================================

    def _run_aerial_crown_pipeline(self, report, image_path, veg_mask):
        """Aerial / drone scene-specific analysis.

        Original aerial imagery -> aerial tree-crown segmentation model
        -> connected crown regions -> crop each crown -> species
        classifier -> per-species coverage from MEASURED crown area.

        No visible trunk is required for species identification in aerial
        imagery, because the species classifier was trained on aerial
        tree-crown crops, not street trunks.
        """

        crown_regions = extract_crown_regions(veg_mask)

        report["detected_trees"] = len(crown_regions)

        report["tree_detection_method"] = (
            "aerial tree-crown segmentation "
            "(canopy model + connected crown regions)"
        )

        report["tree_detection_confidence"] = None

        report["species"] = []

        report["species_coverage"] = []

        if not crown_regions:
            return report

        import cv2

        image_bgr = cv2.imread(image_path)

        if image_bgr is None:
            return report

        box_xyxy = [region["box"] for region in crown_regions]

        species = predict_species(image_bgr, box_xyxy)

        area_by_box = {
            tuple(region["box"]): region["area"]
            for region in crown_regions
        }

        for entry in species:
            entry["area"] = area_by_box.get(
                tuple(entry["box"])
            )

        report["species"] = species

        report["species_coverage"] = compute_species_coverage(
            species, image_bgr
        )

        return report

    # =========================================================
    # STREET TRUNK PIPELINE
    # =========================================================

    def _run_street_trunk_pipeline(self, report, image_path):
        """Street / urban ground-level analysis.

        Street imagery -> tree-trunk detector -> detected trunks -> crop
        each trunk -> species classifier -> per-species coverage from the
        measured trunk bounding-box area.
        """

        det_results, _ = self.engine.predict(
            STREET_MODEL,
            image_path
        )

        boxes = getattr(det_results[0], "boxes", None)

        confs = (
            [float(c) for c in boxes.conf]
            if boxes is not None and boxes.conf is not None
            else []
        )

        report["detected_trees"] = len(confs)

        report["tree_detection_method"] = (
            "street trunk detector (YOLO Tree-trunk)"
        )

        if confs:

            report["tree_detection_confidence"] = round(
                sum(confs) / len(confs),
                3
            )

        report["species"] = []

        report["species_coverage"] = []

        if boxes is None or len(boxes) == 0:
            return report

        import cv2

        image_bgr = cv2.imread(image_path)

        if image_bgr is None:
            return report

        box_xyxy = boxes.xyxy.cpu().numpy()

        species = predict_species(image_bgr, box_xyxy)

        report["species"] = species

        report["species_coverage"] = compute_species_coverage(
            species, image_bgr
        )

        return report

    # =========================================================
    # FOLDER
    # =========================================================

    def process_folder(self, folder_path):

        supported_extensions = (
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        )

        # -----------------------------------------------------
        # Find images
        # -----------------------------------------------------

        image_files = [

            os.path.join(
                folder_path,
                filename
            )

            for filename in os.listdir(
                folder_path
            )

            if filename.lower().endswith(
                supported_extensions
            )

        ]

        image_files.sort()

        if not image_files:

            raise ValueError(
                f"No supported images found in: "
                f"{folder_path}"
            )

        print(
            f"\nFound {len(image_files)} images."
        )

        # -----------------------------------------------------
        # Process every image independently
        # -----------------------------------------------------

        reports = []

        for image_path in image_files:

            try:

                report = self.process_image(
                    image_path
                )

                reports.append({

                    "image": os.path.basename(
                        image_path
                    ),

                    "report": report

                })

            except Exception as error:

                print(
                    f"\nERROR processing "
                    f"{os.path.basename(image_path)}:"
                )

                print(error)

                reports.append({

                    "image": os.path.basename(
                        image_path
                    ),

                    "error": str(error)

                })

        return reports
