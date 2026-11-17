// Search overlay: autocomplete, postcodes, saved & recent places, geolocation.
import type { Place } from '../api/weather';
import { searchPlaces } from '../api/geocode';
import { state, toggleSaved, samePlace, save } from '../lib/store';
import { esc } from '../lib/format';
import { UI } from './icons';

interface Opts { onPick: (p: Place) => void; onLocate: () => void; onRandom: () => void; current: () => Place | null }

export function initSearch(o: Opts) {
  const overlay = document.getElementById('searchOverlay')!;
  const input = document.getElementById('searchInput') as HTMLInputElement;
  const list = document.getElementById('searchResults')!;
  let items: { el: HTMLElement; act: () => void }[] = [];
  let active = -1;
  let ctrl: AbortController | null = null;
  let timer = 0;
  let lastFocus: HTMLElement | null = null;

  const placeSub = (p: Place) => [p.region, p.country].filter(Boolean).join(', ');

  const setActive = (i: number) => {
    active = i;
    items.forEach((it, k) => it.el.classList.toggle('active', k === i));
    items[i]?.el.scrollIntoView({ block: 'nearest' });
  };

  const row = (p: Place, opts: { saved?: boolean; removable?: boolean } = {}) => {
    const cur = samePlace(p, o.current());
    return `<div class="sr-row${cur ? ' current' : ''}" role="option">
      <span class="sr-ico">${opts.saved ? UI.starFill : UI.pinDot}</span>
      <span class="sr-text"><b>${esc(p.name)}</b><small>${esc(placeSub(p))}</small></span>
      ${opts.removable ? `<button class="sr-remove" aria-label="Remove ${esc(p.name)} from saved">${UI.close}</button>` : ''}
    </div>`;
  };

  const showDefault = () => {
    let html = `<div class="sr-row sr-locate" role="option"><span class="sr-ico">${UI.locate}</span><span class="sr-text"><b>Use my location</b><small>Find the weather where you are</small></span></div>
      <div class="sr-row sr-locate" role="option"><span class="sr-ico">${UI.dice}</span><span class="sr-text"><b>Surprise me</b><small>Jump to a famous place somewhere in the world</small></span></div>`;
    const acts: (() => void)[] = [o.onLocate, o.onRandom];
    if (state.saved.length) {
      html += `<p class="sr-group">Saved places</p>`;
      state.saved.forEach((p) => { html += row(p, { saved: true, removable: true }); acts.push(() => o.onPick(p)); });
    }
    const recent = state.recent.filter((r) => !state.saved.some((s) => samePlace(s, r)));
    if (recent.length) {
      html += `<p class="sr-group">Recent</p>`;
      recent.forEach((p) => { html += row(p); acts.push(() => o.onPick(p)); });
    }
    list.innerHTML = html;
    bind(acts);
    renderClear(recent.length > 0);
    list.querySelectorAll<HTMLButtonElement>('.sr-remove').forEach((b, k) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); toggleSaved(state.saved[k]); showDefault(); }),
    );
  };

  const clearEl = document.getElementById('clearHist')!;
  const renderClear = (show: boolean, confirming = false) => {
    if (!show) { clearEl.innerHTML = ''; return; }
    clearEl.innerHTML = confirming
      ? `<span>Clear recent places?</span><button class="ch-yes">Clear</button><button class="ch-no">Cancel</button>`
      : `<button class="ch-start">Clear history</button>`;
    clearEl.querySelector('.ch-start')?.addEventListener('click', () => { renderClear(true, true); clearEl.querySelector<HTMLButtonElement>('.ch-no')?.focus(); });
    clearEl.querySelector('.ch-no')?.addEventListener('click', () => { renderClear(true); input.focus(); });
    clearEl.querySelector('.ch-yes')?.addEventListener('click', () => { state.recent = []; save(false); showDefault(); input.focus(); });
  };

  const bind = (acts: (() => void)[]) => {
    const els = [...list.querySelectorAll<HTMLElement>('.sr-row')];
    items = els.map((el, k) => ({ el, act: () => { close(); acts[k](); } }));
    items.forEach((it, k) => {
      it.el.addEventListener('click', it.act);
      it.el.addEventListener('pointermove', () => setActive(k));
    });
    setActive(items.length ? 0 : -1);
  };

  const run = async (q: string) => {
    ctrl?.abort();
    ctrl = new AbortController();
    list.classList.add('loading');
    try {
      const res = await searchPlaces(q, ctrl.signal);
      if (input.value.trim() !== q) return;
      if (!res.length) {
        list.innerHTML = `<p class="sr-empty">No places found for “${esc(q)}”.</p>`;
        items = [];
      } else {
        list.innerHTML = res.map((p) => row(p, { saved: state.saved.some((s) => samePlace(s, p)) })).join('');
        bind(res.map((p) => () => o.onPick(p)));
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') list.innerHTML = `<p class="sr-empty">Search is unavailable right now.</p>`;
    } finally {
      list.classList.remove('loading');
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { ctrl?.abort(); showDefault(); return; }
    renderClear(false);
    timer = window.setTimeout(() => run(q), 220);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (items[active]) items[active].act();
      else if (q.length >= 2) { clearTimeout(timer); run(q).then(() => items[0]?.act()); }
    }
  });

  const open = () => {
    lastFocus = document.activeElement as HTMLElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    input.value = '';
    showDefault();
    input.focus();
  };
  const close = () => {
    overlay.classList.remove('open');
    overlay.hidden = true;
    lastFocus?.focus?.();
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('searchClose')!.addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
    const typing = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
    if (!typing && overlay.hidden && (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey)))) { e.preventDefault(); open(); }
  });
  document.getElementById('placeBtn')!.addEventListener('click', open);
  return { open };
}
