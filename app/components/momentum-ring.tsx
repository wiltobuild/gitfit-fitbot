import { useId } from "react";

type MomentumRingProps = {
  value: number;
  target: number;
  size?: number;
  className?: string;
};

export default function MomentumRing({ value, target, size = 188, className }: MomentumRingProps) {
  const gradientId = useId();
  const safeTarget = Math.max(target, 1);
  const progress = Math.min(Math.max(value / safeTarget, 0), 1);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`momentum-ring${className ? ` ${className}` : ""}`} style={{ width: size, height: size }}>
      <svg aria-hidden="true" viewBox="0 0 120 120">
        <defs>
          <linearGradient id={gradientId} x1="18" y1="95" x2="104" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1FC2AE" />
            <stop offset=".52" stopColor="#6E3FE0" />
            <stop offset="1" stopColor="#C43FD6" />
          </linearGradient>
        </defs>
        <circle className="momentum-ring-track" cx="60" cy="60" r={radius} />
        <circle
          className="momentum-ring-progress"
          cx="60"
          cy="60"
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <span className="momentum-ring-value">{value}</span>
    </div>
  );
}
