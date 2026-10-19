const P: Record<string, string> = {
  cursor: 'M5 3l13 7-6 1.5L9.5 18z',
  circle: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z',
  arrow: 'M4 18C8 8 14 6 20 6M15 3l5 3-4 4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  layout: 'M4 5h5v5H4zM15 14h5v5h-5zM15 5h5v5h-5zM9 7.5h6M17.5 10v4',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM14 4h4v16h-4z',
  stepf: 'M5 4l10 8-10 8zM17 4h3v16h-3z',
  stepb: 'M19 4L9 12l10 8zM4 4h3v16H4z',
  stop: 'M6 6h12v12H6z',
  reset: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
  folder: 'M3 6h6l2 2h10v11H3z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
  help: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  panelL: 'M4 4h16v16H4zM9 4v16',
  panelR: 'M4 4h16v16H4zM15 4v16',
  panelB: 'M4 4h16v16H4zM4 15h16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5',
  x: 'M6 6l12 12M18 6L6 18',
  copy: 'M8 8h11v11H8zM5 16V5h11',
};

export function Icon({ name, size = 16 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
