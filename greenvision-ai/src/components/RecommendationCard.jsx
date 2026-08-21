import { Sprout, CheckCircle2, Info } from 'lucide-react';

const priorityStyle = {
  High: 'bg-red-500/10 text-red-400 border-red-500/20',
  Medium: 'bg-earth/10 text-earth border-earth/20',
  Low: 'bg-databue/10 text-databue border-databue/20',
};

export default function RecommendationCard({ recommendations = [], greenCover, targetGreenCover = 60 }) {
  if (recommendations.length === 0) {
    // Only claim "no action needed" when green cover was actually measured and
    // meets the target. Otherwise the empty state is an honest "not assessed".
    const meetsTarget = greenCover != null && greenCover >= targetGreenCover;
    return (
      <div className="bg-panel border border-white/10 rounded-2xl p-5 flex gap-4 items-start">
        <div className={`rounded-full p-2 shrink-0 ${meetsTarget ? 'bg-canopy/10' : 'bg-databue/10'}`}>
          {meetsTarget ? (
            <CheckCircle2 size={20} className="text-canopy" />
          ) : (
            <Info size={20} className="text-databue" />
          )}
        </div>
        <div>
          <h4 className="font-display font-semibold mb-1">
            {meetsTarget ? 'No action needed' : 'No recommendation generated'}
          </h4>
          <p className="text-mist-dim text-sm leading-relaxed">
            {meetsTarget
              ? 'Green cover in this scene already meets the target — no plantation recommended right now.'
              : 'Green cover or priority was not assessed for this scene, so no recommendation is produced rather than inventing one.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {recommendations.map((rec, i) => (
        <div key={i} className="bg-panel border border-white/10 rounded-2xl p-5 flex gap-4 items-start">
          <div className="bg-canopy/10 rounded-full p-2 shrink-0">
            <Sprout size={20} className="text-canopy" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-display font-semibold">{rec.title || 'Plantation recommendation'}</h4>
              {rec.priority && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${priorityStyle[rec.priority] || ''}`}>
                  {rec.priority}
                </span>
              )}
            </div>
            <p className="text-mist-dim text-sm leading-relaxed">{rec.text || rec.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
