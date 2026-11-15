// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Hand-drawn stroke icons (24px grid). No external icon set and no agency insignia.

const PATHS: Record<string, string> = {
  cursor: 'M5 3l13 7.5-5.6 1.4L10 18z',
  polygon: 'M5 7l7-4 7 5-2 10H7z M5 7a1.5 1.5 0 1 0 0 .01 M19 8a1.5 1.5 0 1 0 0 .01',
  square: 'M5 5h14v14H5z',
  satellite: 'M13 7l4-4 4 4-4 4z M3 17l4-4 4 4-4 4z M9 9l6 6 M8.5 12.5l3-3 3 3-3 3z M15 21a6 6 0 0 0 6-6 M15 17.5a2.5 2.5 0 0 0 2.5-2.5',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.9 2.5-5 .2 1.8 1 2.8 2 3.2C11 9 11 6 12 3z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.5v.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M15.5 15.5L20 20',
  close: 'M6 6l12 12 M18 6L6 18',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chart: 'M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  warning: 'M12 3l10 18H2z M12 10v5 M12 18v.5',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  check: 'M5 12.5l4.5 4.5L19 7',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  github: 'M9 19c-4 1.5-4-2-6-2.5 M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  sparkle: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6',
};

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

/** Project mark: the plain flame icon of the interface's icon set, in the accent color. No logo image is used. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flex: 'none' }}>
      <Icon name="flame" size={Math.round(size * 0.8)} />
    </span>
  );
}
