let activeIcon = null;
let activeCard = null;
let lastClickedIcon = null;

function getVisibleExportIcon() {
  if (lastClickedIcon?.isConnected) return lastClickedIcon;

  const icons = [...document.querySelectorAll('.tablesnap-export-icon')];
  return icons.find((icon) => icon.matches(':hover') || icon === document.activeElement) || null;
}

function positionCard() {
  if (!activeCard || !activeIcon || !activeCard.isConnected || !activeIcon.isConnected) return;

  const iconRect = activeIcon.getBoundingClientRect();
  const cardWidth = activeCard.offsetWidth || 292;
  const cardHeight = activeCard.offsetHeight || 320;
  const gap = 6;
  const margin = 8;
  const pageLeft = window.scrollX;
  const pageTop = window.scrollY;
  const viewportRight = pageLeft + window.innerWidth;
  const viewportBottom = pageTop + window.innerHeight;

  let left = pageLeft + iconRect.right - cardWidth;
  left = Math.max(pageLeft + margin, Math.min(left, viewportRight - cardWidth - margin));

  const belowTop = pageTop + iconRect.bottom + gap;
  const aboveTop = pageTop + iconRect.top - cardHeight - gap;
  const fitsBelow = belowTop + cardHeight <= viewportBottom - margin;
  const fitsAbove = aboveTop >= pageTop + margin;

  let top;
  if (fitsBelow || !fitsAbove) {
    top = Math.min(belowTop, viewportBottom - cardHeight - margin);
  } else {
    top = aboveTop;
  }
  top = Math.max(pageTop + margin, top);

  activeCard.style.left = `${left}px`;
  activeCard.style.top = `${top}px`;
  activeCard.style.maxHeight = `${Math.max(160, window.innerHeight - margin * 2)}px`;
  activeCard.style.overflowY = 'auto';
}

function bindCard(card) {
  activeCard = card;
  activeIcon = getVisibleExportIcon();
  if (!activeIcon) return;

  activeIcon.dataset.cardOpen = 'true';
  requestAnimationFrame(() => requestAnimationFrame(positionCard));
}

function clearCardState() {
  if (activeIcon) delete activeIcon.dataset.cardOpen;
  activeIcon = null;
  activeCard = null;
}

document.addEventListener('pointerdown', (event) => {
  const icon = event.target.closest?.('.tablesnap-export-icon');
  if (icon) lastClickedIcon = icon;
}, true);

const observer = new MutationObserver(() => {
  const card = document.querySelector('.tablesnap-export-card');

  if (card && card !== activeCard) {
    clearCardState();
    bindCard(card);
    return;
  }

  if (!card && activeCard) clearCardState();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('scroll', positionCard, true);
window.addEventListener('resize', positionCard);
