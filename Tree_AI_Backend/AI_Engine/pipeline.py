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
        # 5b. Street-scene trunk detection (measured count)
        # -----------------------------------------------------
        #
        # Street/urban scenes are also passed through the trained tree-trunk
        # DETECTOR. The box count is a measured "detected trees" figure and is
        # reported separately from the canopy-area × density estimate above —
        # the two must not be conflated. If no trunks are visible the measured
        # count is genuinely 0.

        report["detected_trees"] = None

        report["tree_detection_method"] = None

        report["tree_detection_confidence"] = None

        if scene == "street":

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
