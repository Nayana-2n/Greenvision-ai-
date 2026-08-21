// Persists the user's chosen location across pages (sessionStorage).
// Used by Citizen Mode so "My Area" / "What Can I Plant" work without
// uploading an aerial image — the citizen journey is location-first.

const KEY = 'gv-user-location';

export function setUserLocation(location) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(location));
  } catch {
    /* ignore */
  }
}

export function getUserLocation() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearUserLocation() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
