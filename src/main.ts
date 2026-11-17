import '@fontsource-variable/inter';
import './style.css';

document.documentElement.classList.add('styled');
import { fetchForecast, nowLocal, hourIndex, dayIndex, type Forecast, type Place } from './api/weather';
import { fetchAir, type AirQuality } from './api/air';
import { reverseGeocode, searchPlaces } from './api/geocode';
import { Sky } from './sky/sky';
import { accentFor } from './sky/palette';
import { sunPosition, moonPhase } from './lib/astro';
import { skyWeather, codeInfo, isSnowy } from './lib/codes';
import { state, onChange, toggleSaved, pushRecent, readCache, writeCache, DEFAULT_PLACE } from './lib/store';
import { tempStr, dayShort, time } from './lib/format';
import { ICON_DEFS, UI } from './ui/icons';
import { renderHero, updateHeroClock } from './ui/hero';
import { renderGrid, initCustomise } from './ui/layout';
import { initSearch } from './ui/search';
import { initSettings } from './ui/settings';
import type { Ctx } from './panels/types';
import type { SkyOverride } from './ui/lab';
import { randomPlace } from './lib/places';

// ---------- static chrome
document.body.insertAdjacentHTML('afterbegin', ICON_DEFS);
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
  el.innerHTML = UI[el.dataset.icon as keyof typeof UI] ?? '';
});

const sky = new Sky(document.getElementById('sky') as HTMLCanvasElement, document.getElementById('fx') as HTMLCanvasElement);

let place: Place = DEFAULT_PLACE;
let forecast: Forecast | null = null;
let air: AirQuality | null = null;
let previewIdx: number | null = null;
let previewLocked = false;
let loadCtrl: AbortController | null = null;
// Sky Lab (open with ?lab): overrides what the sky shows, for testing.
let lab: SkyOverride | null = null;
if (new URLSearchParams(location.search).has('lab')) {
  import('./ui/lab').then((m) => m.initLab((o) => { lab = o; updateSky(); }));
}

const toastEl = document.getElementById('toast')!;
let toastTimer = 0;
function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastEl.classList.remove('show'); setTimeout(() => (toastEl.hidden = true), 300); }, 3800);
}

// ---------- sky
function updateSky(instant = false) {
  if (!forecast) return;
  const f = forecast;
  const h = f.hourly;
  let utc = Date.now();
  let code = f.current.code, cloud = f.current.cloud, windKmh = f.current.windSpeed, windDir = f.current.windDir;
  let vis = h.visibility[hourIndex(h, nowLocal(f))];
  if (previewIdx != null) {
    const i = previewIdx;
    utc = h.time[i] - f.offset * 1000 + 30 * 60e3;
    code = h.code[i]; cloud = h.cloud[i]; windKmh = h.windSpeed[i]; windDir = h.windDir[i]; vis = h.visibility[i];
  }
  if (lab) {
    code = lab.code ?? code; cloud = lab.cloud ?? cloud; vis = lab.vis ?? vis; windKmh = lab.wind ?? windKmh; windDir = lab.windDir ?? windDir;
    if (lab.hour != null) utc = Math.floor(nowLocal(f) / 86400000) * 86400000 + lab.hour * 3600e3 - f.offset * 1000;
  }
  const sun = sunPosition(utc, place.lat, place.lon);
  // Lying snow: recent snowfall or snowing now
  const hi = hourIndex(h, nowLocal(f));
  let recentSnow = 0;
  for (let i = Math.max(0, hi - 36); i <= hi; i++) recentSnow += h.snow[i];
  const snowGround = lab?.snowGround ?? (isSnowy(code) || recentSnow > 0.5 ? 1 : 0);
  sky.set({
    sunElev: sun.elevation,
    sunAz: sun.azimuth,
    lat: place.lat,
    moonPhase: lab?.moonPhase ?? moonPhase(utc),
    weather: skyWeather(code, cloud, vis),
    windKmh,
    windDir,
    snowGround,
  }, instant);
  sky.motion = state.settings.motion === 'reduced' ? 0.2 : 1;
  document.documentElement.style.setProperty('--accent', accentFor(sun.elevation));
  document.documentElement.style.setProperty('--scrim', (0.16 + 0.22 * sky.brightness).toFixed(2));
  document.documentElement.classList.toggle('is-night', sun.elevation < -4);
}

// ---------- preview an hour in the sky
const pill = document.getElementById('previewPill')!;
function preview(i: number | null, lock = false) {
  if (!forecast) return;
  if (i == null) {
    if (previewLocked && !lock) return;
    previewLocked = false;
    previewIdx = null;
    pill.hidden = true;
    pill.classList.remove('show');
  } else {
    if (previewLocked && !lock && i !== previewIdx) return;
    previewLocked = lock || previewLocked;
    previewIdx = i;
    const h = forecast.hourly;
    document.getElementById('previewText')!.innerHTML =
      `<b>${dayShort(h.time[i])} ${time(h.time[i])}</b> ${tempStr(h.temp[i])} · ${codeInfo(h.code[i]).label}`;
    pill.hidden = false;
    requestAnimationFrame(() => pill.classList.add('show'));
  }
  document.querySelectorAll('.h-col.previewing').forEach((e) => e.classList.remove('previewing'));
  if (previewIdx != null) document.querySelector(`.h-col[data-i="${previewIdx}"]`)?.classList.add('previewing');
  updateSky();
}
document.getElementById('previewReset')!.addEventListener('click', () => {
  preview(null, true);
  document.querySelectorAll('.d-main[aria-expanded="true"]').forEach((b) => (b as HTMLButtonElement).click());
});

// ---------- render
function ctx(): Ctx | null {
  if (!forecast) return null;
  const now = nowLocal(forecast);
  return { f: forecast, air, place, now, hi: hourIndex(forecast.hourly, now), di: dayIndex(forecast.daily, now), preview };
}

function render() {
  const c = ctx();
  if (!c) return;
  renderHero(c, {
    onStar: () => { toggleSaved(place); toast(state.saved.some((p) => p.lat === place.lat) ? `Saved ${place.name}` : `Removed ${place.name}`); },
    onPlace: () => search.open(),
  });
  renderGrid(c);
  if (previewIdx != null) document.querySelector(`.h-col[data-i="${previewIdx}"]`)?.classList.add('previewing');
  document.title = `${Math.round(c.f.current.temp * (state.settings.temp === 'f' ? 9 / 5 : 1) + (state.settings.temp === 'f' ? 32 : 0))}° ${place.name} — Stratus`;
  document.querySelector('.place-btn-text')!.textContent = place.name;
  document.body.classList.add('ready');
}

// ---------- loading
const cacheId = (p: Place) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

async function load(p: Place, opts: { quiet?: boolean } = {}) {
  loadCtrl?.abort();
  const ctrl = (loadCtrl = new AbortController());
  const changed = p.lat !== place.lat || p.lon !== place.lon || !forecast;
  const prev = { place, forecast, air };
  place = p;
  setURL(p);
  if (changed) { previewIdx = null; previewLocked = false; pill.hidden = true; }

  const cached = readCache<{ f: Forecast; a: AirQuality | null }>(cacheId(p), 6 * 3600e3);
  if (changed && !cached && prev.forecast) forecast = null; // never show the old place's data under the new name
  if (cached && changed) {
    pushRecent(p);
    forecast = cached.f;
    air = cached.a;
    render();
    updateSky(!document.body.classList.contains('ready-sky'));
    document.body.classList.add('ready-sky');
  } else if (changed && !opts.quiet) {
    document.body.classList.add('loading');
  }

  try {
    const [f, a] = await Promise.all([
      fetchForecast(p.lat, p.lon, ctrl.signal),
      fetchAir(p.lat, p.lon, ctrl.signal).catch((e) => { if ((e as Error).name === 'AbortError') throw e; return null; }),
    ]);
    if (ctrl.signal.aborted) return;
    // Keep a preview on the same hour even if the hourly arrays shifted (e.g. after midnight)
    const previewT = previewIdx != null && forecast ? forecast.hourly.time[previewIdx] : null;
    forecast = f;
    air = a;
    if (previewT != null) {
      const k = f.hourly.time.indexOf(previewT);
      if (k >= 0) previewIdx = k; else { previewIdx = null; previewLocked = false; pill.hidden = true; }
    }
    writeCache(cacheId(p), { f, a });
    pushRecent(p);
    render();
    updateSky(!document.body.classList.contains('ready-sky'));
    document.body.classList.add('ready-sky');
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    console.error(e);
    if (changed && !cached && prev.forecast) {
      // Stay on the previous place rather than showing nothing
      ({ place, forecast, air } = prev);
      setURL(place);
      toast(`Couldn’t load the forecast for ${p.name}.`);
      return;
    }
    toast(forecast ? 'Couldn’t refresh the forecast — showing saved data.' : 'Couldn’t load the forecast. Check your connection.');
  } finally {
    if (loadCtrl === ctrl) document.body.classList.remove('loading');
  }
}

function setURL(p: Place) {
  const u = new URL(location.href);
  const keepLab = u.searchParams.has('lab');
  u.search = '';
  u.searchParams.set('place', p.name);
  u.searchParams.set('lat', p.lat.toFixed(4));
  u.searchParams.set('lon', p.lon.toFixed(4));
  if (keepLab) u.searchParams.set('lab', '');
  history.replaceState(null, '', u);
}

function locate() {
  if (!navigator.geolocation) { toast('Location isn’t available in this browser.'); return; }
  document.body.classList.add('loading');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      let p: Place = { name: 'My location', lat, lon };
      try { p = await reverseGeocode(lat, lon); } catch { /* keep generic name */ }
      load(p);
    },
    (err) => {
      document.body.classList.remove('loading');
      toast(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Couldn’t get your location.');
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60e3 },
  );
}

// ---------- UI wiring
const surprise = () => load(randomPlace(place));
const search = initSearch({ onPick: (p) => load(p), onLocate: locate, onRandom: surprise, current: () => place });
document.getElementById('randomBtn')!.addEventListener('click', surprise);
const settings = initSettings();
initCustomise();
document.getElementById('locateBtn')!.addEventListener('click', locate);

onChange(() => {
  settings.syncUnit();
  render();
  if (previewIdx != null) preview(previewIdx, previewLocked);
  updateSky();
});

// Scroll: fade the hero, deepen the veil, solidify the top bar
const veil = document.querySelector<HTMLElement>('.veil')!;
const topbar = document.getElementById('topbar')!;
const heroEl = document.getElementById('hero')!;
function onScroll() {
  const y = scrollY, h = innerHeight;
  const t = Math.min(1, y / (h * 0.7));
  veil.style.opacity = String(t * 0.85);
  heroEl.style.setProperty('--fade', String(1 - Math.min(1, y / (h * 0.55))));
  heroEl.style.setProperty('--lift', `${-y * 0.15}px`);
  topbar.classList.toggle('solid', y > 40);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Ticks: clock + sun every 30s; refresh data every 10 min or when returning to the tab
setInterval(() => {
  if (!forecast) return;
  updateHeroClock(nowLocal(forecast));
  if (previewIdx == null) updateSky();
}, 30e3);
setInterval(() => { if (!document.hidden) load(place, { quiet: true }); }, 10 * 60e3);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && forecast && Date.now() - forecast.fetchedAt > 10 * 60e3) load(place, { quiet: true });
});

// ---------- boot
async function boot() {
  const q = new URLSearchParams(location.search);
  const lat = parseFloat(q.get('lat') ?? ''), lon = parseFloat(q.get('lon') ?? '');
  if (!isNaN(lat) && !isNaN(lon)) {
    const known = [...state.saved, ...state.recent].find((p) => Math.abs(p.lat - lat) < 0.01 && Math.abs(p.lon - lon) < 0.01);
    return load(known ?? { name: q.get('place') || 'Pinned location', lat, lon });
  }
  const text = q.get('q') || q.get('postal'); // links from the original Stratus still work
  if (text) {
    try {
      const [first] = await searchPlaces(text);
      if (first) return load(first);
      toast(`Couldn’t find “${text}”.`);
    } catch { /* fall through */ }
  }
  load(state.last ?? DEFAULT_PLACE);
}
boot();
