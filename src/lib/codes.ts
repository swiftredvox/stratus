// WMO weather interpretation codes → labels, icon kinds, and sky parameters.

export type IconKind =
  | 'clear' | 'mostly-clear' | 'partly' | 'cloudy' | 'fog'
  | 'drizzle' | 'rain' | 'heavy-rain' | 'sleet' | 'snow' | 'heavy-snow' | 'thunder' | 'hail';

interface CodeInfo { label: string; icon: IconKind }

const TABLE: Record<number, CodeInfo> = {
  0: { label: 'Clear', icon: 'clear' },
  1: { label: 'Mostly clear', icon: 'mostly-clear' },
  2: { label: 'Partly cloudy', icon: 'partly' },
  3: { label: 'Overcast', icon: 'cloudy' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Freezing fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  55: { label: 'Heavy drizzle', icon: 'drizzle' },
  56: { label: 'Freezing drizzle', icon: 'sleet' },
  57: { label: 'Freezing drizzle', icon: 'sleet' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'heavy-rain' },
  66: { label: 'Freezing rain', icon: 'sleet' },
  67: { label: 'Heavy freezing rain', icon: 'sleet' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'heavy-snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Light showers', icon: 'rain' },
  81: { label: 'Showers', icon: 'rain' },
  82: { label: 'Heavy showers', icon: 'heavy-rain' },
  85: { label: 'Snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'heavy-snow' },
  95: { label: 'Thunderstorm', icon: 'thunder' },
  96: { label: 'Thunderstorm with hail', icon: 'hail' },
  99: { label: 'Severe thunderstorm', icon: 'hail' },
};

export const codeInfo = (code: number): CodeInfo => TABLE[code] ?? { label: 'Unknown', icon: 'cloudy' };

export type PrecipType = 'none' | 'rain' | 'snow' | 'sleet';

export interface SkyWeather {
  cloud: number;      // 0..1 coverage
  dark: number;       // 0..1 storminess of cloud base
  precip: PrecipType;
  intensity: number;  // 0..1
  fog: number;        // 0..1
  thunder: boolean;
}

export function skyWeather(code: number, cloudPct: number, visibility = 20000): SkyWeather {
  const cloud = Math.min(1, Math.max(0, cloudPct / 100));
  const w: SkyWeather = { cloud, dark: 0, precip: 'none', intensity: 0, fog: 0, thunder: false };
  const fogFromVis = visibility < 5000 ? Math.min(1, (5000 - visibility) / 4500) : 0;
  w.fog = fogFromVis * 0.8;
  if (code === 45 || code === 48) { w.fog = Math.max(w.fog, 0.85); w.cloud = Math.max(cloud, 0.5); }
  const set = (p: PrecipType, i: number, dark: number) => {
    w.precip = p; w.intensity = i; w.dark = dark; w.cloud = Math.max(w.cloud, 0.75);
  };
  switch (code) {
    case 51: set('rain', 0.15, 0.25); break;
    case 53: set('rain', 0.25, 0.3); break;
    case 55: set('rain', 0.35, 0.35); break;
    case 56: case 57: set('sleet', 0.3, 0.35); break;
    case 61: case 80: set('rain', 0.4, 0.4); break;
    case 63: case 81: set('rain', 0.65, 0.55); break;
    case 65: case 82: set('rain', 1, 0.7); break;
    case 66: case 67: set('sleet', 0.6, 0.5); break;
    case 71: case 77: case 85: set('snow', 0.35, 0.25); break;
    case 73: set('snow', 0.6, 0.3); break;
    case 75: case 86: set('snow', 1, 0.4); break;
    case 95: set('rain', 0.85, 0.85); w.thunder = true; break;
    case 96: case 99: set('rain', 1, 0.95); w.thunder = true; break;
    case 3: w.dark = Math.max(w.dark, 0.15); break;
  }
  return w;
}

export const isWet = (code: number) => code >= 51 && code !== 77 && !(code >= 71 && code <= 75) && code !== 85 && code !== 86;
export const isSnowy = (code: number) => (code >= 71 && code <= 77) || code === 85 || code === 86;
