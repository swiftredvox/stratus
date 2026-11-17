/** Mouse drag-to-scroll and vertical-wheel → horizontal for a horizontal scroller. */
export function dragScroll(el: HTMLElement) {
  let startX = 0, startL = 0, moved = 0;
  // Window listeners exist only for the duration of a drag, so re-rendered panels don't leak them.
  const move = (e: PointerEvent) => {
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 4) { el.scrollLeft = startL - dx; el.classList.add('dragging'); }
  };
  const up = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    el.classList.remove('dragging');
    if (moved > 4) { el.dataset.dragged = '1'; setTimeout(() => delete el.dataset.dragged, 50); }
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    moved = 0; startX = e.clientX; startL = el.scrollLeft;
    delete el.dataset.dragged;
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  });
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 && e.deltaY > 0;
      if (!atStart && !atEnd && e.shiftKey) { el.scrollLeft += e.deltaY; e.preventDefault(); }
    }
  }, { passive: false });
}
