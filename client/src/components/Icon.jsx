const paths = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  cart: 'M2 3h3l3 12h10l3-9H6 M9 20h.01 M18 20h.01',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  return: 'M4 4v7h7 M4 11a8 8 0 0 1 15 4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  box: 'M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7 4l10 6',
  archive: 'M3 3h18v4H3z M5 7v14h14V7 M9 11h6',
  truck: 'M2 5h12v12H2z M14 9h4l4 5v3h-8 M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  file: 'M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h8',
  download: 'M12 2v13 M7 10l5 5 5-5 M3 16v5h18v-5',
  settings: 'M3 6h18 M3 12h18 M3 18h18 M8 3v6 M16 9v6 M8 15v6',
  shield: 'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6',
  chart: 'M3 3v18h18 M7 16h4 M7 12h8 M7 8h12',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
  tag: 'M3 3h8l10 10-8 8L3 11z M7 7h.01',
  clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  logout: 'M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4',
  calendar: 'M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18',
  plus: 'M12 4v16 M4 12h16',
  close: 'M6 6l12 12 M6 18L18 6',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  money: 'M2 6h20v12H2z M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M5 12h.01 M19 12h.01',
}
export default function Icon({ name, className = '' }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.file} /></svg>
}
