// Single source of truth for the workspace navigation used by BOTH the top
// Navbar and the left Sidebar, so the two can never show different options.

import { Upload, LayoutDashboard, Thermometer, Bot, History, FileText, Sprout, User, Trophy } from 'lucide-react';

export const MUNICIPAL_LINKS = [
  { to: '/upload', label: 'Analyze', icon: Upload },
  { to: '/dashboard', label: 'Diagnosis', icon: LayoutDashboard },
  { to: '/climate-lab', label: 'Climate Lab', icon: Thermometer },
  { to: '/advisor', label: 'AI Advisor', icon: Bot },
  { to: '/temporal', label: 'Historical', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
];

export const INDUSTRIAL_LINKS = [
  { to: '/upload', label: 'Site Analysis', icon: Upload },
  { to: '/dashboard', label: 'Diagnosis', icon: LayoutDashboard },
  { to: '/planting', label: 'Species', icon: Sprout },
  { to: '/climate-lab', label: 'Climate Lab', icon: Thermometer },
  { to: '/reports', label: 'Report', icon: FileText },
];

export const CITIZEN_LINKS = [
  { to: '/upload', label: 'Analyze', icon: Upload },
  { to: '/dashboard', label: 'My Area', icon: LayoutDashboard },
  { to: '/planting', label: 'Ask GreenVision', icon: Bot },
  { to: '/contribute', label: 'Contribute', icon: User },
  { to: '/leaderboard', label: 'Champions', icon: Trophy },
];