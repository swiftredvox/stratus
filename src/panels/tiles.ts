// The smaller detail panels.
import type { PanelDef, Ctx } from './types';
import {
  tempStr, temp, windStr, wind, windUnit, compass, beaufort, time, duration, precipStr, pressure, pressureUnit, pressureStr,
  distanceStr, dateShort, clamp, dayShort,
} from '../lib/format';
import { moonPhase, moonIllumination, moonPhaseName, nextPhase } from '../lib/astro';
import { hourIndex } from '../api/weather';
import { isSnowy } from '../lib/codes';

const big = (v: string, unit = '') => `<div class="t-big">${v}${unit ? `<span>${unit}</span>` : ''}</div>`;

// ---------- Next hours (minute-level rain)
export const nexthour: PanelDef = {
  id: 'nexthour',
  title: 'Rain in the next 4 hours',
  cols: 2,
  rows: 2,
  render(c) {
    const m = c.f.minutely;
    let bars = '';
    let axis = '';
    let headline = 'Minute-by-minute rain isn’t available here.';
    if (m && m.time.length) {
      let s = 0;
      while (s < m.time.length - 1 && m.time[s + 1] <= c.now) s++;
      const slots = m.time.slice(s, s + 16).map((t, k) => ({ t, v: m.precip[s + k] * 4 })); // mm/h
      headline = windowHeadline(slots, c);
      const scale = (v: number) => (v <= 0 ? 0 : clamp(Math.log10(1 + v * 4) / Math.log10(1 + 40), 0.06, 1));
      bars = slots.map((x) => `<i style="--h:${scale(x.v).toFixed(3)}" title="${time(x.t)}: ${precipStr(x.v)}/h"></i>`).join('');
      axis = [0, 4, 8, 12].map((k) => `<span>${k === 0 ? 'Now' : slots[k] ? time(slots[k].t) : ''}</span>`).join('');
    }
    return `<p class="t-headline">${headline}</p>
      <div class="nh-chart"><div class="nh-levels"><span>Heavy</span><span>Moderate</span><span>Light</span></div><div class="nh-bars">${bars}</div></div>
      <div class="nh-axis">${axis}</div>`;
  },
};

/** Describe rain within the 4-hour window only (the hero covers the longer outlook). */
function windowHeadline(slots: { t: number; v: number }[], c: Ctx): string {
  const WET = 0.2; // mm/h
  const word = (t: number) => (isSnowy(c.f.hourly.code[hourIndex(c.f.hourly, t)]) ? 'snow' : 'rain');
  const strength = (v: number) => (v < 1 ? 'Light' : v < 4 ? 'Moderate' : 'Heavy');
  const wet = slots.map((x) => x.v >= WET);
  if (!wet.some(Boolean)) {
    // Models may still give a high chance of showers even when the central forecast is dry
    const h = c.f.hourly;
    let pop = 0;
    for (let i = hourIndex(h, c.now); i < h.time.length && h.time[i] < c.now + 4 * 3600e3; i++) pop = Math.max(pop, h.pop[i]);
    return pop >= 40 ? `${Math.round(pop / 5) * 5}% chance of showers, but little or no rain expected` : 'No rain expected in the next 4 hours';
  }
  const peak = Math.max(...slots.map((x) => x.v));
  if (wet[0]) {
    const dry = wet.findIndex((w, k) => k > 0 && !w && !wet[k + 1]);
    const w = word(slots[0].t);
    return dry > 0 ? `${strength(peak)} ${w} easing around ${time(slots[dry].t)}` : `${strength(peak)} ${w} for the next 4 hours`;
  }
  const start = wet.findIndex(Boolean);
  const mins = Math.round((slots[start].t - c.now) / 60000 / 5) * 5;
  const w = word(slots[start].t);
  return mins <= 50 ? `${strength(peak)} ${w} starting in about ${Math.max(5, mins)} min` : `${strength(peak)} ${w} starting around ${time(slots[start].t)}`;
}

// ---------- Wind
export const windPanel: PanelDef = {
  id: 'wind',
  title: 'Wind',
  cols: 2,
  rows: 2,
  render(c) {
    const cur = c.f.current;
    const b = beaufort(cur.windSpeed);
    const ticks = Array.from({ length: 72 }, (_, i) => {
      const a = (i * 5 * Math.PI) / 180, long = i % 18 === 0;
      const r1 = long ? 40 : 43, r2 = 47;
      return `<line x1="${(50 + Math.sin(a) * r1).toFixed(2)}" y1="${(50 - Math.cos(a) * r1).toFixed(2)}" x2="${(50 + Math.sin(a) * r2).toFixed(2)}" y2="${(50 - Math.cos(a) * r2).toFixed(2)}" class="${long ? 'long' : ''}"/>`;
    }).join('');
    const rot = (cur.windDir + 180) % 360; // arrow points where the wind is going
    return `<div class="wind">
      <svg class="compass" viewBox="0 0 100 100" aria-hidden="true">
        <g class="ticks">${ticks}</g>
        <text x="50" y="16">N</text><text x="86" y="53">E</text><text x="50" y="90">S</text><text x="14" y="53">W</text>
        <g class="arrow" style="transform:rotate(${rot}deg)">
          <line x1="50" y1="80" x2="50" y2="24"/><path d="M50 16 l6 11 h-12z"/><circle cx="50" cy="80" r="3"/>
        </g>
        <circle cx="50" cy="50" r="15" class="hub"/>
        <text x="50" y="50" class="spd">${Math.round(wind(cur.windSpeed))}</text>
        <text x="50" y="59" class="unit">${windUnit()}</text>
      </svg>
      <div class="wind-meta">
        <p><b>${b.label}</b></p>
        <p>From the ${compass(cur.windDir)}</p>
        <p>Gusts ${windStr(cur.windGust)}</p>
      </div>
      ${windChart(c)}
    </div>`;
  },
  chip(c) {
    return { label: 'Wind', value: `${windStr(c.f.current.windSpeed)} ${compass(c.f.current.windDir)}` };
  },
};

function windChart(c: Ctx): string {
  const h = c.f.hourly;
  const idx = Array.from({ length: 25 }, (_, k) => c.hi + k).filter((i) => i < h.time.length);
  const sp = idx.map((i) => wind(h.windSpeed[i]));
  const gu = idx.map((i) => wind(h.windGust[i]));
  const max = Math.max(5, ...gu) * 1.1;
  const W = 240, H = 80;
  const x = (k: number) => (k / (idx.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const line = (a: number[]) => a.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${line(sp)} ${W},${H}`;
  const peakK = gu.indexOf(Math.max(...gu));
  const labels = [0, 6, 12, 18, 24].filter((k) => k < idx.length).map((k) => `<span>${k === 0 ? 'Now' : time(h.time[idx[k]], { short: true })}</span>`).join('');
  return `<div class="wind-chart">
    <div class="wc-legend"><span><i class="sp"></i>Wind</span><span><i class="gu"></i>Gusts</span><span class="muted">Peak gust ${Math.round(gu[peakK])} ${windUnit()} at ${time(h.time[idx[peakK]])}</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${area}" class="wc-area"/>
      <polyline points="${line(sp)}" class="wc-sp"/>
      <polyline points="${line(gu)}" class="wc-gu"/>
    </svg>
    <div class="wc-axis">${labels}</div>
  </div>`;
}

// ---------- Sun
export const sunPanel: PanelDef = {
  id: 'sun',
  title: 'Sun',
  cols: 1,
  rows: 2,
  render(c) {
    const d = c.f.daily, i = c.di;
    const rise = d.sunrise[i], set = d.sunset[i];
    if (isNaN(rise) || isNaN(set)) {
      const up = c.f.hourly.isDay[c.hi];
      return `<p class="t-headline">${up ? 'Midnight sun' : 'Polar night'}</p><p class="muted">The sun doesn’t ${up ? 'set' : 'rise'} here today.</p>`;
    }
    const prog = clamp((c.now - rise) / (set - rise), 0, 1);
    const ang = Math.PI * (1 - prog);
    const cx = 60 + Math.cos(ang) * 48, cy = 58 - Math.sin(ang) * 44;
    const up = c.now >= rise && c.now <= set;
    const delta = i > 0 ? d.daylight[i] - d.daylight[i - 1] : 0;
    const dm = Math.round(Math.abs(delta) / 60);
    const ds = Math.round(Math.abs(delta) % 60);
    let next = '';
    if (c.now < rise) next = `Sunrise in ${duration((rise - c.now) / 1000)}`;
    else if (up) next = `Sunset in ${duration((set - c.now) / 1000)}`;
    else if (!isNaN(d.sunrise[i + 1])) next = `Sunrise in ${duration((d.sunrise[i + 1] - c.now) / 1000)}`;
    return `<svg class="sun-arc" viewBox="0 0 120 66" aria-hidden="true">
        <defs><linearGradient id="sa" x1="0" x2="1"><stop offset="0" stop-color="#ffb36b"/><stop offset=".5" stop-color="#ffe9a8"/><stop offset="1" stop-color="#ff8f6b"/></linearGradient></defs>
        <path d="M12 58 A48 44 0 0 1 108 58" class="track"/>
        <path d="M12 58 A48 44 0 0 1 108 58" class="done" stroke="url(#sa)" pathLength="100" stroke-dasharray="${(prog * 100).toFixed(1)} 100"/>
        <line x1="4" x2="116" y1="58" y2="58" class="horizon"/>
        ${up ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" class="sun-dot"/>` : ''}
      </svg>
      <div class="sun-times"><div><small>Sunrise</small><b>${time(rise)}</b></div><div><small>Sunset</small><b>${time(set)}</b></div></div>
      <p class="muted small">${next}${next ? ' · ' : ''}${duration(d.daylight[i])} daylight${delta ? ` (${delta > 0 ? '+' : '−'}${dm}m ${ds}s)` : ''}</p>`;
  },
  chip(c) {
    const d = c.f.daily, i = c.di;
    if (isNaN(d.sunset[i])) return null;
    if (c.now < d.sunrise[i]) return { label: 'Sunrise', value: time(d.sunrise[i]) };
    if (c.now < d.sunset[i]) return { label: 'Sunset', value: time(d.sunset[i]) };
    return isNaN(d.sunrise[i + 1]) ? null : { label: 'Sunrise', value: time(d.sunrise[i + 1]) };
  },
};

// ---------- UV
const uvBand = (v: number) => (v < 3 ? 'Low' : v < 6 ? 'Moderate' : v < 8 ? 'High' : v < 11 ? 'Very high' : 'Extreme');
export const uvPanel: PanelDef = {
  id: 'uv',
  title: 'UV index',
  cols: 1,
  rows: 2,
  render(c) {
    const h = c.f.hourly;
    const v = h.uv[c.hi];
    // Today's peak and protection window
    let peak = 0, peakT = 0, from = 0, to = 0;
    for (let i = c.hi; i < h.time.length && h.time[i] < c.f.daily.time[c.di] + 86400000; i++) {
      if (h.uv[i] > peak) { peak = h.uv[i]; peakT = h.time[i]; }
      if (h.uv[i] >= 3) { if (!from) from = h.time[i]; to = h.time[i] + 3600e3; }
    }
    const pos = clamp(v / 11, 0, 1) * 100;
    const advice = from
      ? `Sun protection advised ${time(from)}–${time(to)}`
      : peak > 0 ? 'No protection needed for the rest of today' : 'No UV for the rest of today';
    return `${big(String(Math.round(v)))}
      <p class="t-sub">${uvBand(v)}</p>
      <div class="scale uv-scale"><i style="left:${pos}%"></i></div>
      <p class="muted small">${peak > v + 0.5 ? `Peaks at ${Math.round(peak)} around ${time(peakT)}. ` : ''}${advice}.</p>`;
  },
  chip(c) {
    const v = c.f.hourly.uv[c.hi];
    return { label: 'UV', value: `${Math.round(v)} · ${uvBand(v)}` };
  },
};

// ---------- Air quality
function aqi(c: Ctx): { v: number; band: string; pos: number; scale: 'eu' | 'us' } | null {
  if (!c.air) return null;
  const us = c.place.countryCode === 'US';
  if (us && c.air.usAqi != null) {
    const v = c.air.usAqi;
    const band = v <= 50 ? 'Good' : v <= 100 ? 'Moderate' : v <= 150 ? 'Unhealthy for some' : v <= 200 ? 'Unhealthy' : v <= 300 ? 'Very unhealthy' : 'Hazardous';
    return { v, band, pos: clamp(v / 300, 0, 1) * 100, scale: 'us' };
  }
  if (c.air.euAqi == null) return null;
  const v = c.air.euAqi;
  const band = v <= 20 ? 'Good' : v <= 40 ? 'Fair' : v <= 60 ? 'Moderate' : v <= 80 ? 'Poor' : v <= 100 ? 'Very poor' : 'Extremely poor';
  return { v, band, pos: clamp(v / 100, 0, 1) * 100, scale: 'eu' };
}
export const airPanel: PanelDef = {
  id: 'air',
  title: 'Air quality',
  cols: 1,
  rows: 2,
  render(c) {
    const a = aqi(c);
    if (!a || !c.air) return `<p class="muted">Air quality data isn’t available right now.</p>`;
    const row = (k: string, v: number | null) => (v == null ? '' : `<div><dt>${k}</dt><dd>${Math.round(v)} <small>µg/m³</small></dd></div>`);
    return `${big(String(Math.round(a.v)))}
      <p class="t-sub">${a.band} <small class="muted">${a.scale === 'us' ? 'US AQI' : 'European AQI'}</small></p>
      <div class="scale aqi-scale ${a.scale}"><i style="left:${a.pos}%"></i></div>
      <dl class="mini">${row('PM2.5', c.air.pm25)}${row('NO₂', c.air.no2)}${row('O₃', c.air.o3)}</dl>`;
  },
  chip(c) {
    const a = aqi(c);
    return a ? { label: 'Air', value: `${Math.round(a.v)} · ${a.band}` } : null;
  },
};

// ---------- Feels like
export const feelsPanel: PanelDef = {
  id: 'feels',
  title: 'Feels like',
  cols: 1,
  rows: 2,
  render(c) {
    const cur = c.f.current;
    const diff = cur.feels - cur.temp;
    let why = 'Similar to the actual temperature.';
    if (diff <= -1.5) why = cur.windSpeed > 10 ? 'Wind is making it feel colder.' : 'Feels colder than the actual temperature.';
    else if (diff >= 1.5) why = cur.humidity > 60 ? 'Humidity is making it feel warmer.' : 'Sunshine is making it feel warmer.';
    return `${big(tempStr(cur.feels))}
      <p class="t-sub">Actual ${tempStr(cur.temp)}</p>
      <p class="muted small">${why}</p>`;
  },
  chip(c) { return { label: 'Feels like', value: tempStr(c.f.current.feels) }; },
};

// ---------- Humidity
export const humidityPanel: PanelDef = {
  id: 'humidity',
  title: 'Humidity',
  cols: 1,
  rows: 2,
  render(c) {
    const hu = c.f.current.humidity;
    const dew = c.f.hourly.dew[c.hi];
    const comfort = dew < 5 ? 'Dry' : dew < 13 ? 'Comfortable' : dew < 16 ? 'Slightly humid' : dew < 19 ? 'Humid' : 'Muggy';
    return `${big(String(Math.round(hu)), '%')}
      <p class="t-sub">${comfort}</p>
      <div class="hum-bar"><i style="width:${hu}%"></i></div>
      <p class="muted small">Dew point ${tempStr(dew)}</p>`;
  },
  chip(c) { return { label: 'Humidity', value: `${Math.round(c.f.current.humidity)}%` }; },
};

// ---------- Pressure
function pressureTrend(c: Ctx) {
  const h = c.f.hourly;
  const now = h.pressure[c.hi];
  const before = h.pressure[Math.max(0, c.hi - 3)];
  const d = now - before;
  return { d, label: d > 1 ? 'Rising' : d < -1 ? 'Falling' : 'Steady', arrow: d > 1 ? '↑' : d < -1 ? '↓' : '→' };
}
export const pressurePanel: PanelDef = {
  id: 'pressure',
  title: 'Pressure',
  cols: 1,
  rows: 2,
  render(c) {
    const h = c.f.hourly;
    const p = c.f.current.pressure;
    const tr = pressureTrend(c);
    const from = Math.max(0, c.hi - 24), to = Math.min(h.time.length - 1, c.hi + 24);
    const vals = h.pressure.slice(from, to + 1);
    const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
    const pts = vals.map((v, k) => `${((k / (vals.length - 1)) * 120).toFixed(1)},${(36 - ((v - lo) / (hi - lo)) * 32).toFixed(1)}`).join(' ');
    const nx = ((c.hi - from) / (vals.length - 1)) * 120;
    const val = pressure(p);
    return `${big(state_pressure(val), pressureUnit())}
      <p class="t-sub">${tr.arrow} ${tr.label}</p>
      <svg class="spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><line x1="${nx}" x2="${nx}" y1="0" y2="40" class="now"/>
      </svg>
      <p class="muted small spark-axis"><span>−24h</span><span>now</span><span>+24h</span></p>`;
  },
  chip(c) {
    const tr = pressureTrend(c);
    return { label: 'Pressure', value: `${pressureStr(c.f.current.pressure)} ${tr.arrow}` };
  },
};
function state_pressure(v: number) { return pressureUnit() === 'inHg' ? v.toFixed(2) : String(Math.round(v)); }

// ---------- Visibility
const visBand = (m: number) => (m >= 20000 ? 'Excellent' : m >= 10000 ? 'Very good' : m >= 5000 ? 'Good' : m >= 2000 ? 'Moderate' : m >= 1000 ? 'Poor' : 'Fog');
export const visibilityPanel: PanelDef = {
  id: 'visibility',
  title: 'Visibility',
  cols: 1,
  rows: 2,
  render(c) {
    const v = c.f.hourly.visibility[c.hi];
    const [num, unit] = distanceStr(v).split(' ');
    const desc = v >= 10000 ? 'Clear view into the distance.' : v >= 4000 ? 'Some haze limiting the view.' : 'Mist or fog is reducing visibility.';
    return `${big(num, unit)}
      <p class="t-sub">${visBand(v)}</p>
      <p class="muted small">${desc}</p>`;
  },
  chip(c) { return { label: 'Visibility', value: distanceStr(c.f.hourly.visibility[c.hi]) }; },
};

// ---------- Moon
export function moonSVG(phase: number, size: number, south = false): string {
  // Lit region bounded by the limb and an elliptical terminator.
  const r = 40, cx = 50, cy = 50;
  const k = Math.cos(phase * 2 * Math.PI); // 1 new → -1 full
  const waxing = phase < 0.5;
  const rx = Math.abs(k) * r;
  // Draw lit part: outer limb on the lit side + terminator
  const litRight = waxing !== south;
  const sweepLimb = litRight ? 1 : 0;
  const termSweep = (k > 0) === litRight ? 0 : 1;
  const path = `M${cx} ${cy - r} A${r} ${r} 0 0 ${sweepLimb} ${cx} ${cy + r} A${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r}Z`;
  return `<svg class="moon-svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <radialGradient id="mg" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#fbf8ec"/><stop offset="1" stop-color="#c7c6bd"/></radialGradient>
      <filter id="mglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a2035" opacity=".85"/>
    <path d="${path}" fill="#fff8de" opacity=".35" filter="url(#mglow)"/>
    <path d="${path}" fill="url(#mg)"/>
    <g fill="#000" opacity=".07"><circle cx="38" cy="38" r="7"/><circle cx="60" cy="58" r="9"/><circle cx="56" cy="32" r="4"/><circle cx="40" cy="64" r="5"/></g>
  </svg>`;
}
export const moonPanel: PanelDef = {
  id: 'moon',
  title: 'Moon',
  cols: 1,
  rows: 2,
  render(c) {
    const utc = Date.now();
    const p = moonPhase(utc);
    const full = nextPhase(utc, 0.5) + c.f.offset * 1000;
    const nw = nextPhase(utc, 0) + c.f.offset * 1000;
    return `<div class="moon">
      ${moonSVG(p, 84, c.place.lat < 0)}
      <div>
        <p class="t-sub">${moonPhaseName(p)}</p>
        <p class="muted small">${Math.round(moonIllumination(p) * 100)}% illuminated</p>
      </div>
    </div>
    <dl class="mini two">
      <div><dt>Full moon</dt><dd>${dayShort(full)} ${dateShort(full)}</dd></div>
      <div><dt>New moon</dt><dd>${dayShort(nw)} ${dateShort(nw)}</dd></div>
    </dl>`;
  },
  chip() { return { label: 'Moon', value: moonPhaseName(moonPhase(Date.now())) }; },
};

// ---------- Pollen
const pollenBand = (v: number) => (v < 10 ? 'Low' : v < 50 ? 'Moderate' : v < 200 ? 'High' : 'Very high');
export const pollenPanel: PanelDef = {
  id: 'pollen',
  title: 'Pollen',
  cols: 1,
  rows: 2,
  render(c) {
    const p = c.air?.pollen;
    if (!p) return `<p class="muted">Pollen forecasts cover Europe during the pollen season. None available here right now.</p>`;
    const top = [...p].sort((a, b) => b.value - a.value);
    const rows = top.slice(0, 4).map((x) => `<li><span>${x.label}</span><span class="pl-bar"><i style="width:${clamp(Math.log10(1 + x.value) / Math.log10(301), 0.02, 1) * 100}%" class="lv-${pollenBand(x.value).replace(' ', '-').toLowerCase()}"></i></span><b>${pollenBand(x.value)}</b></li>`).join('');
    return `<p class="t-sub">${top[0].value < 10 ? 'Low overall' : `${top[0].label}: ${pollenBand(top[0].value).toLowerCase()}`}</p><ul class="pollen">${rows}</ul>`;
  },
  chip(c) {
    const p = c.air?.pollen;
    if (!p) return null;
    const top = [...p].sort((a, b) => b.value - a.value)[0];
    return { label: 'Pollen', value: top.value < 10 ? 'Low' : `${top.label} · ${pollenBand(top.value)}` };
  },
};

// ---------- Precipitation totals
export const precipPanel: PanelDef = {
  id: 'precip',
  title: 'Rainfall',
  cols: 1,
  rows: 2,
  render(c) {
    const h = c.f.hourly, d = c.f.daily;
    let next24 = 0, snow24 = 0;
    for (let i = c.hi; i < Math.min(h.time.length, c.hi + 24); i++) { next24 += h.precip[i]; snow24 += h.snow[i]; }
    let last24 = 0;
    for (let i = Math.max(0, c.hi - 24); i < c.hi; i++) last24 += h.precip[i];
    let week = 0;
    for (let i = c.di; i < Math.min(d.time.length, c.di + 7); i++) week += d.precipSum[i];
    const [n, u] = precipStr(next24).split(' ');
    return `${big(n, u)}
      <p class="t-sub">Expected in the next 24h</p>
      <dl class="mini">
        <div><dt>Last 24h</dt><dd>${precipStr(last24)}</dd></div>
        <div><dt>Next 7 days</dt><dd>${precipStr(week)}</dd></div>
        ${snow24 > 0.1 ? `<div><dt>Snow 24h</dt><dd>${snow24.toFixed(1)} cm</dd></div>` : ''}
      </dl>`;
  },
  chip(c) {
    const h = c.f.hourly;
    let s = 0;
    for (let i = c.hi; i < Math.min(h.time.length, c.hi + 24); i++) s += h.precip[i];
    return { label: 'Rainfall 24h', value: precipStr(s) };
  },
};

void temp;
