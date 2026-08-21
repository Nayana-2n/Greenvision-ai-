// useMode — reads the current Municipal vs Citizen mode. Lives in its own
// module (not inside ModeContext.jsx) so that file only exports components,
// keeping fast-refresh / lint clean.

import { useContext } from 'react';
import { ModeContext } from './mode';

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used inside <ModeProvider>');
  return ctx;
}
