// ModeContext — the single source of truth for Municipal vs Citizen mode.
// Previously the mode toggle only restyled the Navbar button and changed
// nothing else; now every page reads the mode to render genuinely different
// experiences (municipal decision-support vs personal environmental assistant).
//
// This file exports ONLY the <ModeProvider> component. The MODES constants
// and useMode() hook live in ./mode and ./useMode so fast refresh and lint
// stay clean.

import { useEffect, useMemo, useState } from 'react';
import { ModeContext, MODES } from './mode';

const MODE_KEY = 'gv-mode';

function loadInitialMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === MODES.MUNICIPAL || stored === MODES.INDUSTRIAL || stored === MODES.CITIZEN) {
      return stored;
    }
  } catch {
    /* storage unavailable */
  }
  return MODES.MUNICIPAL;
}

export function ModeProvider({ children }) {
  const [mode, setMode] = useState(loadInitialMode);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}
