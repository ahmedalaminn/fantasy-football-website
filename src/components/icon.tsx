import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "matchups"
  | "activity"
  | "standings"
  | "teams"
  | "history"
  | "league"
  | "external"
  | "more"
  | "arrow"
  | "trophy"
  | "spark"
  | "calendar"
  | "close";

const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  matchups: (
    <>
      <path d="M6 3v4M18 3v4M4 8h16" />
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="m8 13 2 2 5-5" />
    </>
  ),
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  standings: (
    <>
      <path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7" />
    </>
  ),
  teams: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M14 15c3.5-.6 7 1.2 7 5" />
    </>
  ),
  history: (
    <>
      <path d="M8 3h8v4a4 4 0 0 1-8 0V3Z" />
      <path d="M6 4H3v2a4 4 0 0 0 5 4M18 4h3v2a4 4 0 0 1-5 4M12 11v5M8 21h8M9 16h6v5" />
    </>
  ),
  league: (
    <>
      <path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v7H4V6h7" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  trophy: (
    <>
      <path d="M8 3h8v4a4 4 0 0 1-8 0V3Z" />
      <path d="M6 4H3v2a4 4 0 0 0 5 4M18 4h3v2a4 4 0 0 1-5 4M12 11v5M8 21h8M9 16h6v5" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.8 4.8L19 10l-5.2 2.2L12 17l-1.8-4.8L5 10l5.2-2.2L12 3Z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
