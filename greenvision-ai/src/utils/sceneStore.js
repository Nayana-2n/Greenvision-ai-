// Keeps the current scene (live analysis result) in sessionStorage so the
// Dashboard / Climate Lab / Advisor / Reports can read it after navigation
// without re-uploading.

const KEY = 'gv-current-scene';

export function setCurrentScene(result) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

export function getCurrentScene() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCurrentScene() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
