import { ShieldCheck, Cpu, Layout, Server, Layers } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-canopy bg-canopy/10 border border-canopy/20 px-3 py-1.5 rounded-full mb-3">
          <ShieldCheck size={14} /> PLATFORM ARCHITECTURE
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-mist light:text-ink">
          About GreenVision.AI
        </h1>
        <p className="text-mist-dim light:text-ink/70 text-base mt-2 max-w-2xl">
          An AI-powered spatial intelligence platform for urban green cover assessment, climate adaptation planning, and canopy preservation.
        </p>
      </div>

      {/* Problem Statement Card */}
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 md:p-8 shadow-xl">
        <h2 className="text-xs font-mono text-mist-dim light:text-ink/50 uppercase tracking-widest mb-2">OFFICIAL PROBLEM STATEMENT</h2>
        <p className="font-display font-bold text-xl text-mist light:text-ink leading-relaxed">
          AI-GIS Based Urban Green Cover Assessment for Carbon Sequestration and Oxygen Estimation.
        </p>
        <p className="text-mist-dim light:text-ink/70 text-sm mt-3 leading-relaxed">
          GreenVision.AI isolates canopy from high-resolution aerial imagery, measures vegetation cover, estimates tree counts and annual carbon/oxygen output, assesses plantation priority, and generates municipality-ready plantation protocols.
        </p>
      </div>

      {/* UN Sustainable Development Goals (SDGs) */}
      <div>
        <h3 className="font-display font-bold text-xl text-mist light:text-ink mb-4">UN SDG Alignment</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-canopy/10 border border-canopy/20 rounded-2xl p-5">
            <span className="font-mono font-bold text-canopy text-sm block mb-1">SDG 11</span>
            <h4 className="font-display font-semibold text-mist light:text-ink text-sm">Sustainable Cities</h4>
            <p className="text-mist-dim light:text-ink/60 text-xs mt-1">Enhancing inclusive green public spaces & urban climate resilience.</p>
          </div>
          <div className="bg-databue/10 border border-databue/20 rounded-2xl p-5">
            <span className="font-mono font-bold text-databue text-sm block mb-1">SDG 13</span>
            <h4 className="font-display font-semibold text-mist light:text-ink text-sm">Climate Action</h4>
            <p className="text-mist-dim light:text-ink/60 text-xs mt-1">Integrating spatial tree data into municipal climate adaptation policy.</p>
          </div>
          <div className="bg-earth/10 border border-earth/20 rounded-2xl p-5">
            <span className="font-mono font-bold text-earth text-sm block mb-1">SDG 15</span>
            <h4 className="font-display font-semibold text-mist light:text-ink text-sm">Life on Land</h4>
            <p className="text-mist-dim light:text-ink/60 text-xs mt-1">Mapping urban greenery to inform planting decisions and ecosystem preservation.</p>
          </div>
        </div>
      </div>

      {/* System Architecture Diagram */}
      <div className="bg-panel light:bg-white border border-white/10 light:border-black/10 rounded-3xl p-6 md:p-8 shadow-xl">
        <h3 className="font-display font-bold text-xl text-mist light:text-ink mb-6 flex items-center gap-2">
          <Layers size={20} className="text-databue" /> System Architecture Diagram
        </h3>

        <div className="grid sm:grid-cols-3 gap-4 font-mono text-xs text-center">
          <div className="bg-white/5 light:bg-black/5 p-4 rounded-2xl border border-white/5">
            <Layout size={20} className="text-canopy mx-auto mb-2" />
            <span className="font-bold text-mist light:text-ink block">Frontend / GIS</span>
            <p className="text-mist-dim light:text-ink/60 text-[10px] mt-1">React + Vite, Tailwind v4, Leaflet GIS, Chart.js, Framer Motion</p>
          </div>

          <div className="bg-white/5 light:bg-black/5 p-4 rounded-2xl border border-white/5">
            <Server size={20} className="text-databue mx-auto mb-2" />
            <span className="font-bold text-mist light:text-ink block">Backend Shell</span>
            <p className="text-mist-dim light:text-ink/60 text-[10px] mt-1">Flask (Python), CORS, RESTful API Endpoints</p>
          </div>

          <div className="bg-white/5 light:bg-black/5 p-4 rounded-2xl border border-white/5">
            <Cpu size={20} className="text-earth mx-auto mb-2" />
            <span className="font-bold text-mist light:text-ink block">AI / ML Pipeline</span>
            <p className="text-mist-dim light:text-ink/60 text-[10px] mt-1">YOLO Scene Router, YOLO Segmentation Models, Carbon Math</p>
          </div>
        </div>
      </div>

      {/* Roadmap — Future Modules (explicitly not part of today's pipeline) */}
      <div>
        <h3 className="font-display font-bold text-xl text-mist light:text-ink mb-2">Roadmap — Future Modules</h3>
        <p className="text-mist-dim light:text-ink/60 text-xs font-mono mb-5 leading-relaxed">
          These capabilities require dedicated data sources and models. GreenVision does not display them today and never
          fabricates their output — they are planned expansion, not broken features.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Heat-stress mapping', 'Urban heat-island modelling from thermal imagery.'],
            ['AQI forecasting', 'Air-quality prediction grounded in a forecast model.'],
            ['Cooling corridors', 'Connectivity analysis between green pockets.'],
            ['Biodiversity monitoring', 'Species-diversity assessment from verified datasets.'],
            ['Historical change', 'Multi-date imagery to track canopy over time.'],
            ['Illegal tree-loss detection', 'Automated removal alerts from repeat captures.'],
            ['AI photo verification', 'Automated check of contribution evidence photos.'],
            ['Pollution & temperature prediction', 'Grounded forecast models, not assumptions.'],
            ['Government savings model', 'Costed procurement and maintenance scenarios.'],
            ['College & company challenges', 'Group leaderboards for schools, colleges and companies.'],
            ['2030 canopy forecasting', 'Scenario projection toward 2030 targets.'],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-4 shadow-sm">
              <span className="text-[9px] font-mono text-databue bg-databue/10 border border-databue/20 px-2 py-0.5 rounded-full">
                PLANNED
              </span>
              <h4 className="font-display font-semibold text-mist light:text-ink text-sm mt-2">{title}</h4>
              <p className="text-mist-dim light:text-ink/60 text-[11px] mt-1 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Breakdown */}
      <div>
        <h3 className="font-display font-bold text-xl text-mist light:text-ink mb-4">Meet the Team</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 shadow-sm">
            <h4 className="font-display font-bold text-lg text-mist light:text-ink">Nayana</h4>
            <p className="text-xs font-mono text-canopy font-semibold">Frontend, GIS & Integration Lead</p>
            <p className="text-mist-dim light:text-ink/70 text-xs mt-2 leading-relaxed">
              Designed the React architecture, the command-center dashboard, GIS maps, the climate lab, and the Flask API integration layer.
            </p>
          </div>

          <div className="bg-white/5 light:bg-white border border-white/10 light:border-black/10 rounded-2xl p-6 shadow-sm">
            <h4 className="font-display font-bold text-lg text-mist light:text-ink">Kasumurthi Rishitha Sree</h4>
            <p className="text-xs font-mono text-databue font-semibold">AI & ML Lead</p>
            <p className="text-mist-dim light:text-ink/70 text-xs mt-2 leading-relaxed">
              Developed the computer vision model for tree canopy detection, instance segmentation masks, and backend environmental math algorithms.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
