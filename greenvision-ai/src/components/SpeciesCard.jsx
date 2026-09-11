import { TreePine } from 'lucide-react';

// Tree species card for Municipal / Industrial dashboards.
//
// Two metrics are displayed SEPARATELY and are never conflated:
//   - Coverage % : measured pixel area of that species' detected trunks
//                  divided by the whole image area (geometry from the
//                  backend's trunk boxes).
//   - Confidence % : the species classifier's per-trunk confidence.
//
// The backend returns both `species` (per trunk, with bounding box) and
// `speciesCoverage` (grouped per species). If geometry is missing we say so —
// coverage is NEVER approximated from confidence.
export default function SpeciesCard({ r, accent = 'canopy', title = 'TREE SPECIES' }) {
  const isBlue = accent === 'databue';
  const text = isBlue ? 'text-databue' : 'text-canopy';
  const chipBg = isBlue ? 'bg-databue/10' : 'bg-canopy/10';
  const chipBorder = isBlue ? 'border-databue/25' : 'border-canopy/25';
  const cardBorder = isBlue ? 'border-databue/20 light:border-databue/10' : 'border-white/10 light:border-black/10';

  const species = Array.isArray(r.species) ? r.species : [];
  const coverage = Array.isArray(r.speciesCoverage) ? r.speciesCoverage : null;

  // Only meaningful on street scenes that ran the trunk detector.
  if (r.species == null && r.detectedTrees == null) return null;

  return (
    <div className={`mb-8 bg-white/5 light:bg-white border ${cardBorder} rounded-2xl p-5 shadow-sm`}>
      <p className={`text-[10px] font-mono ${text} font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5`}>
        <TreePine size={13} /> {title}
      </p>

      {species.length > 0 && coverage ? (
        <>
          <p className="text-[11px] font-mono text-mist-dim light:text-ink/50 mb-3">
            {r.detectedTrees} trunk{r.detectedTrees === 1 ? '' : 's'} detected &middot; coverage = trunk area / image area &middot; confidence = classifier per trunk
          </p>
          <div className="space-y-2">
            {coverage.map((c) => (
              <div key={c.species} className={`${chipBg} border ${chipBorder} rounded-xl px-3 py-2.5 flex items-center justify-between flex-wrap gap-x-4 gap-y-1`}>
                <div className="flex items-center gap-2">
                  <TreePine size={13} className={text} />
                  <span className={`text-[12px] font-mono font-semibold ${text}`}>{c.species}</span>
                  <span className="text-[10px] font-mono text-mist-dim light:text-ink/50">
                    {c.trunk_count} trunk{c.trunk_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className="text-mist light:text-ink">
                    <span className="text-mist-dim light:text-ink/50">Coverage </span>
                    {c.coverage_percentage != null ? `${c.coverage_percentage}%` : '—'}
                  </span>
                  <span className="text-mist light:text-ink">
                    <span className="text-mist-dim light:text-ink/50">Confidence </span>
                    {c.classification_confidence != null ? `${(c.classification_confidence * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : species.length > 0 ? (
        <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">
          Species were classified ({species.map((s) => s.species).join(', ')}) but no detection geometry was returned, so species coverage cannot be computed. Coverage is never approximated from classifier confidence.
        </p>
      ) : (
        <p className="text-xs text-mist-dim light:text-ink/60 leading-relaxed">
          {r.detectedTrees === 0
            ? 'No tree trunks were detected in this image, so no species could be identified. Upload a street-level photo where individual trunks are clearly visible to identify species.'
            : 'This image type (aerial / drone view) does not run the trunk–species analysis. Upload a street-level photo of trees to identify their species.'}
        </p>
      )}
    </div>
  );
}