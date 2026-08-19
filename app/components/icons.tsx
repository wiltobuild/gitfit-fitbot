import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3-1.1 4.6L7 8.7l3.9 1.1L12 14.5l1.1-4.7L17 8.7l-3.9-1.1L12 3Z" />
      <path d="m18.5 14-.6 2.3-2.4.7 2.4.6.6 2.4.7-2.4 2.3-.6-2.3-.7-.7-2.3Z" />
      <path d="m5.5 14.5-.4 1.6-1.6.4 1.6.4.4 1.6.4-1.6 1.6-.4-1.6-.4-.4-1.6Z" />
    </IconBase>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </IconBase>
  );
}

export function IconCalendarX(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M9 14l6 6M15 14l-6 6" />
    </IconBase>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="M14 18.5h6M17 15.5v6" />
    </IconBase>
  );
}

export function IconShield(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 19 6v5.4c0 4.2-2.8 7.4-7 9.1-4.2-1.7-7-4.9-7-9.1V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function IconSpinner(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    </IconBase>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

export function IconUser(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20c.65-3.45 3.05-5.25 6.5-5.25s5.85 1.8 6.5 5.25" />
    </IconBase>
  );
}

export function MomentumArc({ className, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 120 120" fill="none" {...props}>
      <defs>
        <linearGradient id="momentum-arc-gradient" x1="18" y1="95" x2="104" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1FC2AE" />
          <stop offset=".52" stopColor="#6E3FE0" />
          <stop offset="1" stopColor="#C43FD6" />
        </linearGradient>
      </defs>
      <path d="M24 86.5A45 45 0 1 1 96 38" stroke="url(#momentum-arc-gradient)" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
