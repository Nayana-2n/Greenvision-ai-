import { useState, useMemo, useCallback } from 'react';
import { AuthContext } from './AuthContextObj';
import { ROLES } from './roles';

const AUTH_KEY = 'gv-auth';

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadAuth);

  const login = useCallback((email, name, role) => {
    const u = {
      email,
      name: name || email.split('@')[0],
      role: role || ROLES.CITIZEN,
      id: 'gv-' + Math.random().toString(36).slice(2, 10),
    };
    setUser(u);
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); } catch { /* */ }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(AUTH_KEY); } catch { /* */ }
  }, []);

  const switchRole = useCallback((role) => {
    setUser((prev) => {
      if (!prev) return prev;
      const u = { ...prev, role };
      try { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); } catch { /* */ }
      return u;
    });
  }, []);

  const value = useMemo(() => ({ user, login, logout, switchRole }), [user, login, logout, switchRole]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
