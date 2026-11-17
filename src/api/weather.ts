// Open-Meteo forecast. Everything is requested in metric and converted on display,
// so unit switches are instant and need no refetch.
//
// Times: Open-Meteo returns location-local ISO strings (no offset). We parse them as
// if they were UTC, giving "location-local milliseconds". `nowLocal()` produces the
// same kind of value for the current moment, and formatting always uses timeZone UTC.

export interface Place {
  name: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
}

export interface Current {
  time: number;
  temp: number;
  feels: number;
  humidity: number;
  isDay: boolean;
  precip: number;
  code: number;
  cloud: number;
  pressure: number;
  windSpeed: number;
  windDir: number;
  windGust: number;
}

export interface Hourly {
  time: number[];
  temp: number[];
  feels: number[];
  pop: number[];
  precip: number[];
  snow: number[];
  code: number[];
  cloud: number[];
  visibility: number[];
  windSpeed: number[];
  windDir: number[];
  windGust: number[];
  uv: number[];
  isDay: number[];
  humidity: number[];
  dew: number[];
  pressure: number[];
}

export interface Daily {
  time: number[];
  code: number[];
  max: number[];
  min: number[];
  sunrise: number[];
  sunset: number[];
  daylight: number[];
  uvMax: number[];
  precipSum: number[];
  popMax: number[];
  windMax: number[];
  gustMax: number[];
  windDir: number[];
}

export interface Minutely {
  time: number[];
  precip: number[];
}

export interface Forecast {
  fetchedAt: number;
  offset: number; // seconds east of UTC
  timezone: string;
  elevation: number;
  current: Current;
  hourly: Hourly;
  daily: Daily;
  minutely: Minutely | null;
}

const HOURLY = [
  'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'snowfall',
  'weather_code', 'cloud_cover', 'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'uv_index', 'is_day', 'relative_humidity_2m', 'dew_point_2m', 'pressure_msl',
];
const DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset', 'daylight_duration',
  'uv_index_max', 'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max',
  'wind_gusts_10m_max', 'wind_direction_10m_dominant',
];
const CURRENT = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'precipitation',
  'weather_code', 'cloud_cover', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
];

export const parseLocal = (iso: string): number => Date.parse(iso.length === 10 ? iso + 'T00:00Z' : iso + 'Z');

type Raw = Record<string, any>;
const times = (a: string[]) => a.map(parseLocal);
const nums = (a: (number | null)[] | undefined, fallback = 0) => (a ?? []).map((v) => (v == null ? fallback : v));

export async function fetchForecast(lat: number, lon: number, signal?: AbortSignal): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    minutely_15: 'precipitation',
    forecast_minutely_15: '16',
    past_days: '1',
    forecast_days: '14',
    timezone: 'auto',
  });
  const r = await fetch('https://api.open-meteo.com/v1/forecast?' + params, { signal });
  if (!r.ok) throw new Error(`Forecast request failed (${r.status})`);
  const j: Raw = await r.json();
  const h = j.hourly, d = j.daily, c = j.current, m = j.minutely_15;

  return {
    fetchedAt: Date.now(),
    offset: j.utc_offset_seconds ?? 0,
    timezone: j.timezone ?? 'UTC',
    elevation: j.elevation ?? 0,
    current: {
      time: parseLocal(c.time),
      temp: c.temperature_2m,
      feels: c.apparent_temperature ?? c.temperature_2m,
      humidity: c.relative_humidity_2m,
      isDay: !!c.is_day,
      precip: c.precipitation ?? 0,
      code: c.weather_code ?? 0,
      cloud: c.cloud_cover ?? 0,
      pressure: c.pressure_msl ?? 1013,
      windSpeed: c.wind_speed_10m ?? 0,
      windDir: c.wind_direction_10m ?? 0,
      windGust: c.wind_gusts_10m ?? 0,
    },
    hourly: {
      time: times(h.time),
      temp: nums(h.temperature_2m),
      feels: nums(h.apparent_temperature),
      pop: nums(h.precipitation_probability),
      precip: nums(h.precipitation),
      snow: nums(h.snowfall),
      code: nums(h.weather_code),
      cloud: nums(h.cloud_cover),
      visibility: nums(h.visibility, 20000),
      windSpeed: nums(h.wind_speed_10m),
      windDir: nums(h.wind_direction_10m),
      windGust: nums(h.wind_gusts_10m),
      uv: nums(h.uv_index),
      isDay: nums(h.is_day),
      humidity: nums(h.relative_humidity_2m),
      dew: nums(h.dew_point_2m),
      pressure: nums(h.pressure_msl, 1013),
    },
    daily: {
      time: times(d.time),
      code: nums(d.weather_code),
      max: nums(d.temperature_2m_max),
      min: nums(d.temperature_2m_min),
      sunrise: (d.sunrise as string[]).map((s) => (s ? parseLocal(s) : NaN)),
      sunset: (d.sunset as string[]).map((s) => (s ? parseLocal(s) : NaN)),
      daylight: nums(d.daylight_duration),
      uvMax: nums(d.uv_index_max),
      precipSum: nums(d.precipitation_sum),
      popMax: nums(d.precipitation_probability_max),
      windMax: nums(d.wind_speed_10m_max),
      gustMax: nums(d.wind_gusts_10m_max),
      windDir: nums(d.wind_direction_10m_dominant),
    },
    minutely: m?.time ? { time: times(m.time), precip: nums(m.precipitation) } : null,
  };
}

/** Current moment as location-local ms (see note at top). */
export const nowLocal = (f: Pick<Forecast, 'offset'>) => Date.now() + f.offset * 1000;

/** Index of the hour containing `t` (location-local ms). */
export function hourIndex(h: Hourly, t: number): number {
  let lo = 0, hi = h.time.length - 1;
  if (t <= h.time[0]) return 0;
  if (t >= h.time[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (h.time[mid] <= t) lo = mid; else hi = mid;
  }
  return lo;
}

/** Index of the day containing `t`. */
export function dayIndex(d: Daily, t: number): number {
  for (let i = d.time.length - 1; i >= 0; i--) if (d.time[i] <= t) return i;
  return 0;
}
