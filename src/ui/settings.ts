import { state, save, DEFAULT_SETTINGS, type Settings } from '../lib/store';
import { UI } from './icons';

type Opt<K extends keyof Settings> = { key: K; label: string; options: [Settings[K], string][] };

const GROUPS: Opt<keyof Settings>[] = [
  { key: 'temp', label: 'Temperature', options: [['c', '°C'], ['f', '°F']] },
  { key: 'wind', label: 'Wind speed', options: [['mph', 'mph'], ['kmh', 'km/h'], ['ms', 'm/s'], ['kn', 'knots']] },
  { key: 'precip', label: 'Rainfall', options: [['mm', 'mm'], ['in', 'inches']] },
  { key: 'pressure', label: 'Pressure', options: [['hpa', 'hPa / mb'], ['inhg', 'inHg']] },
  { key: 'clock', label: 'Clock', options: [['24', '24-hour'], ['12', '12-hour']] },
  { key: 'motion', label: 'Sky animation', options: [['full', 'Full'], ['reduced', 'Reduced']] },
] as Opt<keyof Settings>[];

export function initSettings() {
  const sheet = document.getElementById('settingsSheet')!;
  const btn = document.getElementById('settingsBtn')!;

  const render = () => {
    sheet.innerHTML = `
      <div class="sheet-head"><h2>Settings</h2><button class="icon-btn small" id="settingsClose" aria-label="Close settings">${UI.close}</button></div>
      ${GROUPS.map((g) => `
        <div class="seg-group">
          <span class="seg-label" id="lbl-${g.key}">${g.label}</span>
          <div class="seg" role="radiogroup" aria-labelledby="lbl-${g.key}">
            ${g.options.map(([v, l]) => `<button role="radio" aria-checked="${state.settings[g.key] === v}" data-k="${g.key}" data-v="${v}">${l}</button>`).join('')}
          </div>
        </div>`).join('')}
      <div class="sheet-foot">
        <button class="chip-btn ghost" id="settingsReset">${UI.reset}<span>UK defaults</span></button>
      </div>`;
    sheet.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) =>
      b.addEventListener('click', () => {
        (state.settings as unknown as Record<string, string>)[b.dataset.k!] = b.dataset.v!;
        save();
        render();
        sheet.querySelector<HTMLButtonElement>(`[data-k="${b.dataset.k}"][data-v="${b.dataset.v}"]`)?.focus();
      }),
    );
    sheet.querySelector('#settingsClose')!.addEventListener('click', close);
    sheet.querySelector('#settingsReset')!.addEventListener('click', () => { state.settings = { ...DEFAULT_SETTINGS }; save(); render(); });
  };

  const open = () => { render(); sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); btn.setAttribute('aria-expanded', 'true'); sheet.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(); };
  const close = () => { sheet.classList.remove('open'); sheet.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => (sheet.hidden ? open() : close()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { close(); btn.focus(); } });
  addEventListener('pointerdown', (e) => {
    if (!sheet.hidden && !sheet.contains(e.target as Node) && !btn.contains(e.target as Node)) close();
  });

  // Quick °C/°F toggle in the top bar
  const unit = document.getElementById('unitToggle')!;
  const syncUnit = () => unit.dataset.unit = state.settings.temp;
  syncUnit();
  unit.addEventListener('click', () => { state.settings.temp = state.settings.temp === 'c' ? 'f' : 'c'; save(); });
  return { syncUnit: () => { syncUnit(); if (!sheet.hidden) render(); } };
}
