// Panel grid with a customise mode: drag to reorder, pin to hero, hide/restore.
import { PANELS } from '../panels/registry';
import type { Ctx } from '../panels/types';
import { state, save, DEFAULT_LAYOUT, MAX_PINS } from '../lib/store';
import { UI } from './icons';

let editing = false;
let lastCtx: Ctx | null = null;
let lastPlaceKey = '';

const grid = () => document.getElementById('grid')!;

export function renderGrid(c: Ctx) {
  lastCtx = c;
  const g = grid();
  const key = `${c.place.lat},${c.place.lon}`;
  g.classList.toggle('enter', key !== lastPlaceKey);
  lastPlaceKey = key;
  const scrollers = new Map<string, number>();
  g.querySelectorAll<HTMLElement>('.panel').forEach((p) => {
    const s = p.querySelector<HTMLElement>('.hourly-scroll');
    if (s) scrollers.set(p.dataset.id!, s.scrollLeft);
  });
  g.innerHTML = '';
  // Drop pins for panels that can no longer be pinned (e.g. from an older saved layout).
  state.layout.pinned = state.layout.pinned.filter((id) => PANELS[id]?.chip);
  const { order, hidden, pinned } = state.layout;
  for (const id of order) {
    const def = PANELS[id];
    if (!def || hidden.includes(id)) continue;
    const el = document.createElement('article');
    el.className = `panel cols-${def.cols} rows-${def.rows}`;
    el.dataset.id = id;
    el.style.setProperty('--rows', String(def.rows));
    const canPin = !!def.chip;
    el.innerHTML = `
      <header class="panel-head">
        <h3>${def.title}</h3>
        <div class="panel-tools">
          ${canPin ? pinButton(id, def.title, pinned) : ''}
          <span class="tip-wrap" data-tip="Hide panel"><button class="tool hide" aria-label="Hide ${def.title}">${UI.eyeOff}</button></span>
          <span class="tip-wrap" data-tip="Drag to reorder"><button class="tool grip" aria-label="Move ${def.title} (arrow keys)">${UI.grip}</button></span>
        </div>
      </header>
      <div class="panel-body"></div>`;
    const body = el.querySelector<HTMLElement>('.panel-body')!;
    try {
      body.innerHTML = def.render(c);
      def.mount?.(body, c);
    } catch (e) {
      console.error(id, e);
      body.innerHTML = '<p class="muted">Couldn’t show this panel.</p>';
    }
    g.appendChild(el);
    const sl = scrollers.get(id);
    if (sl) el.querySelector<HTMLElement>('.hourly-scroll')!.scrollLeft = sl;
  }
  wireTools();
  renderTray();
}

function wireTools() {
  const g = grid();
  g.querySelectorAll<HTMLElement>('.panel').forEach((el) => {
    const id = el.dataset.id!;
    el.querySelector<HTMLButtonElement>('.pin')?.addEventListener('click', () => togglePin(id));
    el.querySelector<HTMLButtonElement>('.hide')!.addEventListener('click', () => {
      state.layout.hidden = [...state.layout.hidden, id];
      state.layout.pinned = state.layout.pinned.filter((p) => p !== id);
      save();
    });
    const grip = el.querySelector<HTMLButtonElement>('.grip')!;
    grip.addEventListener('pointerdown', (e) => startDrag(e, el));
    grip.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      const order = state.layout.order;
      const visible = order.filter((x) => !state.layout.hidden.includes(x));
      const vi = visible.indexOf(id);
      const swap = visible[vi + dir];
      if (!swap) return;
      const a = order.indexOf(id), b = order.indexOf(swap);
      [order[a], order[b]] = [order[b], order[a]];
      save();
      requestAnimationFrame(() => grid().querySelector<HTMLButtonElement>(`.panel[data-id="${id}"] .grip`)?.focus());
    });
  });
}

function pinButton(id: string, title: string, pinned: string[]) {
  const on = pinned.includes(id);
  const full = !on && pinned.length >= MAX_PINS;
  const tip = on ? 'Unpin from the top' : full ? `You can pin up to ${MAX_PINS} panels. Unpin one first.` : 'Pin to the top';
  return `<span class="tip-wrap" data-tip="${tip}"><button class="tool pin${on ? ' on' : ''}" aria-pressed="${on}" ${full ? 'aria-disabled="true"' : ''} aria-label="${on ? 'Unpin' : 'Pin'} ${title}${full ? ' (pin limit reached)' : ''}">${UI.pin}</button></span>`;
}

function togglePin(id: string) {
  const pins = state.layout.pinned;
  if (pins.includes(id)) state.layout.pinned = pins.filter((p) => p !== id);
  else if (pins.length < MAX_PINS) state.layout.pinned = [...pins, id];
  else return;
  save();
}

function renderTray() {
  const tray = document.getElementById('tray')!;
  const hidden = state.layout.hidden.filter((id) => PANELS[id]);
  tray.innerHTML = hidden.length
    ? `<span class="tray-label">Hidden:</span>` +
      hidden.map((id) => `<button class="chip-btn tray-item" data-id="${id}">${UI.plus}<span>${PANELS[id].title}</span></button>`).join('')
    : '';
  tray.querySelectorAll<HTMLButtonElement>('.tray-item').forEach((b) =>
    b.addEventListener('click', () => {
      state.layout.hidden = state.layout.hidden.filter((x) => x !== b.dataset.id);
      save();
    }),
  );
}

// ---- Drag reordering with FLIP animation
function flip(mutate: () => void) {
  const els = [...grid().querySelectorAll<HTMLElement>('.panel:not(.dragging)')];
  const before = new Map(els.map((e) => [e, e.getBoundingClientRect()]));
  mutate();
  for (const e of els) {
    const a = before.get(e)!, b = e.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) continue;
    e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

function startDrag(e: PointerEvent, el: HTMLElement) {
  if (!editing || e.button !== 0) return;
  e.preventDefault();
  const g = grid();
  const rect = el.getBoundingClientRect();
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.classList.add('ghost');
  Object.assign(ghost.style, { width: rect.width + 'px', height: rect.height + 'px', left: rect.left + 'px', top: rect.top + 'px' });
  document.body.appendChild(ghost);
  el.classList.add('dragging');
  const offX = e.clientX - rect.left, offY = e.clientY - rect.top;
  let lastSwap = 0;

  const place = (ev: PointerEvent, force = false) => {
    if (!force && performance.now() - lastSwap < 120) return;
    const over = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('.panel');
    if (!over || over === el || !g.contains(over)) return;
    const r = over.getBoundingClientRect();
    const after = ev.clientX > r.left + r.width / 2;
    lastSwap = performance.now();
    const ref = after ? over.nextSibling : over;
    if (ref === el || el.nextSibling === ref) return;
    flip(() => g.insertBefore(el, ref));
  };
  const move = (ev: PointerEvent) => {
    ghost.style.left = ev.clientX - offX + 'px';
    ghost.style.top = ev.clientY - offY + 'px';
    // auto-scroll near edges
    if (ev.clientY < 80) scrollBy(0, -12); else if (ev.clientY > innerHeight - 80) scrollBy(0, 12);
    place(ev);
  };
  const up = (ev: PointerEvent) => {
    place(ev, true);
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    const final = el.getBoundingClientRect();
    ghost.animate([{ left: ghost.style.left, top: ghost.style.top }, { left: final.left + 'px', top: final.top + 'px' }], { duration: 180, easing: 'ease-out' })
      .finished.finally(() => {
        ghost.remove();
        el.classList.remove('dragging');
        const visibleOrder = [...g.querySelectorAll<HTMLElement>('.panel')].map((p) => p.dataset.id!);
        // keep hidden panels at their relative spot at the end
        const rest = state.layout.order.filter((id) => !visibleOrder.includes(id));
        state.layout.order = [...visibleOrder, ...rest];
        save();
      });
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}

export function initCustomise() {
  const btn = document.getElementById('customiseBtn')!;
  const bar = document.getElementById('editBar')!;
  const set = (on: boolean) => {
    editing = on;
    document.body.classList.toggle('editing', on);
    btn.setAttribute('aria-pressed', String(on));
    bar.hidden = !on;
    if (on) renderTray();
  };
  btn.addEventListener('click', () => set(!editing));
  document.getElementById('doneEditing')!.addEventListener('click', () => set(false));
  document.getElementById('resetLayout')!.addEventListener('click', () => {
    state.layout = structuredClone(DEFAULT_LAYOUT);
    save();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && editing) set(false); });
}

export const rerenderGrid = () => { if (lastCtx) renderGrid(lastCtx); };
