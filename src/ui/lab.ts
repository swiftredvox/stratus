// Sky Lab: a hidden panel (open with ?lab in the URL) for forcing any weather,
// time of day, wind or moon phase in the sky. Handy for testing and recording.

export interface SkyOverride {
  code?: number;
  cloud?: number;
  vis?: number;
  wind?: number;
  windDir?: number;
  hour?: number;
  snowGround?: number;
  moonPhase?: number;
}

const PRESETS: [string, number | null, number][] = [
  ['Live', null, 0],
  ['Clear', 0, 0],
  ['Partly', 2, 45],
  ['Overcast', 3, 100],
  ['Fog', 45, 90],
  ['Drizzle', 53, 100],
  ['Rain', 63, 100],
  ['Downpour', 65, 100],
  ['Storm', 95, 100],
  ['Hail storm', 99, 100],
  ['Sleet', 67, 100],
  ['Snow', 73, 100],
  ['Blizzard', 75, 100],
];

export function initLab(apply: (o: SkyOverride | null) => void) {
  const o: SkyOverride = {};
  let playing = false;
  let raf = 0;

  const el = document.createElement('aside');
  el.className = 'lab';
  el.setAttribute('aria-label', 'Sky Lab');
  el.innerHTML = `
    <header><b>Sky Lab</b><span>test mode</span><button class="lab-min" aria-label="Minimise">–</button><button class="lab-x" aria-label="Close Sky Lab">×</button></header>
    <div class="lab-body">
      <div class="lab-presets">${PRESETS.map(([n], i) => `<button data-p="${i}"${i === 0 ? ' class="on"' : ''}>${n}</button>`).join('')}</div>
      ${row('hour', 'Time of day', 0, 24, 0.25, 'Live', true)}
      ${row('cloud', 'Cloud cover', 0, 100, 1, 'Live', true)}
      ${row('wind', 'Wind (km/h)', 0, 80, 1, 'Live', true)}
      ${row('windDir', 'Wind from', 0, 359, 1, 'Live', true)}
      ${row('vis', 'Visibility (km)', 0.2, 20, 0.1, 'Live', true)}
      ${row('moonPhase', 'Moon phase', 0, 1, 0.01, 'Live', true)}
      <label class="lab-check"><input type="checkbox" data-k="snowGround"> Snow on the ground</label>
      <div class="lab-actions">
        <button class="lab-play">▶ Play day</button>
        <button class="lab-reset">Reset all</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  function row(k: string, label: string, min: number, max: number, step: number, live: string, off: boolean) {
    return `<div class="lab-row" data-k="${k}">
      <label><input type="checkbox" class="lab-on"${off ? '' : ' checked'}> ${label}</label>
      <output>${live}</output>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${(min + max) / 2}" disabled>
    </div>`;
  }

  const fmt = (k: string, v: number) =>
    k === 'hour' ? `${String(Math.floor(v) % 24).padStart(2, '0')}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`
      : k === 'moonPhase' ? (v < 0.03 || v > 0.97 ? 'New' : Math.abs(v - 0.5) < 0.03 ? 'Full' : v < 0.5 ? `Waxing ${Math.round(v * 200)}%` : `Waning ${Math.round((1 - v) * 200)}%`)
        : k === 'windDir' ? `${Math.round(v)}°` : String(Math.round(v * 10) / 10);

  const push = () => apply(Object.keys(o).length ? { ...o, vis: o.vis != null ? o.vis * 1000 : undefined } : null);

  el.querySelectorAll<HTMLElement>('.lab-row').forEach((r) => {
    const k = r.dataset.k as keyof SkyOverride;
    const on = r.querySelector<HTMLInputElement>('.lab-on')!;
    const range = r.querySelector<HTMLInputElement>('input[type=range]')!;
    const out = r.querySelector('output')!;
    const sync = () => {
      range.disabled = !on.checked;
      if (on.checked) { o[k] = Number(range.value); out.textContent = fmt(k, Number(range.value)); }
      else { delete o[k]; out.textContent = 'Live'; }
      push();
    };
    on.addEventListener('change', sync);
    range.addEventListener('input', sync);
  });

  const setRow = (k: string, v: number | null) => {
    const r = el.querySelector<HTMLElement>(`.lab-row[data-k="${k}"]`)!;
    const on = r.querySelector<HTMLInputElement>('.lab-on')!;
    const range = r.querySelector<HTMLInputElement>('input[type=range]')!;
    on.checked = v != null;
    if (v != null) range.value = String(v);
    range.disabled = v == null;
    r.querySelector('output')!.textContent = v == null ? 'Live' : fmt(k, v);
    if (v == null) delete o[k as keyof SkyOverride]; else o[k as keyof SkyOverride] = v;
  };

  el.querySelectorAll<HTMLButtonElement>('.lab-presets button').forEach((b) =>
    b.addEventListener('click', () => {
      const [, code, cloud] = PRESETS[Number(b.dataset.p)];
      el.querySelectorAll('.lab-presets button').forEach((x) => x.classList.toggle('on', x === b));
      if (code == null) { delete o.code; setRow('cloud', null); setRow('vis', null); }
      else {
        o.code = code;
        setRow('cloud', cloud);
        setRow('vis', code === 45 ? 0.4 : null);
        const snow = el.querySelector<HTMLInputElement>('[data-k=snowGround]')!;
        if (code === 73 || code === 75) { snow.checked = true; o.snowGround = 1; }
      }
      push();
    }),
  );

  el.querySelector<HTMLInputElement>('[data-k=snowGround]')!.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).checked) o.snowGround = 1; else delete o.snowGround;
    push();
  });

  const playBtn = el.querySelector<HTMLButtonElement>('.lab-play')!;
  const stop = () => { playing = false; cancelAnimationFrame(raf); playBtn.textContent = '▶ Play day'; };
  playBtn.addEventListener('click', () => {
    if (playing) return stop();
    playing = true;
    playBtn.textContent = '❚❚ Pause';
    if (o.hour == null) setRow('hour', 4);
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000; last = t;
      setRow('hour', ((o.hour ?? 0) + dt * 1.2) % 24);
      push();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  el.querySelector('.lab-reset')!.addEventListener('click', () => {
    stop();
    for (const k of ['hour', 'cloud', 'wind', 'windDir', 'vis', 'moonPhase']) setRow(k, null);
    delete o.code; delete o.snowGround;
    el.querySelector<HTMLInputElement>('[data-k=snowGround]')!.checked = false;
    el.querySelectorAll('.lab-presets button').forEach((x, i) => x.classList.toggle('on', i === 0));
    push();
  });
  el.querySelector('.lab-min')!.addEventListener('click', () => el.classList.toggle('min'));
  el.querySelector('.lab-x')!.addEventListener('click', () => { stop(); el.remove(); apply(null); });
}
