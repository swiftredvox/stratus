// Hand-built SVG weather icons. Shared gradients live in one hidden <defs> block.
import type { IconKind } from '../lib/codes';

export const ICON_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <radialGradient id="g-sun" cx="40%" cy="38%" r="70%">
      <stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#ffd34f"/><stop offset="1" stop-color="#ff9a2e"/>
    </radialGradient>
    <linearGradient id="g-moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfaf2"/><stop offset="1" stop-color="#c9cde0"/>
    </linearGradient>
    <linearGradient id="g-cloud" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd9e8"/>
    </linearGradient>
    <linearGradient id="g-cloud-back" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dfe6f1"/><stop offset="1" stop-color="#a9b6ca"/>
    </linearGradient>
    <linearGradient id="g-cloud-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9ea9bd"/><stop offset="1" stop-color="#5d6a82"/>
    </linearGradient>
    <linearGradient id="g-bolt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3a6"/><stop offset="1" stop-color="#ffb627"/>
    </linearGradient>
  </defs>
</svg>`;

const CLOUD = 'M18 48h28a10 10 0 0 0 1-19.95 14 14 0 0 0-27.2-3.4A11.5 11.5 0 0 0 18 48z';

const sun = (cx: number, cy: number, r: number, rays = true) => `
  <g class="i-sun">
    ${rays ? `<g class="i-rays" style="transform-origin:${cx}px ${cy}px" stroke="#ffc943" stroke-width="${r * 0.22}" stroke-linecap="round">
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const r1 = r * 1.42, r2 = r * 1.85;
        return `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}"/>`;
      }).join('')}
    </g>` : ''}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g-sun)"/>
  </g>`;

const moon = (cx: number, cy: number, r: number) => `
  <g class="i-moon">
    <path d="M${cx + r * 0.25} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.75} ${r * 1.55}A${r * 0.8} ${r * 0.8} 0 0 1 ${cx + r * 0.25} ${cy - r}z" fill="url(#g-moon)"/>
  </g>`;

const cloud = (fill = 'url(#g-cloud)', tx = 0, ty = 0, s = 1, cls = 'i-cloud') =>
  `<g class="${cls}"><path d="${CLOUD}" fill="${fill}" transform="translate(${tx} ${ty}) scale(${s})"/></g>`;

const drops = (n: number, heavy = false) => {
  const xs = n === 2 ? [26, 38] : n === 3 ? [22, 32, 42] : [20, 28, 36, 44];
  return `<g class="i-drops" stroke="#6fb8ff" stroke-width="${heavy ? 3 : 2.6}" stroke-linecap="round">${xs
    .map((x, i) => `<line class="i-drop" style="animation-delay:${(i * 0.27).toFixed(2)}s" x1="${x}" y1="${52 + (i % 2) * 3}" x2="${x - 2.5}" y2="${58 + (i % 2) * 3}"/>`)
    .join('')}</g>`;
};

const flakes = (n: number) => {
  const xs = n === 2 ? [26, 38] : n === 3 ? [22, 32, 42] : [20, 28, 36, 44];
  return `<g class="i-flakes" fill="#eaf4ff">${xs
    .map((x, i) => `<circle class="i-flake" style="animation-delay:${(i * 0.4).toFixed(2)}s" cx="${x}" cy="${54 + (i % 2) * 4}" r="2.4"/>`)
    .join('')}</g>`;
};

const bolt = `<path class="i-bolt" d="M34 44l-7 11h6l-3 8 9-12h-6l4-7z" fill="url(#g-bolt)"/>`;

const fogLines = `<g class="i-fog" stroke="#dbe4f0" stroke-width="3" stroke-linecap="round" opacity=".9">
  <line x1="12" y1="52" x2="44" y2="52"/><line x1="20" y1="58" x2="52" y2="58"/></g>`;

export function icon(kind: IconKind, night = false, size = 40, label = ''): string {
  let body = '';
  const celestial = (x: number, y: number, r: number, rays = true) => (night ? moon(x, y, r) : sun(x, y, r, rays));
  switch (kind) {
    case 'clear': body = night ? moon(32, 32, 16) : sun(32, 32, 13); break;
    case 'mostly-clear': body = celestial(28, 26, night ? 13 : 11) + cloud('url(#g-cloud)', 18, 24, 0.65); break;
    case 'partly': body = celestial(24, 22, night ? 12 : 10, true) + cloud('url(#g-cloud)', 6, 8, 0.9); break;
    case 'cloudy': body = cloud('url(#g-cloud-back)', 14, -4, 0.75, 'i-cloud i-cloud-b') + cloud('url(#g-cloud)', 0, 4, 1); break;
    case 'fog': body = cloud('url(#g-cloud-back)', 2, -6, 0.95) + fogLines; break;
    case 'drizzle': body = cloud('url(#g-cloud)', 0, -6, 1) + drops(3); break;
    case 'rain': body = cloud('url(#g-cloud-back)', 0, -6, 1) + drops(3, true); break;
    case 'heavy-rain': body = cloud('url(#g-cloud-dark)', 0, -6, 1) + drops(4, true); break;
    case 'sleet': body = cloud('url(#g-cloud-back)', 0, -6, 1) + `<g>${drops(2)}</g>` + `<g transform="translate(6 0)">${flakes(2)}</g>`; break;
    case 'snow': body = cloud('url(#g-cloud)', 0, -6, 1) + flakes(3); break;
    case 'heavy-snow': body = cloud('url(#g-cloud-back)', 0, -6, 1) + flakes(4); break;
    case 'thunder': body = cloud('url(#g-cloud-dark)', 0, -8, 1) + bolt; break;
    case 'hail': body = cloud('url(#g-cloud-dark)', 0, -8, 1) + bolt + flakes(2); break;
  }
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="wx-icon wx-${kind}" viewBox="0 0 64 64" width="${size}" height="${size}" ${aria}>${body}</svg>`;
}

// Small UI glyphs (stroke icons)
const g = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const UI = {
  search: g('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  locate: g('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>'),
  star: g('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  starFill: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`,
  settings: g('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  close: g('<path d="M6 6l12 12M18 6 6 18"/>'),
  pin: g('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>'),
  eye: g('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: g('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  grip: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  chevronDown: g('<path d="m6 9 6 6 6-6"/>'),
  layout: g('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  share: g('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12M7 8l5-5 5 5"/>'),
  pinDot: g('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  drop: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2.5s-6.5 7.3-6.5 12a6.5 6.5 0 0 0 13 0c0-4.7-6.5-12-6.5-12z"/></svg>`,
  plus: g('<path d="M12 5v14M5 12h14"/>'),
  dice: g('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>'),
  reset: g('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
};
