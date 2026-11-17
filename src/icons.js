// Ikon garis sederhana (24x24, stroke currentColor). Bukan emoji.
const wrap = (body) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`

export const icons = {
  maket: wrap('<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M3 9v6l9 5 9-5V9"/><path d="M12 14v6"/>'),
  denah: wrap('<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 11h8M11.5 4.5v6.5M15 11v8.5M15 15h5.5"/>'),
  tur: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12c3 2.2 14 2.2 17 0M12 3.5c-2.5 3-2.5 14 0 17M12 3.5c2.5 3 2.5 14 0 17"/>'),
  galeri: wrap('<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M3.5 15l5-4.5 4 3.5 3-2.5 5 4.5"/><circle cx="16.5" cy="9.5" r="1.2"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevron: wrap('<path d="M6 15l6-6 6 6"/>'),
  prev: wrap('<path d="M14.5 6l-6 6 6 6"/>'),
  next: wrap('<path d="M9.5 6l6 6-6 6"/>'),
  enter: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7M13 8.5l3.5 3.5-3.5 3.5"/>'),
  exit: wrap('<path d="M14 4.5h5.5v15H14M10 8l-4 4 4 4M6 12h9"/>'),
  reset: wrap('<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  minus: wrap('<path d="M5 12h14"/>'),
  camera: wrap('<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10.5H4z"/><circle cx="12" cy="13.5" r="3.2"/>'),
  hint: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  list: wrap('<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>'),
}

// Logo: lengkung pintu masuk + kontur gigi. Sama dengan public/favicon.svg.
export const logo = `<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true" focusable="false">
  <rect width="64" height="64" rx="12" fill="#17382c"/>
  <path d="M20 46V30a12 12 0 0 1 24 0v16" fill="none" stroke="#d8c39a" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M26 46V31a6 6 0 0 1 12 0v15" fill="none" stroke="#f6f3ee" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M16 46h32" stroke="#a8733f" stroke-width="2.4" stroke-linecap="round"/></svg>`
