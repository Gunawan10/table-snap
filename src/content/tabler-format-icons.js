const TABLER_ICONS = {
  csv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2-2h7l5 5v4"/><path d="M7 16.5a1.5 1.5 0 0 0-3 0v3a1.5 1.5 0 0 0 3 0"/><path d="M10 20.25c0 .414 .336 .75 .75 .75H12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1.25a.75 .75 0 0 1 .75 .75"/><path d="M16 15l2 6 2-6"/></svg>',
  xlsx: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2-2h7l5 5v4"/><path d="M4 15l4 6"/><path d="M4 21l4-6"/><path d="M17 20.25c0 .414 .336 .75 .75 .75H19a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1.25a.75 .75 0 0 1 .75 .75"/><path d="M11 15v6h3"/></svg>',
  json: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4a2 2 0 0 0-2 2v3a2 3 0 0 1-2 3 2 3 0 0 1 2 3v3a2 2 0 0 0 2 2"/><path d="M17 4a2 2 0 0 1 2 2v3a2 3 0 0 0 2 3 2 3 0 0 0-2 3v3a2 2 0 0 1-2 2"/></svg>',
  markdown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7"/><path d="M7 15V9l2 2 2-2v6"/><path d="M14 13l2 2 2-2m-2 2V9"/></svg>',
  png: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6"/><path d="m3 16 5-5c.928-.893 2.072-.893 3 0l5 5"/><path d="m14 14 1-1c.928-.893 2.072-.893 3 0l3 3"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2-2h7l5 5v4"/><path d="M5 18h1.5a1.5 1.5 0 0 0 0-3H5v6"/><path d="M17 18h2"/><path d="M20 15h-3v6"/><path d="M11 15v6h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-1"/></svg>',
  tsv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M3 10h18"/><path d="M10 3v18"/></svg>',
  html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2-2h7l5 5v4"/><path d="M2 21v-6"/><path d="M5 15v6"/><path d="M2 18h3"/><path d="M20 15v6h2"/><path d="M13 21v-6l2 3 2-3v6"/><path d="M7.5 15h3"/><path d="M9 15v6"/></svg>',
  sql: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0"/><path d="M4 6v6a8 3 0 0 0 16 0V6"/><path d="M4 12v6a8 3 0 0 0 16 0v-6"/></svg>',
  ndjson: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2-2h7l5 5v4"/><path d="M7 15v6"/><path d="M17 15v6"/><path d="M10 15c0 3 4 3 4 6"/><path d="M14 15c0 3-4 3-4 6"/></svg>'
};

function applyTablerIcons(root = document) {
  root.querySelectorAll?.('.tablesnap-format-tile[data-tile-format]').forEach((tile) => {
    const format = tile.dataset.tileFormat;
    const icon = tile.querySelector('.tablesnap-format-icon');
    const svg = TABLER_ICONS[format];
    if (!icon || !svg || icon.dataset.iconSet === 'tabler') return;
    icon.innerHTML = svg;
    icon.dataset.iconSet = 'tabler';
  });
}

applyTablerIcons();
new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) applyTablerIcons(node);
    });
  }
}).observe(document.documentElement, { childList: true, subtree: true });
