const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const I = ({ children, className = 'h-5 w-5', ...p }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} {...p}>{children}</svg>
);

export const ChevronDown = (p) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
export const ChevronLeft = (p) => <I {...p}><path d="m15 18-6-6 6-6" /></I>;
export const ChevronRight = (p) => <I {...p}><path d="m9 18 6-6-6-6" /></I>;
export const MenuIcon = (p) => <I {...p}><path d="M4 6h16M4 12h16M4 18h16" /></I>;
export const Close = (p) => <I {...p}><path d="M18 6 6 18M6 6l12 12" /></I>;
export const Play = (p) => <I {...p}><path d="M7 4v16l13-8z" fill="currentColor" /></I>;
export const Pause = (p) => <I {...p}><path d="M8 5v14M16 5v14" /></I>;
export const Heart = (p) => <I {...p}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" /></I>;
export const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>;
export const Calendar = (p) => <I {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></I>;
export const MapPin = (p) => <I {...p}><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></I>;
export const Phone = (p) => <I {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></I>;
export const Mail = (p) => <I {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></I>;
export const Tv = (p) => <I {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="m17 2-5 5-5-5" /></I>;
export const Smartphone = (p) => <I {...p}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></I>;
export const Radio = (p) => <I {...p}><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2" /></I>;
export const Globe = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></I>;
export const Info = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></I>;
export const Film = (p) => <I {...p}><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 9h5M17 9h5M2 15h5M17 15h5" /></I>;
export const Lock =(p) => <I {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>;
export const Check =(p) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>;

/* Icônes de marque (remplies) */
const B = ({ d, className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><path d={d} /></svg>
);
export const YouTube = (p) => <B {...p} d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6z" />;
export const Facebook = (p) => <B {...p} d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />;
export const Instagram = (p) => <B {...p} d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z" />;
export const XIcon = (p) => <B {...p} d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.3zm-1.2 17.9h1.9L7 4.2H5z" />;
export const WhatsApp = (p) => <B {...p} d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1l-.9 1.2c-.2.2-.3.2-.6.1-1.6-.8-2.7-1.4-3.8-3.2-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.6.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18L0 24l6.2-1.6A12 12 0 1 0 12 0z" />;
