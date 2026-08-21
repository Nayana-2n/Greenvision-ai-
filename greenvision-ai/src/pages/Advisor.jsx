import { useState } from 'react';
import { Bot, Send, User, Loader2 } from 'lucide-react';
import { getCurrentScene } from '../utils/sceneStore';
import { askAdvisor, extractError } from '../api/api';
import { buildAdvisorContext, advisorPrompts, advisorGreeting } from '../utils/advisor';
import { useMode } from '../context/useMode';

export default function Advisor() {
  const { mode } = useMode();
  const [messages, setMessages] = useState([
    { sender: 'bot', text: advisorGreeting(mode) },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);

  const scene = getCurrentScene();
  const prompts = advisorPrompts(scene, mode);

  const handleSend = async (queryText) => {
    const text = (queryText || input).trim();
    if (!text || pending) return;

    setMessages((prev) => [...prev, { sender: 'user', text }]);
    if (!queryText) setInput('');
    setPending(true);

    // Ask the backend advisor with scene + live location context + mode.
    try {
      const context = await buildAdvisorContext(mode, scene);
      const historyForBackend = messages.map((m) => ({ sender: m.sender, text: m.text }));
      const res = await askAdvisor(text, context, historyForBackend);
      const reply = res?.reply || res?.answer || 'The advisor did not return a response.';
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: `Advisor unavailable: ${extractError(err)}` }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-16 space-y-8">
      
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-3">
          <Bot size={14} /> AI CLIMATE ADVISOR
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-mist light:text-ink">
          {mode === 'citizen' ? 'Your Green Assistant' : mode === 'industrial' ? 'Green-Buffer Planning Advisor' : 'ClimateGPT Executive Policy Assistant'}
        </h1>
        <p className="text-mist-dim light:text-ink/60 text-sm mt-1">
          {mode === 'citizen'
            ? 'Ask about the current scene AND your location — canopy, carbon/oxygen, what to plant here, and how to care for it.'
            : mode === 'industrial'
            ? 'Ask about this site plus live location context — canopy cover, tree estimates, carbon &amp; oxygen, density, priority, buffer species and trees-needed to target.'
            : 'Ask about this analysis plus live location context — canopy cover, tree estimates, carbon &amp; oxygen, density, priority, species and trees-needed to target.'}
        </p>
      </div>

      {/* Main Chat Panel */}
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
        
        {/* Top Prompt Chips */}
        <div className="p-4 border-b border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 flex gap-2 overflow-x-auto font-mono text-xs">
          {prompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 text-mist-dim light:text-ink/70 px-3 py-1.5 rounded-full hover:border-canopy hover:text-canopy transition-colors shrink-0"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 font-body text-sm">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.sender === 'user' ? 'bg-databue/20 text-databue' : 'bg-canopy/20 text-canopy'}`}>
                {m.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 leading-relaxed whitespace-pre-line ${
                m.sender === 'user'
                  ? 'bg-canopy text-white rounded-tr-none font-medium'
                  : 'bg-white/5 light:bg-black/5 text-mist light:text-ink border border-white/8 light:border-black/8 rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-canopy/20 text-canopy">
                <Bot size={18} />
              </div>
              <div className="max-w-[80%] rounded-2xl p-4 leading-relaxed bg-white/5 light:bg-black/5 border border-white/8 light:border-black/8 rounded-tl-none flex items-center gap-2 text-mist-dim light:text-ink/60 text-sm">
                <Loader2 size={15} className="animate-spin" /> Reading the scene and your location…
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 light:border-black/10 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'citizen' ? "Ask about your area, or what tree to plant here..." : "Ask about the current scene or this location..."}
            className="flex-1 bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 rounded-full px-5 py-3 text-sm text-mist light:text-ink focus:outline-none focus:border-canopy"
          />
          <button
            onClick={() => handleSend()}
            disabled={pending}
            className="bg-canopy hover:bg-canopy/90 text-white font-semibold px-6 py-3 rounded-full transition-transform hover:scale-105 flex items-center gap-2 text-sm disabled:opacity-50 disabled:hover:scale-100"
          >
            Send <Send size={16} />
          </button>
        </div>

      </div>

    </div>
  );
}
