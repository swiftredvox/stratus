// Open-Meteo Air Quality: AQI, pollutants and (Europe, in season) pollen.
import { parseLocal } from './weather';

export interface AirQuality {
  euAqi: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  pollen: { id: string; label: string; value: number }[] | null;
  /** Next 24h of the European AQI, hourly. */
  euTrend: { time: number; value: number }[];
}

const POLLEN: [string, string][] = [
  ['grass_pollen', 'Grass'],
  ['birch_pollen', 'Birch'],
  ['alder_pollen', 'Alder'],
  ['mugwort_pollen', 'Mugwort'],
  ['olive_pollen', 'Olive'],
  ['ragweed_pollen', 'Ragweed'],
];

export async function fetchAir(lat: number, lon: number, signal?: AbortSignal): Promise<AirQuality> {
  const current = ['european_aqi', 'us_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', ...POLLEN.map((p) => p[0])];
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: current.join(','),
    hourly: 'european_aqi',
    forecast_days: '2',
    timezone: 'auto',
  });
  const r = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?' + params, { signal });
  if (!r.ok) throw new Error(`Air quality request failed (${r.status})`);
  const j = await r.json();
  const c = j.current ?? {};
  const pollen = POLLEN.filter(([k]) => c[k] != null).map(([k, label]) => ({ id: k, label, value: c[k] as number }));
  const nowL = Date.now() + (j.utc_offset_seconds ?? 0) * 1000;
  const trend: { time: number; value: number }[] = [];
  const ht: string[] = j.hourly?.time ?? [];
  ht.forEach((t, i) => {
    const time = parseLocal(t);
    const v = j.hourly.european_aqi[i];
    if (v != null && time >= nowL - 3600e3 && trend.length < 25) trend.push({ time, value: v });
  });
  return {
    euAqi: c.european_aqi ?? null,
    usAqi: c.us_aqi ?? null,
    pm25: c.pm2_5 ?? null,
    pm10: c.pm10 ?? null,
    no2: c.nitrogen_dioxide ?? null,
    o3: c.ozone ?? null,
    pollen: pollen.length ? pollen : null,
    euTrend: trend,
  };
}
