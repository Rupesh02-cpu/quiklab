// Hidden SVG sprite: every icon used across the site is a <symbol> here,
// referenced elsewhere via <svg><use href="#icon-name"/></svg>. Kept as one
// sprite (not per-icon inline SVGs) so the markup stays out of every
// component that needs an icon.
export function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }}>
      <symbol id="icon-system" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></symbol>
      <symbol id="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></symbol>
      <symbol id="icon-moon" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></symbol>
      <symbol id="icon-upload" viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="icon-download" viewBox="0 0 24 24"><path d="M12 4v11M7.5 11.5 12 16l4.5-4.5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="icon-zip" viewBox="0 0 24 24"><path d="M5 4h14v16H5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 4v3M12 9v2M12 13v2M12 17v3" stroke="currentColor" strokeWidth="1.6"/></symbol>
      <symbol id="icon-trash" viewBox="0 0 24 24"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="icon-check" viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="icon-image" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="m5 17 5-5 3.5 3.5L18 11l1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="icon-grid" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none"/><rect x="13.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none"/><rect x="3.5" y="13.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none"/><rect x="13.5" y="13.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none"/></symbol>
      <symbol id="icon-filmstrip" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M6 6v12M12 6v12M18 6v12" stroke="currentColor" strokeWidth="1.4"/></symbol>
      <symbol id="icon-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor"/></symbol>
      <symbol id="icon-undo" viewBox="0 0 24 24"><path d="M7 8H3V4M3 8a9 9 0 1 1 2.6 8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="icon-pdf" viewBox="0 0 24 24"><path d="M6 2.5h9l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M15 2.5V7a1 1 0 0 0 1 1h4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><text x="12" y="17.5" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fontWeight="700" fill="currentColor">PDF</text></symbol>
    </svg>
  );
}
