import { LayoutDashboard, PanelLeftClose, PanelLeftOpen, Thermometer, Sprout, Bot, FileText, Upload, Factory } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

const MUNICIPAL_LINKS = [
  { to: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { to: '/climate-lab', label: 'Climate Lab', icon: Thermometer },
  { to: '/planting', label: 'Planting Plan', icon: Sprout },
  { to: '/advisor', label: 'AI Advisor', icon: Bot },
  { to: '/reports', label: 'Reports', icon: FileText },
];

const INDUSTRIAL_LINKS = [
  { to: '/dashboard', label: 'Site Overview', icon: LayoutDashboard },
  { to: '/upload', label: 'Site Analysis', icon: Upload },
  { to: '/planting', label: 'Green Buffer Plan', icon: Factory },
  { to: '/climate-lab', label: 'Investment & Impact', icon: Thermometer },
  { to: '/reports', label: 'Report', icon: FileText },
];

export default function Sidebar({ sceneId }) {
  const { mode } = useMode();
  const isIndustrial = mode === MODES.INDUSTRIAL;
  const navLinks = isIndustrial ? INDUSTRIAL_LINKS : MUNICIPAL_LINKS;
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();

  const isActive = (to) => pathname.startsWith(to);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 bg-canopy text-white p-3.5 rounded-full shadow-xl hover:scale-105 transition-transform"
        aria-label="Toggle Sidebar"
      >
        {isOpen ? <PanelLeftClose size={24} /> : <PanelLeftOpen size={24} />}
      </button>

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-[69px] lg:top-[69px] z-30 lg:z-10 h-[calc(100vh-69px)] w-72 bg-ink/95 light:bg-gray-50/95 backdrop-blur-xl border-r border-white/10 light:border-black/10 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Scene Info */}
        <div className="p-6 border-b border-white/5 light:border-black/5">
          <p className="text-xs font-mono text-mist-dim light:text-ink/50 mb-1 tracking-wider uppercase">Current Analysis</p>
          <div className="font-mono font-semibold text-sm bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-lg px-3 py-2 text-mist light:text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-canopy" />
            {sceneId}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navLinks.map((l) => {
            const active = isActive(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  active
                    ? 'bg-canopy/15 text-canopy font-medium border border-canopy/20'
                    : 'text-mist-dim light:text-ink/60 hover:text-mist light:hover:text-ink hover:bg-white/5 light:hover:bg-black/5'
                }`}
              >
                <l.icon size={18} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        <div className="p-6 border-t border-white/5 light:border-black/5 text-xs font-mono text-mist-dim light:text-ink/50">
          Model outputs render after each analysis. Every figure is source-labelled — nothing is fabricated.
        </div>
      </aside>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 top-[69px] bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
