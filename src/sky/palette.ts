// Sky colours keyed by solar elevation (degrees).
type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

const ELEV = [-18, -10, -5, -1, 3, 8, 20, 50];
const ZENITH = ['#03060f', '#081029', '#151d4a', '#2b3a74', '#3a5da2', '#3b74c4', '#2f6dcf', '#2560c8'].map(hex);
const HORIZON = ['#0b1226', '#181b3b', '#4d3a68', '#e07d5a', '#ffae78', '#f4d2aa', '#bcdcf4', '#a5cff3'].map(hex);
const SUN = ['#ff5a2a', '#ff5a2a', '#ff6a3a', '#ff7a40', '#ffab68', '#ffd9a8', '#fff2dc', '#fffaf0'].map(hex);
const CLOUD_LIT = ['#1b2236', '#202842', '#4a4266', '#e49a84', '#ffc9a0', '#fbe8d6', '#ffffff', '#ffffff'].map(hex);
const CLOUD_SHADE = ['#06080f', '#0a0e1c', '#231f3a', '#6a4f68', '#8a7f92', '#9aa3b5', '#a7b2c4', '#aeb9ca'].map(hex);

function sample(table: RGB[], e: number): RGB {
  if (e <= ELEV[0]) return table[0];
  for (let i = 1; i < ELEV.length; i++) {
    if (e <= ELEV[i]) {
      const t = (e - ELEV[i - 1]) / (ELEV[i] - ELEV[i - 1]);
      const s = t * t * (3 - 2 * t);
      const a = table[i - 1], b = table[i];
      return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
    }
  }
  return table[table.length - 1];
}

export interface Palette { zenith: RGB; horizon: RGB; sun: RGB; cloudLit: RGB; cloudShade: RGB; night: number }

export function palette(elev: number): Palette {
  return {
    zenith: sample(ZENITH, elev),
    horizon: sample(HORIZON, elev),
    sun: sample(SUN, elev),
    cloudLit: sample(CLOUD_LIT, elev),
    cloudShade: sample(CLOUD_SHADE, elev),
    night: Math.min(1, Math.max(0, (-elev - 2) / 10)),
  };
}

/** A bright UI accent that follows the light: moonlit lavender, golden hour, daytime blue. */
const ACC_E = [-10, -4, 1, 8, 20];
const ACC = ['#aab4ff', '#d6a6ff', '#ffb58a', '#ffd9a0', '#bfe0ff'].map(hex);
export function accentFor(elev: number): string {
  let c = ACC[0];
  if (elev >= ACC_E[ACC_E.length - 1]) c = ACC[ACC.length - 1];
  else for (let i = 1; i < ACC_E.length; i++) {
    if (elev <= ACC_E[i]) {
      const t = Math.max(0, (elev - ACC_E[i - 1]) / (ACC_E[i] - ACC_E[i - 1]));
      c = ACC[i - 1].map((v, k) => v + (ACC[i][k] - v) * t) as RGB;
      break;
    }
  }
  return `rgb(${c.map((v) => Math.round(v * 255)).join(', ')})`;
}
