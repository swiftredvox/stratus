// Unit conversion and formatting. All inputs are metric (°C, km/h, mm, hPa, m).
import { state } from './store';

export const temp = (c: number) => (state.settings.temp === 'f' ? c * 9 / 5 + 32 : c);
export const tempStr = (c: number) => `${Math.round(temp(c))}°`;
export const tempUnit = () => (state.settings.temp === 'f' ? '°F' : '°C');

export function wind(kmh: number): number {
  switch (state.settings.wind) {
    case 'mph': return kmh / 1.609344;
    case 'ms': return kmh / 3.6;
    case 'kn': return kmh / 1.852;
    default: return kmh;
  }
}
export const windUnit = () => ({ mph: 'mph', kmh: 'km/h', ms: 'm/s', kn: 'kn' })[state.settings.wind];
export const windStr = (kmh: number) => `${Math.round(wind(kmh))} ${windUnit()}`;

export const precip = (mm: number) => (state.settings.precip === 'in' ? mm / 25.4 : mm);
export const precipUnit = () => (state.settings.precip === 'in' ? 'in' : 'mm');
export function precipStr(mm: number) {
  const v = precip(mm);
  const d = state.settings.precip === 'in' ? (v < 1 ? 2 : 1) : v < 10 ? 1 : 0;
  return `${v.toFixed(d)} ${precipUnit()}`;
}

export const pressure = (hpa: number) => (state.settings.pressure === 'inhg' ? hpa * 0.0295299830714 : hpa);
export const pressureUnit = () => (state.settings.pressure === 'inhg' ? 'inHg' : 'hPa');
export const pressureStr = (hpa: number) => (state.settings.pressure === 'inhg' ? pressure(hpa).toFixed(2) : Math.round(hpa).toString()) + ' ' + pressureUnit();

export function distanceStr(m: number) {
  const miles = state.settings.wind === 'mph' || state.settings.temp === 'f';
  if (miles) {
    const mi = m / 1609.344;
    return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
  }
  const km = m / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/** Beaufort description from km/h */
export function beaufort(kmh: number): { force: number; label: string } {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const labels = ['Calm', 'Light air', 'Light breeze', 'Gentle breeze', 'Moderate breeze', 'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale', 'Strong gale', 'Storm', 'Violent storm', 'Hurricane force'];
  let f = 0;
  while (f < limits.length && kmh >= limits[f]) f++;
  return { force: f, label: labels[f] };
}

// Times are location-local ms, so always format in UTC.
export function time(ms: number, opts: { short?: boolean } = {}) {
  const d = new Date(ms);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (state.settings.clock === '12') {
    const hh = h % 12 || 12;
    const ap = h < 12 ? 'am' : 'pm';
    return opts.short && m === 0 ? `${hh}${ap}` : `${hh}:${String(m).padStart(2, '0')}${ap}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayShort = (ms: number) => DAYS[new Date(ms).getUTCDay()];
export const dayLong = (ms: number) => DAYS_LONG[new Date(ms).getUTCDay()];
export const dateShort = (ms: number) => { const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const dayStart = (ms: number) => Math.floor(ms / 86400000) * 86400000;

export function duration(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function relDay(ms: number, now: number) {
  const diff = Math.round((dayStart(ms) - dayStart(now)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return dayLong(ms);
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Colour for a temperature in °C, for range bars and the hourly curve. */
export function tempColor(c: number): string {
  const stops: [number, [number, number, number]][] = [
    [-15, [150, 120, 255]],
    [-5, [110, 160, 255]],
    [3, [100, 205, 255]],
    [10, [110, 230, 200]],
    [16, [190, 235, 120]],
    [22, [255, 210, 90]],
    [28, [255, 150, 70]],
    [35, [255, 90, 80]],
  ];
  if (c <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const t = (c - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      const a = stops[i - 1][1], b = stops[i][1];
      return `rgb(${a.map((v, k) => Math.round(lerp(v, b[k], t))).join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}
