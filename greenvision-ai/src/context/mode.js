// Shared mode constants and the context object for the three product modes.
// Kept separate from ModeContext.jsx so that file only exports the
// <ModeProvider> component (clean fast-refresh / lint boundaries).

import { createContext } from 'react';

export const MODES = {
  MUNICIPAL: 'municipal',
  INDUSTRIAL: 'industrial',
  CITIZEN: 'citizen',
};

export const ModeContext = createContext(null);
