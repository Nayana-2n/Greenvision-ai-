// Converts the backend analysis report (server/app.py schema) into the
// view-model shape the Dashboard / Climate Lab / Advisor / Reports expect.
//
// Everything that the AI pipeline actually computes is mapped to a real
// value. Concepts the model does not produce (zones, AQI, heat index,
// historical trends, illegal-loss, cooling corridors) are set to `null` so
// the UI shows an honest "not assessed" state instead of fake numbers.

export const LIVE = 'live';

const TARGET_GREEN_COVER = 60;

// Honest relative time derived from the backend analysis timestamp, so the
// insight feed never claims a fresh timestamp that the model did not produce.
function relativeTime(ts) {
  if (!ts) return 'at analysis time';
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return 'at analysis time';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
}

export function mapReportToScene(report) {
  if (!report) return null;

  const green = report.green_cover_percentage ?? report.canopy_percentage ?? null;
  const trees = report.estimated_trees ?? null;
  const carbon = report.carbon_tonnes_per_year ?? null;
  const oxygen = report.oxygen_tonnes_per_year ?? null;
  const density = report.density_class ?? null;
  const scene = report.scene ?? null;
  const sceneConf = report.scene_confidence ?? null;
  const areaHa = report.forest_area_hectares ?? null;
  const priority = report.plantation_priority ?? null;
  const recommendation = report.plantation_recommendation ?? null;
  const scaleSource = report.scale_source ?? null;
  const crsEpsg = report.metadata?.georef?.crs_epsg ?? null;
  const detectedTrees = report.detected_trees ?? null;
  const detectionConf = report.tree_detection_confidence ?? null;

  // Reliability gate: the backend withholds every vegetation-derived metric
  // when the input image is not in the canopy model's valid domain (e.g. a
  // near-colorless / non-aerial image). Surface that as an explicit gated
  // state instead of misleading cards.
  const rel = report.vegetation_reliability;
  const gated = !!(rel && rel.reliable === false);
  const gateMessage = rel?.message ?? null;

  // Honest derived "scene health" from canopy attainment vs the 60% target.
  const attainment = green != null ? Math.min(100, Math.round((green / TARGET_GREEN_COVER) * 100)) : null;

  const statusColor =
    green == null
      ? 'text-mist-dim'
      : green >= TARGET_GREEN_COVER
      ? 'text-canopy'
      : green >= 40
      ? 'text-earth'
      : 'text-red-400';

  const topRisks = [];
  if (green != null && green < TARGET_GREEN_COVER) {
    topRisks.push(`Canopy ${green}% is below the ${TARGET_GREEN_COVER}% target`);
  }
  if (density && density === 'Sparse') {
    topRisks.push(`Low canopy density (${density})`);
  }
  if (priority === 'High') {
    topRisks.push('High plantation priority');
  }
  if (green != null && green >= TARGET_GREEN_COVER) {
    topRisks.push(`Canopy meets the ${TARGET_GREEN_COVER}% target`);
  }

  const insights = [];
  let insightId = 0;
  if (gated) {
    insights.push({
      id: ++insightId,
      type: 'critical',
      title: 'Vegetation not measurable',
      text: gateMessage,
      time: relativeTime(report.timestamp),
    });
  }
  if (scene && sceneConf != null) {
    insights.push({
      id: ++insightId,
      type: 'success',
      title: 'Scene classified',
      text: `Detected as a "${scene}" scene with ${(sceneConf * 100).toFixed(0)}% confidence.`,
      time: relativeTime(report.timestamp),
    });
  }
  if (trees != null) {
    insights.push({
      id: ++insightId,
      type: 'alert',
      title: 'Tree estimate',
      text: `Estimated ${trees.toLocaleString()} trees${density ? ` (${density.toLowerCase()} density)` : ''} — canopy area × density heuristic, not individual detection.`,
      time: relativeTime(report.timestamp),
    });
  }
  if (green != null) {
    const gap = TARGET_GREEN_COVER - green;
    insights.push({
      id: ++insightId,
      type: gap > 0 ? 'warning' : 'success',
      title: gap > 0 ? 'Canopy deficit' : 'Canopy target met',
      text:
        gap > 0
          ? `Green canopy cover is ${green}% — ${gap} points below the ${TARGET_GREEN_COVER}% target.`
          : `Green canopy cover is ${green}%, meeting the ${TARGET_GREEN_COVER}% target.`,
      time: relativeTime(report.timestamp),
    });
  }
  if (scene === 'street' && detectedTrees != null) {
    insights.push({
      id: ++insightId,
      type: 'alert',
      title: 'Trunk detection',
      text: `The street trunk detector counted ${detectedTrees.toLocaleString()} visible trunks${
        detectionConf != null ? ` (mean confidence ${Math.round(detectionConf * 100)}%)` : ''
      } — a measured figure, separate from the canopy area × density estimate.`,
      time: relativeTime(report.timestamp),
    });
  }
  if (priority && recommendation) {
    insights.push({
      id: ++insightId,
      type: priority === 'High' ? 'critical' : 'warning',
      title: `Plantation priority: ${priority}`,
      text: recommendation,
      time: relativeTime(report.timestamp),
    });
  }

  const recommendations = [];
  if (priority && recommendation) {
    recommendations.push({ priority, text: recommendation });
  }

  const prompts = [];
  if (trees != null) {
    prompts.push({
      q: 'How many trees are estimated in this scene?',
      a: `About ${trees.toLocaleString()} trees, estimated from the measured canopy area and density (${density ?? 'n/a'} density).`,
    });
  }
  prompts.push({
    q: 'What is the green cover percentage?',
    a:
      green != null
        ? `Green canopy cover is ${green}% of the scene (target ${TARGET_GREEN_COVER}%).`
        : 'Green cover was not computed for this image.',
  });
  if (priority && recommendation) {
    prompts.push({
      q: 'What is the plantation recommendation?',
      a: `${priority} priority — ${recommendation}`,
    });
  }
  if (carbon != null) {
    prompts.push({
      q: 'How much carbon does this scene sequester?',
      a: `About ${carbon} tonnes of CO₂ per year.`,
    });
  }
  if (prompts.length < 4) {
    prompts.push({
      q: 'Summarize this analysis',
      a: report.summary || 'No summary available.',
    });
  }

  return {
    ...report, // raw backend fields stay available (Reports page, Advisor context)
    source: LIVE,
    sceneId: report.scene_id,
    locationName: report.image_name || 'Analyzed aerial scene',
    timestamp: report.timestamp,
    summary: report.summary || null,

    // Core KPIs
    treeCount: trees,
    greenCover: green,
    targetGreenCover: TARGET_GREEN_COVER,
    carbon,
    oxygen,
    carbonOffset: carbon,
    oxygenProduction: oxygen,
    heatIndex: null, // not produced by the backend model
    aqi: null, // not produced by the backend model
    forestAreaHectares: areaHa,
    densityClass: density,
    densityScore: report.density_score ?? null,
    densityConfidence: report.confidence ?? null,
    scaleSource,
    crsEpsg,
    gps: report.gps ?? null,

    // Measured trunk count for street/urban scenes (street detector).
    // Distinct from `treeCount` which is the canopy-area × density estimate.
    detectedTrees,
    treeDetectionMethod: report.tree_detection_method ?? null,
    treeDetectionConfidence: detectionConf,

    // ML confidence badges — honest mapping:
    //  - sceneClassification : scene classifier top-1 confidence
    //  - density             : canopy-density classifier confidence
    //  - treeDetection       : street scenes only — mean confidence of the
    //                          trunk detector; dense/sparse scenes have no
    //                          object-detection confidence because their tree
    //                          count is a canopy-area × density heuristic
    //  - carbonModel         : null (fixed per-tree multiplier, no model)
    //  - heatPrediction      : null (no heat model in the backend)
    aiConfidence: {
      sceneClassification: sceneConf != null ? Math.round(sceneConf * 100) : null,
      density: report.confidence ?? null,
      treeDetection: detectionConf != null ? Math.round(detectionConf * 100) : null,
      carbonModel: null,
      heatPrediction: null,
      overall: sceneConf != null ? Math.round(sceneConf * 100) : null,
    },

    // Executive summary (derived honestly from real values)
    cityHealth: {
      score: gated ? null : attainment,
      status: gated ? 'Not assessable' : (density || (scene || 'Analysis')),
      statusColor: gated ? 'text-red-400' : statusColor,
      topRisks: gated ? [gateMessage] : (topRisks.length ? topRisks : ['No risks flagged for this scene']),
      immediateAction: gated ? gateMessage : (recommendation || 'No immediate action required.'),
      estimatedCost: null,
      expectedImpact: null,
    },

    // Reliability gate state (backend withheld vegetation metrics).
    vegetationGate: gated ? { reason: rel.reason ?? null, message: gateMessage } : null,

    liveInsights: insights,

    // Charts — only real derivable data
    landCoverSplit:
      green != null
        ? { labels: ['Canopy cover', 'Other'], data: [green, Math.max(0, 100 - green)] }
        : null,
    treesByZone: null, // zone breakdown requires multi-scene/multi-zone data
    greenCoverTrend: null, // single scene, no historical trend
    heatmapUrl: report.heatmap_url ?? null, // vegetation mask overlay
    zones: null, // no per-zone geospatial data in this analysis

    recommendations,
    climateGPTPrompts: prompts,
  };
}
