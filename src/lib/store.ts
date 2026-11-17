// Persisted user preferences: units, places, panel layout. UK-flavoured defaults.
import type { Place } from '../api/weather';

export type TempUnit = 'c' | 'f';
export type WindUnit = 'mph' | 'kmh' | 'ms' | 'kn';
export type PrecipUnit = 'mm' | 'in';
export type PressureUnit = 'hpa' | 'inhg';
export type ClockUnit = '24' | '12';

export interface Settings {
  temp: TempUnit;
  wind: WindUnit;
  precip: PrecipUnit;
  pressure: PressureUnit;
  clock: ClockUnit;
  motion: 'full' | 'reduced';
}

export interface Layout {
  order: string[];
  hidden: string[];
  pinned: string[];
}

export interface State {
  settings: Settings;
  layout: Layout;
  saved: Place[];
  recent: Place[];
  last: Place | null;
}

const KEY = 'stratus:v2';
export const MAX_PINS = 4;

export const DEFAULT_SETTINGS: Settings = { temp: 'c', wind: 'mph', precip: 'mm', pressure: 'hpa', clock: '24', motion: 'full' };

export const DEFAULT_LAYOUT: Layout = {
  order: ['hourly', 'nexthour', 'daily', 'feels', 'humidity', 'precip', 'sun', 'wind', 'uv', 'air', 'pollen', 'moon', 'pressure', 'visibility'],
  hidden: [],
  pinned: ['feels', 'humidity'],
};

export const DEFAULT_PLACE: Place = { name: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB', lat: 51.5072, lon: -0.1276 };

function load(): State {
  const base: State = { settings: { ...DEFAULT_SETTINGS }, layout: structuredClone(DEFAULT_LAYOUT), saved: [], recent: [], last: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // Pick sensible units for US visitors on first run.
      const lang = navigator.language || '';
      if (/-(US|LR|MM)$/i.test(lang)) Object.assign(base.settings, { temp: 'f', precip: 'in', pressure: 'inhg', clock: '12' });
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) base.settings.motion = 'reduced';
      return base;
    }
    const s = JSON.parse(raw) as Partial<State>;
    const layout = { ...base.layout, ...(s.layout ?? {}) };
    // Panels added in later versions get appended to an existing saved order.
    for (const id of DEFAULT_LAYOUT.order) if (!layout.order.includes(id)) layout.order.push(id);
    layout.order = layout.order.filter((id) => DEFAULT_LAYOUT.order.includes(id));
    return {
      settings: { ...base.settings, ...(s.settings ?? {}) },
      layout,
      saved: s.saved ?? [],
      recent: s.recent ?? [],
      last: s.last ?? null,
    };
  } catch {
    return base;
  }
}

export const state: State = load();

type Listener = () => void;
const listeners = new Set<Listener>();
export const onChange = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };

export function save(notify = true) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  if (notify) listeners.forEach((fn) => fn());
}

export const samePlace = (a: Place | null | undefined, b: Place | null | undefined) =>
  !!a && !!b && Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

export function isSaved(p: Place) { return state.saved.some((s) => samePlace(s, p)); }

export function toggleSaved(p: Place) {
  if (isSaved(p)) state.saved = state.saved.filter((s) => !samePlace(s, p));
  else state.saved = [...state.saved, p];
  save();
}

export function pushRecent(p: Place) {
  state.recent = [p, ...state.recent.filter((r) => !samePlace(r, p))].slice(0, 6);
  state.last = p;
  save(false);
}

// Small cache of the last forecast per place for instant paint on reload.
const CACHE = 'stratus:cache';
export function readCache<T>(id: string, maxAgeMs: number): T | null {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) || '{}');
    const hit = all[id];
    if (hit && Date.now() - hit.at < maxAgeMs) return hit.data as T;
  } catch { /* ignore */ }
  return null;
}
export function writeCache(id: string, data: unknown) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) || '{}');
    all[id] = { at: Date.now(), data };
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(0, 6);
    localStorage.setItem(CACHE, JSON.stringify(Object.fromEntries(keys.map((k) => [k, all[k]]))));
  } catch { /* ignore */ }
}
