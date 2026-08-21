// Shared transparent arithmetic used by ClimateLab and the Municipal
// dashboard: the 60% canopy target and the "trees needed to reach it"
// calculation. Kept in one place so the simulator, planting plan and
// dashboard always show the same numbers (same math as server/species_data.py).

export const TARGET_GREEN_COVER = 60;

// Total scene area (m²): measured pixels × scale² first, falling back to
// canopy-share arithmetic from the measured forest area.
export function getSceneTotalArea(scene) {
  if (!scene) return null;
  const totalPixels = scene.total_pixels ?? null;
  const scale = scene.scale_used ?? scene.scale_used_m_per_pixel ?? null;
  if (totalPixels != null && totalPixels > 0 && scale != null && scale > 0) {
    return totalPixels * scale * scale;
  }
  const gc = scene.canopy_percentage ?? scene.green_cover_percentage ?? null;
  const forestM2 = scene.forest_area_m2 ?? null;
  if (gc != null && gc > 0 && forestM2 != null && forestM2 > 0) {
    return forestM2 / (gc / 100);
  }
  return null;
}

// Build the simulation baseline contract from a mapped scene (or raw report).
export function buildSceneBaseline(scene) {
  if (!scene) return null;
  return {
    estimated_trees: scene.treeCount ?? scene.estimated_trees ?? null,
    canopy_percentage: scene.greenCover ?? scene.canopy_percentage ?? null,
    forest_area_m2: scene.forest_area_m2 ?? null,
    forest_area_hectares: scene.forestAreaHectares ?? scene.forest_area_hectares ?? null,
    scene: scene.scene ?? null,
    plantation_priority: scene.plantation_priority ?? scene.priority ?? null,
    vegetation_warning: scene.vegetation_warning ?? null,
  };
}

// Trees still needed to reach the 60% canopy target — the same transparent
// arithmetic the species engine uses (server/species_data.py).
export function computeTargetGap(scene, baseline) {
  if (!baseline) return null;
  const gc = baseline.canopy_percentage;
  const trees = baseline.estimated_trees;
  const forest_m2 = baseline.forest_area_m2;
  if (gc == null || trees == null || !forest_m2 || forest_m2 <= 0 || trees <= 0) return null;
  const scene_total_m2 = getSceneTotalArea(scene);
  if (scene_total_m2 == null || scene_total_m2 <= 0) return null;
  const target_m2 = scene_total_m2 * (TARGET_GREEN_COVER / 100);
  const m2_per_tree = forest_m2 / trees;
  const needed_m2 = Math.max(0, target_m2 - forest_m2);
  return {
    current_green_cover: gc,
    target_green_cover: TARGET_GREEN_COVER,
    scene_total_m2,
    target_m2,
    m2_per_tree,
    trees_needed: needed_m2 > 0 ? Math.ceil(needed_m2 / m2_per_tree) : 0,
  };
}
