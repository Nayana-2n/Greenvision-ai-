import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';

// Register only the ChartJS pieces this file actually uses.
ChartJS.register(ArcElement, Tooltip, Legend);

// Use CSS variables defined in index.css so charts automatically adapt to light/dark mode
const textColor = 'var(--color-mist-dim)';
const canopyColor = '#3FA34D';
const earthColor = '#C9A05C';
const databueColor = '#4FA8D8';

function EmptyChart({ message }) {
  return (
    <div className="h-full min-h-[190px] flex flex-col items-center justify-center gap-2 text-center px-4">
      <BarChart3 size={22} className="text-mist-dim light:text-ink/40" />
      <p className="text-xs font-mono text-mist-dim light:text-ink/50 leading-relaxed">{message}</p>
    </div>
  );
}

export function CoverPieChart({ scene }) {
  const chartData = scene?.landCoverSplit;
  if (!chartData) {
    return <EmptyChart message="Land cover split requires canopy segmentation — no split was returned for this scene." />;
  }
  const data = {
    labels: chartData.labels,
    datasets: [{
      data: chartData.data,
      backgroundColor: [canopyColor, earthColor, databueColor],
      borderWidth: 0, // Removed border to look cleaner in both themes
      hoverOffset: 4,
    }],
  };
  return (
    <Pie
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 11 }, padding: 20 } },
          tooltip: {
            backgroundColor: 'rgba(11, 15, 13, 0.9)', // Ink background
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
          },
        },
      }}
    />
  );
}
