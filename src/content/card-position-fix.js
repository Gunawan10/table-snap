let activeIcon = null;
let activeCard = null;

function getVisibleExportIcon() {
  const icons = [...document.querySelectorAll('.tablesnap-export-icon')];
  return icons.find((icon) => icon.matches(':hover') || icon === document.activeElement || icon.classList.contains('visible')) || null;
}

function positionCard() {
  if (!activeCard || !activeIcon || !activeCard.isConnected || !activeIcon.isConnected) return;

  const iconRect = activeIcon.getBoundingClientRect();
  const cardWidth = activeCard.offsetWidth || 276;
  const gap = 6;
  const pageLeft = window.scrollX;
  const pageTop = window.scrollY;
  const viewportRight = pageLeft + window.innerWidth;

  let left = pageLeft + iconRect.right - cardWidth;
  left = Math.max(pageLeft + 8, Math.min(left, viewportRight - cardWidth - 8));

  activeCard.style.left = `${left}px`;
  activeCard.style.top = `${pageTop + iconRect.bottom + gap}px`;
}

function bindCard(card) {
  activeCard = card;
  activeIcon = getVisibleExportIcon();
  if (!activeIcon) return;

  activeIcon.dataset.cardOpen = 'true';
  requestAnimationFrame(positionCard);
}

function clearCardState() {
  if (activeIcon) delete activeIcon.dataset.cardOpen;
  activeIcon = null;
  activeCard = null;
}

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
