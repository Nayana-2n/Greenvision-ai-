// Lightweight user identity — stores the display name in localStorage.
// No auth system; this is just for personalizing the greeting.

const NAME_KEY = 'gv-user-name';

export function getUserName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function setUserName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

export function clearUserName() {
  try {
    localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}

export function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
