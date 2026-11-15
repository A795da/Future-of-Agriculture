// Small line icons (inline SVG, 24×24 grid, drawn with currentColor) used in
// place of emoji, so they look the same on every phone and follow the theme.

const PATHS = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  map: (
    <>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M8 17v-5M13 17V8M18 17v-8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />
    </>
  ),
  droplet: <path d="M12 3s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z" />,
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
      <path d="M9 18c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.5-2.1-2.7-5-3" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z" />
      <path d="M5 19l7-7" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  thermo: (
    <>
      <path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z" />
      <path d="M12 9v8" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-1 8H7z" />
      <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
    </>
  ),
  cloud: <path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10a4 4 0 0 1-1 8H7z" />,
  partly: (
    <>
      <path d="M8 3v1.5M3.5 8H2M4.8 4.8l1 1M12.2 4.8l-1 1" />
      <path d="M5.6 11a3.5 3.5 0 1 1 6-3.4" />
      <path d="M9 20a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.4 1.2A3.5 3.5 0 0 1 18 20H9z" />
    </>
  ),
  fog: (
    <>
      <path d="M7 12a4.5 4.5 0 0 1-.5-8A6 6 0 0 1 18 5a4 4 0 0 1-1 7" />
      <path d="M4 16h16M6 20h12" />
    </>
  ),
  drizzle: (
    <>
      <path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-1 8H7z" />
      <path d="M9 19v.01M13 19v.01M11 21.5v.01M15 21.5v.01" />
    </>
  ),
  snow: (
    <>
      <path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-1 8H7z" />
      <path d="M8 19.5h.01M12 19.5h.01M16 19.5h.01M10 22h.01M14 22h.01" />
    </>
  ),
  storm: (
    <>
      <path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-1 8" />
      <path d="M13 12l-3 5h4l-3 5" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />,
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  satellite: (
    <>
      <path d="M13 7l4 4-6 6-4-4z" />
      <path d="M7 13l-4 4 4 4 4-4M17 11l4-4-4-4-4 4" />
      <path d="M16 18a4 4 0 0 0 4-4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  plus: <path d="M12 6v12M6 12h12" />,
  minus: <path d="M6 12h12" />,
  dot: <circle cx="12" cy="12" r="2.5" fill="currentColor" />,
  sparkle: <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />,
};

export default function Icon({ name, size = "1.15em", className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
