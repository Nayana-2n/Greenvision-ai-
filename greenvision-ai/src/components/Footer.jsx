import { Satellite, FileText, Factory, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

export default function Footer() {
  const { mode } = useMode();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const isMunicipal = mode === MODES.MUNICIPAL;
  const isIndustrial = mode === MODES.INDUSTRIAL;

  const links = isMunicipal
    ? [
        { to: '/upload', label: 'Analyze Image' },
        { to: '/dashboard', label: 'Command Center' },
        { to: '/climate-lab', label: 'Climate Lab & Simulator' },
        { to: '/planting', label: 'Planting Plan' },
        { to: '/reports', label: 'Assessment Reports' },
      ]
    : isIndustrial
    ? [
        { to: '/upload', label: 'Site Analysis' },
        { to: '/dashboard', label: 'Site Overview' },
        { to: '/planting', label: 'Green Buffer Plan' },
        { to: '/climate-lab', label: 'Investment & Impact' },
        { to: '/reports', label: 'Report' },
      ]
    : [
        { to: '/dashboard', label: 'My Area' },
        { to: '/planting', label: 'What Can I Plant' },
        { to: '/climate-lab', label: 'My Tree Impact' },
        { to: '/advisor', label: 'AI Advisor' },
        { to: '/reports', label: 'My Action Plan' },
        { to: '/contribute', label: 'Contribute' },
        { to: '/leaderboard', label: 'Green Champions' },
      ];

  return (
    <footer className="border-t border-white/10 light:border-black/10 mt-24 bg-panel/50 light:bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">

          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2 font-display font-semibold text-lg">
              <Satellite size={20} className="text-canopy" />
              GreenVision<span className="ndvi-text">.AI</span>
            </Link>
            <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">
              {isLanding
                ? 'AI-powered environmental intelligence for cities, industries and communities.'
                : isMunicipal
                ? 'Urban green intelligence — from aerial image to a decision-ready planting plan.'
                : isIndustrial
                ? 'Industrial green-buffer planning — site analysis to a buffer intervention plan with honest, calculated impact.'
                : 'Your green assistant — what to plant in your area, how to care for it, and what one tree does for the climate.'}
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-mist light:text-ink font-semibold mb-3">
              {isMunicipal ? 'Platform Modules' : isIndustrial ? 'Site Toolkit' : 'Your Toolkit'}
            </h4>
            <ul className="space-y-2 text-xs font-mono text-mist-dim light:text-ink/60">
              {links.map((l) => (
                <li key={l.to}><Link to={l.to} className="hover:text-canopy">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-mist light:text-ink font-semibold mb-3">
              UN SDG Alignment
            </h4>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-mist-dim light:text-ink/60">
              <span className="bg-canopy/10 text-canopy border border-canopy/20 px-2 py-1 rounded-md">SDG 11: Sustainable Cities</span>
              <span className="bg-databue/10 text-databue border border-databue/20 px-2 py-1 rounded-md">SDG 13: Climate Action</span>
              <span className="bg-earth/10 text-earth border border-earth/20 px-2 py-1 rounded-md">SDG 15: Life on Land</span>
            </div>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-mist light:text-ink font-semibold mb-3">
              Platform
            </h4>
            <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed mb-3">
              AI-powered urban green intelligence for cities, industries and citizens.
            </p>
            <div className="flex items-center gap-3 text-xs font-mono text-mist-dim light:text-ink/60">
              <Link to="/reports" className="flex items-center gap-1 hover:text-canopy"><FileText size={14} /> Reports</Link>
              <Link to="/about" className="flex items-center gap-1 hover:text-canopy"><Factory size={14} /> Industrial</Link>
              <Link to="/contribute" className="flex items-center gap-1 hover:text-canopy"><User size={14} /> Citizens</Link>
            </div>
          </div>

        </div>

        <div className="pt-6 border-t border-white/5 light:border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-mist-dim light:text-ink/50">
          <span>© 2026 GreenVision.AI — All Rights Reserved</span>
          <span>Every figure source-labelled · no fabricated values</span>
        </div>
      </div>
    </footer>
  );
}
