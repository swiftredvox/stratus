import type { Ctx } from '../panels/types';
import { PANELS } from '../panels/registry';
import { codeInfo } from '../lib/codes';
import { rainOutlook } from '../lib/summary';
import { temp, tempStr, tempUnit, dayLong, time, esc } from '../lib/format';
import { state, isSaved } from '../lib/store';
import { icon, UI } from './icons';

export function renderHero(c: Ctx, handlers: { onStar: () => void; onPlace: () => void }) {
  const el = document.getElementById('hero')!;
  const cur = c.f.current;
  const info = codeInfo(cur.code);
  const d = c.f.daily;
  const o = rainOutlook(c.f, c.now);
  const saved = isSaved(c.place);
  const sub = [...new Set([c.place.region, c.place.countryCode === 'GB' ? 'UK' : c.place.country])]
    .filter((x) => x && x !== c.place.name).join(', ');
  const chips = state.layout.pinned
    .filter((id) => !state.layout.hidden.includes(id))
    .map((id) => {
      const ch = PANELS[id]?.chip?.(c);
      return ch ? `<button class="hero-chip" data-goto="${id}"><small>${ch.label}</small><b>${esc(ch.value)}</b></button>` : '';
    })
    .join('');

  el.innerHTML = `
    <div class="hero-inner">
      <div class="hero-place">
        <button class="hero-loc" id="heroLoc" aria-label="Change location">
          <span class="hero-city">${esc(c.place.name)}</span>
          ${sub ? `<span class="hero-region">${esc(sub)}</span>` : ''}
        </button>
        <button class="star${saved ? ' on' : ''}" id="heroStar" aria-pressed="${saved}" title="${saved ? 'Remove from saved places' : 'Save this place'}" aria-label="${saved ? 'Remove from saved places' : 'Save this place'}">${saved ? UI.starFill : UI.star}</button>
      </div>
      <p class="hero-time" id="heroTime">${dayLong(c.now)} ${time(c.now)}</p>

      <div class="hero-main">
        <div class="hero-icon">${icon(info.icon, !cur.isDay, 132, info.label)}</div>
        <div class="hero-temp" aria-label="${tempStr(cur.temp)} ${tempUnit()}">
          <span class="num">${Math.round(temp(cur.temp))}</span><span class="deg">°</span>
        </div>
      </div>

      <p class="hero-cond">${info.label}</p>
      <p class="hero-meta">
        <span>Feels like ${tempStr(cur.feels)}</span>
        <span class="sep"></span>
        <span>H ${tempStr(d.max[c.di])}</span><span>L ${tempStr(d.min[c.di])}</span>
      </p>

      <div class="hero-rain${o.wetNow || o.chance >= 30 ? ' wet' : ''}">
        <span class="hero-rain-pct">${UI.drop}<b>${Math.round(o.chance)}%</b><small>chance of rain ${o.chanceLabel}</small></span>
        <span class="hero-rain-text">${o.headline}</span>
      </div>

      ${chips ? `<div class="hero-chips">${chips}</div>` : ''}
    </div>
    <a class="scroll-cue" href="#details" aria-label="Show forecast and details">
      <span>Forecast &amp; details</span>${UI.chevronDown}
    </a>`;

  el.querySelector('#heroStar')!.addEventListener('click', handlers.onStar);
  el.querySelector('#heroLoc')!.addEventListener('click', handlers.onPlace);
  el.querySelectorAll<HTMLButtonElement>('.hero-chip').forEach((b) =>
    b.addEventListener('click', () => {
      const target = document.querySelector<HTMLElement>(`.panel[data-id="${b.dataset.goto}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.remove('flash');
      void target.offsetWidth;
      target.classList.add('flash');
    }),
  );
  el.querySelector('.scroll-cue')!.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('details')!.scrollIntoView({ behavior: 'smooth' });
  });
}

export function updateHeroClock(now: number) {
  const t = document.getElementById('heroTime');
  if (t) t.textContent = `${dayLong(now)} ${time(now)}`;
}
