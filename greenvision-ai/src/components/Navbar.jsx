import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Satellite, Menu, X, Sun, Moon, Building2, Factory, User } from 'lucide-react';
import useTheme from '../hooks/useTheme';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';
import { MUNICIPAL_LINKS, INDUSTRIAL_LINKS, CITIZEN_LINKS } from '../utils/navLinks';

const MODE_META = {
  [MODES.MUNICIPAL]: { icon: Building2, label: 'Municipal', navLinks: MUNICIPAL_LINKS },
  [MODES.INDUSTRIAL]: { icon: Factory, label: 'Industrial', navLinks: INDUSTRIAL_LINKS },
  [MODES.CITIZEN]: { icon: User, label: 'Citizen', navLinks: CITIZEN_LINKS },
};

const MODE_LIST = [
  { value: MODES.MUNICIPAL, label: 'Municipal', icon: Building2 },
  { value: MODES.INDUSTRIAL, label: 'Industrial', icon: Factory },
  { value: MODES.CITIZEN, label: 'Citizen', icon: User },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const { mode, setMode } = useMode();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLanding = pathname === '/';
  const meta = MODE_META[mode] || MODE_META[MODES.CITIZEN];
  const links = meta.navLinks;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, mode]);

  const isActive = (to) => pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-ink/80 dark:bg-ink/80 light:bg-white/85 border-b border-white/10 light:border-black/10">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-display font-semibold text-lg tracking-tight group">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-canopy/15 group-hover:bg-canopy/25 transition-colors">
            <Satellite size={18} className="text-canopy" />
          </span>
          <span className="light:text-ink font-bold">
            GreenVision<span className="ndvi-text">.AI</span>
          </span>
        </Link>

        {/* Desktop Nav Links — hidden on landing page */}
        {!isLanding && (
          <div className="hidden lg:flex items-center gap-1 text-sm font-medium">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 rounded-full transition-all duration-200 text-xs font-mono ${
                  isActive(l.to)
                    ? 'bg-canopy/15 text-canopy font-semibold border border-canopy/20'
                    : 'text-mist-dim light:text-ink/60 hover:text-mist light:hover:text-ink hover:bg-white/5 light:hover:bg-black/5'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/about"
              className="px-3 py-1.5 rounded-full transition-all duration-200 text-xs font-mono text-mist-dim light:text-ink/60 hover:text-mist light:hover:text-ink hover:bg-white/5 light:hover:bg-black/5"
            >
              About
            </Link>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">

          {/* Mode Switcher — only visible inside workspace */}
          {!isLanding && (
            <div className="hidden sm:flex items-center gap-1 bg-black/20 light:bg-black/5 rounded-full p-0.5 border border-white/10 light:border-black/10">
              {MODE_LIST.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all ${
                      mode === m.value
                        ? 'bg-canopy text-white shadow-sm'
                        : 'text-mist-dim light:text-ink/50 hover:text-mist light:hover:text-ink'
                    }`}
                  >
                    <Icon size={12} />
                    <span className="hidden md:inline">{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-full text-mist-dim light:text-ink/60 hover:text-mist light:hover:text-ink hover:bg-white/10 light:hover:bg-black/10 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg text-mist-dim light:text-ink/60 hover:text-mist hover:bg-white/10 light:hover:bg-black/10 transition-colors"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 light:border-black/10 px-6 py-4 flex flex-col gap-2 bg-panel light:bg-white">

          {/* Landing mobile links */}
          {isLanding ? (
            <>
              <p className="text-[10px] font-mono text-mist-dim light:text-ink/50 uppercase tracking-wider mb-2">Workspaces</p>
              {MODE_LIST.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.value}
                    to="/dashboard"
                    onClick={() => { setMode(m.value); setMobileOpen(false); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 hover:border-canopy/30 transition-colors"
                  >
                    <Icon size={16} />
                    <span className="text-sm font-medium">{m.label} workspace</span>
                  </Link>
                );
              })}
              <Link to="/about" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-mist-dim light:text-ink/70">
                About
              </Link>
            </>
          ) : (
            <>
              {/* Mobile Mode Switcher */}
              <div className="flex gap-1.5 mb-3 px-1">
                {MODE_LIST.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-mono border ${
                        mode === m.value
                          ? 'bg-canopy/20 text-canopy border-canopy/30'
                          : 'text-mist-dim light:text-ink/70 border-white/10 light:border-black/10'
                      }`}
                    >
                      <Icon size={12} />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(l.to) ? 'bg-canopy/15 text-canopy font-semibold' : 'text-mist-dim light:text-ink/70'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                to="/about"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-mist-dim light:text-ink/70"
              >
                About
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
