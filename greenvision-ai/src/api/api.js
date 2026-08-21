import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 300000, // model inference can take a while on first call (model load)
});

// Extract a useful message from any axios error (backend returns { error }).
export function extractError(error, fallback = 'Could not reach the GreenVision backend.') {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.message) return error.message;
  return fallback;
}

export async function getHealth() {
  const { data } = await client.get('/api/health');
  return data;
}

// Upload a satellite/drone image and run the full AI-GIS pipeline.
export async function analyzeImage(file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await client.post('/api/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Scene-aware planting simulation. baseline = the current analyzed scene
// metrics (trees, canopy, area); the backend projects the scenario onto it.
export async function simulateClimate(treeCount, baseline = null) {
  const { data } = await client.post('/api/climate/simulate', { treeCount, baseline });
  return data;
}

// Contextual ClimateGPT assistant. context = the current analysis report.
// conversation_history = array of { sender: 'user'|'bot', text: string } for follow-up context.
export async function askAdvisor(message, context, conversationHistory = []) {
  const { data } = await client.post('/api/advisor/ask', {
    message,
    context,
    conversation_history: conversationHistory,
  });
  return data;
}

export async function fetchReports() {
  const { data } = await client.get('/api/reports');
  return data.reports || [];
}

export async function fetchReport(id) {
  const { data } = await client.get(`/api/reports/${encodeURIComponent(id)}`);
  return data;
}

// Live environmental context (weather, elevation, air quality, soil) for a
// geographic point, fetched from Open-Meteo and source-labelled by the backend.
export async function getLocationContext(lat, lng, name = '') {
  const { data } = await client.post('/api/location/context', { lat, lng, name });
  return data;
}

// Forward-geocode a place name (powers the location search box).
export async function geocodePlaces(query, count = 5) {
  const { data } = await client.post('/api/location/geocode', { query, count });
  return data;
}

// Reverse-geocode lat/lng to a place name (shows city/area address).
export async function reverseGeocode(lat, lng) {
  const { data } = await client.post('/api/location/reverse', { lat, lng });
  return data;
}

// Species shortlist + planting target. scene = analyzed report or {}.
export async function recommendPlanting({ lat, lng, name = '', scene = {}, objective = 'shade' }) {
  const { data } = await client.post('/api/plant/recommend', {
    lat,
    lng,
    name,
    scene,
    objective,
  });
  return data;
}

// Returns a browser-downloadable blob URL for a report JSON.
export async function downloadReport(id) {
  const { data } = await client.get(`/api/reports/${encodeURIComponent(id)}/download`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(data);
}

// ---------------------------------------------------------------------------
// Green Contribution + Green Champions
// ---------------------------------------------------------------------------

// Create a Green Contribution record. payload: { action_type, date, latitude,
// longitude, place_name, description, contributor_name, contributor_id }.
export async function createContribution(payload) {
  const { data } = await client.post('/api/contributions', payload);
  return data;
}

export async function fetchContributions() {
  const { data } = await client.get('/api/contributions');
  return data;
}

export async function uploadEvidence(contributionId, file) {
  const form = new FormData();
  form.append('photo', file);
  const { data } = await client.post(
    `/api/contributions/${encodeURIComponent(contributionId)}/evidence`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
}

export function evidenceUrl(contributionId) {
  return `${client.defaults.baseURL}/api/contributions/${encodeURIComponent(contributionId)}/evidence`;
}

export async function fetchLeaderboard(contributorId = '') {
  const { data } = await client.get('/api/leaderboard', {
    params: contributorId ? { contributor_id: contributorId } : {},
  });
  return data;
}
