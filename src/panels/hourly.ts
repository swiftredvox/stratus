import type { PanelDef } from './types';
import { codeInfo } from '../lib/codes';
import { icon } from '../ui/icons';
import { temp, tempStr, time, dayShort, tempColor } from '../lib/format';
import { dragScroll } from '../ui/dragscroll';

const COL = 62;
const HOURS = 48;

export const hourly: PanelDef = {
  id: 'hourly',
  title: 'Next 48 hours',
  cols: 'full',
  rows: 3,
  render(c) {
    const h = c.f.hourly;
    const start = c.hi;
    const end = Math.min(h.time.length, start + HOURS);
    const idx = Array.from({ length: end - start }, (_, k) => start + k);
    // The "Now" column shows live conditions rather than the hour that's partly in the past
    const cur = c.f.current;
    const tC = (i: number, k: number) => (k === 0 ? cur.temp : h.temp[i]);
    const codeAt = (i: number, k: number) => (k === 0 ? cur.code : h.code[i]);
    const nightAt = (i: number, k: number) => (k === 0 ? !cur.isDay : !h.isDay[i]);
    const temps = idx.map((i, k) => temp(tC(i, k)));
    const lo = Math.min(...temps), hi = Math.max(...temps);
    const W = idx.length * COL, CH = 136, pad = 32;
    const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (CH - pad - 8);
    const pts = temps.map((v, k) => [k * COL + COL / 2, y(v)] as [number, number]);
    // Smooth path (Catmull-Rom → Bézier)
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[k - 1] ?? pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] ?? p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
    }
    const area = `${d} L${pts[pts.length - 1][0]},${CH} L${pts[0][0]},${CH} Z`;
    const stops = idx.map((i, k) => `<stop offset="${((k + 0.5) / idx.length).toFixed(4)}" stop-color="${tempColor(tC(i, k))}"/>`).join('');

    const cols = idx.map((i, k) => {
      const info = codeInfo(codeAt(i, k));
      const t = h.time[i];
      const midnight = new Date(t).getUTCHours() === 0;
      const label = k === 0 ? 'Now' : midnight ? dayShort(t) : time(t, { short: true });
      const pop = Math.round(h.pop[i] / 5) * 5;
      return `<button class="h-col${midnight ? ' h-midnight' : ''}" data-i="${i}" aria-label="${label}: ${tempStr(tC(i, k))}, ${info.label}, ${pop}% chance of rain">
        <span class="h-time">${label}</span>
        ${icon(info.icon, nightAt(i, k), 32)}
        <span class="h-gap"></span>
        <span class="h-pop${pop >= 30 ? ' wet' : ''}"><i style="height:${Math.max(3, pop * 0.3)}px"></i><b>${pop >= 10 ? pop + '%' : ''}</b></span>
      </button>`;
    }).join('');

    const labels = pts.map((p, k) => `<text x="${p[0]}" y="${p[1] - 10}" class="h-tl">${Math.round(temps[k])}°</text>`).join('');
    const dots = pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.4"/>`).join('');
    const days = idx.map((i, k) => (new Date(h.time[i]).getUTCHours() === 0 && k > 0 ? `<line x1="${k * COL}" x2="${k * COL}" y1="0" y2="${CH}"/>` : '')).join('');

    return `<div class="hourly">
      <div class="hourly-scroll" tabindex="0" aria-label="Hourly forecast, scroll horizontally">
        <div class="hourly-track" style="width:${W}px">
          <svg class="h-curve" width="${W}" height="${CH}" viewBox="0 0 ${W} ${CH}" aria-hidden="true">
            <defs>
              <linearGradient id="hg-line" x1="0" x2="${W}" y1="0" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient>
              <linearGradient id="hg-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            </defs>
            <g class="h-days">${days}</g>
            <path d="${area}" fill="url(#hg-fill)"/>
            <path d="${d}" fill="none" stroke="url(#hg-line)" stroke-width="2.5" stroke-linecap="round"/>
            <g class="h-dots" fill="url(#hg-line)">${dots}</g>
            ${labels}
          </svg>
          <div class="h-cols">${cols}</div>
        </div>
      </div>
      <button class="h-arrow left" aria-label="Scroll back">‹</button>
      <button class="h-arrow right" aria-label="Scroll forward">›</button>
    </div>`;
  },
  mount(el, c) {
    const scroller = el.querySelector<HTMLElement>('.hourly-scroll')!;
    dragScroll(scroller);
    const arrows = el.querySelectorAll<HTMLButtonElement>('.h-arrow');
    const upd = () => {
      arrows[0].classList.toggle('show', scroller.scrollLeft > 8);
      arrows[1].classList.toggle('show', scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 8);
    };
    // Don't scrub the sky while the strip is scrolling under a still cursor
    let lastScroll = 0;
    scroller.addEventListener('scroll', () => { upd(); lastScroll = performance.now(); }, { passive: true });
    const busy = () => performance.now() - lastScroll < 250 || scroller.classList.contains('dragging');
    requestAnimationFrame(upd);
    arrows[0].onclick = () => scroller.scrollBy({ left: -scroller.clientWidth * 0.8, behavior: 'smooth' });
    arrows[1].onclick = () => scroller.scrollBy({ left: scroller.clientWidth * 0.8, behavior: 'smooth' });

    const cols = el.querySelectorAll<HTMLButtonElement>('.h-col');
    cols.forEach((b) => {
      const i = Number(b.dataset.i);
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !busy()) c.preview(i); });
      b.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !busy() && !b.classList.contains('previewing')) c.preview(i); });
      b.addEventListener('focus', () => c.preview(i));
      b.addEventListener('click', () => { if (!scroller.dataset.dragged) c.preview(i, true); });
    });
    scroller.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') c.preview(null); });
    scroller.addEventListener('focusout', (e) => { if (!scroller.contains(e.relatedTarget as Node)) c.preview(null); });
  },
};
