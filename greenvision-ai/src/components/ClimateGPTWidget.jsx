import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, X, Send, Sparkles, User, Loader2, HelpCircle } from 'lucide-react';
import { getCurrentScene } from '../utils/sceneStore';
import { askAdvisor, extractError } from '../api/api';
import { buildAdvisorContext, advisorGreeting, advisorPrompts } from '../utils/advisor';
import { useMode } from '../context/useMode';
import { MODES } from '../context/mode';

const MODE_LABEL = {
  [MODES.MUNICIPAL]: 'Municipal',
  [MODES.INDUSTRIAL]: 'Industrial',
  [MODES.CITIZEN]: 'Citizen',
};

export default function ClimateGPTWidget() {
  const { mode } = useMode();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: advisorGreeting(mode) },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const messagesEndRef = useRef(null);

  const scene = useMemo(() => getCurrentScene(), []);

  const prompts = useMemo(
    () => advisorPrompts(scene, mode).filter((p) => typeof p === 'string' && p.trim().length > 0),
    [scene, mode],
  );

  // Build a short context line so the user knows what the advisor sees
  const contextLine = useMemo(() => {
    const parts = [];
    if (scene?.scene_type) parts.push(scene.scene_type);
    if (scene?.canopy_pct != null) parts.push(`${scene.canopy_pct}% canopy`);
    if (scene?.userLocation?.name) parts.push(scene.userLocation.name);
    else if (scene?.gps?.name) parts.push(scene.gps.name);
    return parts.length ? `Context: ${parts.join(' · ')}` : 'No scene analysed yet — ask about your area.';
  }, [scene]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || pending) return;

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    if (!textToSend) setInput('');
    setPending(true);

    try {
      const context = await buildAdvisorContext(mode, scene);
      const historyForBackend = messages.map((m) => ({ sender: m.sender, text: m.text }));
      const res = await askAdvisor(query, context, historyForBackend);
      const reply = res?.reply || res?.answer || 'The advisor did not return a response.';
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: `Advisor unavailable: ${extractError(err)}` }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-canopy hover:bg-canopy/90 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 group"
        aria-label="ClimateGPT AI Assistant"
      >
        <Bot size={24} className="group-hover:rotate-12 transition-transform" />
        <span className="font-display font-semibold text-sm hidden sm:inline">ClimateGPT</span>
      </button>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-full max-w-sm sm:max-w-md bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px]">

          {/* Modal Header */}
          <div className="bg-canopy/10 border-b border-white/10 light:border-black/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-canopy/20 text-canopy flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-mist light:text-ink flex items-center gap-1.5">
                  ClimateGPT <Sparkles size={12} className="text-canopy" />
                </h4>
                <span className="text-[10px] font-mono text-mist-dim light:text-ink/50">
                  {MODE_LABEL[mode] || 'Municipal'} advisor · {scene?.scene_type ? 'scene analysed' : 'no scene yet'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-mist-dim light:text-ink/60"
            >
              <X size={18} />
            </button>
          </div>

          {/* Context info bar */}
          <div className="px-4 py-2 border-b border-white/5 light:border-black/5 bg-white/3 light:bg-black/3">
            <p className="text-[10px] font-mono text-mist-dim/70 light:text-ink/40 flex items-center gap-1.5">
              <HelpCircle size={10} className="text-canopy shrink-0" /> {contextLine}
            </p>
          </div>

          {/* Suggested Questions */}
          {prompts.length > 0 && (
            <div className="p-3 border-b border-white/5 light:border-black/5 bg-white/5 light:bg-black/5">
              <p className="text-[9px] font-mono text-mist-dim/50 light:text-ink/30 uppercase tracking-widest mb-2">Suggested questions</p>
              <div className="flex flex-wrap gap-1.5">
                {prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p)}
                    className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 px-2.5 py-1 rounded-full hover:border-canopy hover:text-canopy transition-colors text-[11px] font-mono"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-body text-xs">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${m.sender === 'user' ? 'bg-databue/20 text-databue' : 'bg-canopy/20 text-canopy'}`}>
                  {m.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-3 leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-canopy text-white rounded-tr-none'
                    : 'bg-white/5 light:bg-black/5 text-mist light:text-ink border border-white/8 light:border-black/8 rounded-tl-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-canopy/20 text-canopy">
                  <Bot size={14} />
                </div>
                <div className="max-w-[80%] rounded-2xl p-3 leading-relaxed bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-tl-none flex items-center gap-2 text-mist-dim light:text-ink/60">
                  <Loader2 size={13} className="animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-white/10 light:border-black/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask ClimateGPT a question..."
              className="flex-1 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-full px-4 py-2 text-xs text-mist light:text-ink focus:outline-none focus:border-canopy"
            />
            <button
              onClick={() => handleSend()}
              disabled={pending}
              className="w-9 h-9 rounded-full bg-canopy text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>

        </div>
      )}
    </>
  );
}
