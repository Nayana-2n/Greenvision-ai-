import { getCurrentScene } from './sceneStore';
import { getUserLocation } from './locationStore';
import { getUserName } from './userStore';
import { getLocationContext } from '../api/api';

export async function buildAdvisorContext(mode, extraScene) {
  const scene = extraScene || getCurrentScene() || {};
  const context = { ...scene, _mode: mode || 'municipal' };

  const userName = getUserName();
  if (userName) {
    context._userName = userName;
  }

  const gps = scene.gps;
  const manual = scene.userLocation;
  const stored = getUserLocation();
  const loc = gps ?? manual ?? stored;

  if (loc?.lat != null && loc?.lng != null) {
    context._userLocation = { lat: loc.lat, lng: loc.lng, name: loc.name || '' };
    try {
      const ctx = await getLocationContext(loc.lat, loc.lng, loc.name || '');
      context._plantCtx = ctx;
    } catch {
      // No location context available — the advisor stays honest about what
      // it can and cannot answer rather than inventing values.
    }
  }
  return context;
}

export function advisorPrompts(scene, mode) {
  const scenePrompts = (scene?.climateGPTPrompts || [])
    .map((p) => (typeof p === 'string' ? p : p?.q))
    .filter(Boolean);

  if (mode === 'citizen') {
    return [
      'What should I plant here?',
      'I have a small garden. What can I grow?',
      'Which tree needs less water?',
      'What can one tree do for my area?',
      ...scenePrompts,
    ];
  }

  if (mode === 'industrial') {
    return [
      'What should we plant around this factory?',
      'Which species are pollution-tolerant?',
      'How large should the green buffer be?',
      'How many trees should we plan?',
      ...scenePrompts,
    ];
  }

  return [
    'What should we do with this area?',
    'How many trees are needed to reach the target?',
    'Which species should we prioritize?',
    'How much would 500 trees cost?',
    ...scenePrompts,
  ];
}

export function advisorGreeting(mode) {
  if (mode === 'citizen') {
    return "Hi! I'm GreenVision, your environmental advisor. I can help you find the right trees for your area, estimate planting costs, and understand what trees do for the environment — all grounded in real weather, air quality, and soil data for your location. Just ask me anything!";
  }
  if (mode === 'industrial') {
    return "Welcome to the GreenVision Industrial Advisor. I can help you plan a green-buffer intervention around an industrial site: suitable species, planting quantity, estimated investment and calculated CO\u2082/O\u2082 contribution. Note: GreenVision has no validated pollutant-reduction model, so pollutant reduction is never quantified.";
  }
  return 'Welcome to the GreenVision Command Advisor. I can read the current analyzed scene and its live location context to answer canopy, tree-count, carbon/oxygen, plantation priority, species and trees-needed questions.';
}
