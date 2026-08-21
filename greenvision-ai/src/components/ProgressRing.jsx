export default function ProgressRing({ 
  percentage, 
  size = 140, 
  strokeWidth = 12, 
  label = 'Target' 
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Calculate dash offset based on percentage
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-white/10 light:stroke-black/10"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Foreground Progress Indicator */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-canopy transition-all duration-1000 ease-out"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="font-display font-semibold text-3xl text-mist light:text-ink">
            {percentage}%
          </span>
        </div>
      </div>
      
      {/* Label beneath ring */}
      <span className="text-sm font-mono tracking-wider text-mist-dim light:text-ink/60 uppercase text-center">
        {label}
      </span>
    </div>
  );
}
