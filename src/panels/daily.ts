import type { PanelDef } from './types';
import { codeInfo } from '../lib/codes';
import { icon, UI } from '../ui/icons';
import { temp, tempStr, time, relDay, dateShort, tempColor, windStr, compass, precipStr, duration } from '../lib/format';
import { hourIndex } from '../api/weather';
import { rainOutlook } from '../lib/summary';

export const daily: PanelDef = {
  id: 'daily',
  title: '14-day forecast',
  cols: 2,
  rows: 6,
  render(c) {
    const d = c.f.daily;
    const start = c.di;
    const idx = Array.from({ length: d.time.length - start }, (_, k) => start + k);
    const lo = Math.min(...idx.map((i) => d.min[i]));
    const hi = Math.max(...idx.map((i) => d.max[i]));
    const span = hi - lo || 1;
    const pct = (v: number) => ((v - lo) / span) * 100;
    const nowT = c.f.current.temp;

    const rows = idx.map((i, k) => {
      const info = codeInfo(d.code[i]);
      const pop = Math.round((k === 0 ? rainOutlook(c.f, c.now).chance : d.popMax[i]) / 5) * 5;
      const left = pct(d.min[i]), right = pct(d.max[i]);
      const grad = `linear-gradient(90deg, ${tempColor(d.min[i])}, ${tempColor(d.max[i])})`;
      const dot = k === 0 ? `<i class="d-now" style="left:${Math.min(100, Math.max(0, ((nowT - d.min[i]) / (d.max[i] - d.min[i] || 1)) * 100))}%"></i>` : '';
      const label = relDay(d.time[i], c.now);
      return `<li class="d-row" data-i="${i}">
        <button class="d-main" aria-expanded="false">
          <span class="d-day"><b>${k === 0 ? 'Today' : label === 'Tomorrow' ? 'Tomorrow' : label.slice(0, 3)}</b><small>${dateShort(d.time[i])}</small></span>
          <span class="d-icon">${icon(info.icon, false, 34, info.label)}</span>
          <span class="d-pop${pop >= 30 ? ' wet' : ''}">${pop >= 10 ? UI.drop + pop + '%' : ''}</span>
          <span class="d-min">${Math.round(temp(d.min[i]))}°</span>
          <span class="d-bar"><span class="d-fill" style="left:${left}%;right:${100 - right}%;background:${grad}">${dot}</span></span>
          <span class="d-max">${Math.round(temp(d.max[i]))}°</span>
        </button>
        <div class="d-more" hidden>
          <p class="d-summary">${info.label}. High ${tempStr(d.max[i])}, low ${tempStr(d.min[i])}.</p>
          <dl>
            <div><dt>Rain</dt><dd>${precipStr(d.precipSum[i])} · ${pop}%</dd></div>
            <div><dt>Wind</dt><dd>${windStr(d.windMax[i])} ${compass(d.windDir[i])}</dd></div>
            <div><dt>Gusts</dt><dd>${windStr(d.gustMax[i])}</dd></div>
            <div><dt>UV max</dt><dd>${Math.round(d.uvMax[i])}</dd></div>
            <div><dt>Sunrise</dt><dd>${isNaN(d.sunrise[i]) ? '—' : time(d.sunrise[i])}</dd></div>
            <div><dt>Sunset</dt><dd>${isNaN(d.sunset[i]) ? '—' : time(d.sunset[i])}</dd></div>
            <div><dt>Daylight</dt><dd>${duration(d.daylight[i])}</dd></div>
          </dl>
        </div>
      </li>`;
    }).join('');
    return `<ol class="daily">${rows}</ol>`;
  },
  mount(el, c) {
    el.querySelectorAll<HTMLElement>('.d-row').forEach((row) => {
      const btn = row.querySelector<HTMLButtonElement>('.d-main')!;
      const more = row.querySelector<HTMLElement>('.d-more')!;
      const i = Number(row.dataset.i);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        el.querySelectorAll('.d-main[aria-expanded="true"]').forEach((b) => {
          if (b !== btn) { b.setAttribute('aria-expanded', 'false'); (b.nextElementSibling as HTMLElement).hidden = true; b.parentElement!.classList.remove('open'); }
        });
        btn.setAttribute('aria-expanded', String(open));
        more.hidden = !open;
        row.classList.toggle('open', open);
        if (open && i !== c.di) {
          // Preview that day's early afternoon in the sky
          const hIdx = hourIndex(c.f.hourly, c.f.daily.time[i] + 14 * 3600e3);
          c.preview(hIdx, true);
        } else if (!open || i === c.di) c.preview(null, true);
      });
    });
  },
};
