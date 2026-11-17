// Place search: Open-Meteo geocoding for names, postcodes.io for UK postcodes,
// Zippopotam for US ZIPs and "<country> <postcode>" searches elsewhere.
import type { Place } from './weather';

const UK_FULL = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;
const UK_OUT = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
const US_ZIP = /^\d{5}(-\d{4})?$/;
const CC_FIRST = /^([A-Z]{2})[\s,-]+([A-Z0-9][A-Z0-9 -]{1,9})$/i;
const CC_LAST = /^([A-Z0-9][A-Z0-9 -]{1,9}?)[\s,]+([A-Z]{2})$/i;

async function getJSON(url: string, signal?: AbortSignal): Promise<any | null> {
  try {
    const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return null;
  }
}

export function isPostcodeLike(q: string): boolean {
  const s = q.trim();
  return UK_FULL.test(s) || US_ZIP.test(s) || (CC_FIRST.test(s) && /\d/.test(s)) || (CC_LAST.test(s) && /\d/.test(s));
}

async function ukPostcode(q: string, signal?: AbortSignal): Promise<Place[]> {
  const s = q.trim().toUpperCase();
  const full = UK_FULL.exec(s);
  if (full) {
    const j = await getJSON(`https://api.postcodes.io/postcodes/${encodeURIComponent(full[1] + ' ' + full[2])}`, signal);
    const r = j?.result;
    if (r?.latitude == null) return [];
    return [{
      name: r.postcode,
      region: [r.admin_ward, r.admin_district].filter(Boolean).join(', '),
      country: 'United Kingdom',
      countryCode: 'GB',
      lat: r.latitude,
      lon: r.longitude,
    }];
  }
  if (UK_OUT.test(s)) {
    const j = await getJSON(`https://api.postcodes.io/outcodes/${encodeURIComponent(s)}`, signal);
    const r = j?.result;
    if (r?.latitude == null) return [];
    return [{
      name: r.outcode,
      region: (r.admin_district ?? []).slice(0, 2).join(', '),
      country: 'United Kingdom',
      countryCode: 'GB',
      lat: r.latitude,
      lon: r.longitude,
    }];
  }
  return [];
}

async function zippo(cc: string, code: string, signal?: AbortSignal): Promise<Place[]> {
  const j = await getJSON(`https://api.zippopotam.us/${cc.toLowerCase()}/${encodeURIComponent(code.trim())}`, signal);
  if (!j?.places?.length) return [];
  return j.places.slice(0, 3).map((p: any) => ({
    name: `${p['place name']}`,
    region: [j['post code'], p['state abbreviation'] || p.state].filter(Boolean).join(' · '),
    country: j.country,
    countryCode: j['country abbreviation'],
    lat: parseFloat(p.latitude),
    lon: parseFloat(p.longitude),
  }));
}

async function postal(q: string, signal?: AbortSignal): Promise<Place[]> {
  const s = q.trim();
  if (UK_FULL.test(s) || UK_OUT.test(s)) return ukPostcode(s, signal);
  if (US_ZIP.test(s)) return zippo('us', s.slice(0, 5), signal);
  let m = CC_FIRST.exec(s);
  if (m && /\d/.test(m[2])) return m[1].toUpperCase() === 'GB' || m[1].toUpperCase() === 'UK' ? ukPostcode(m[2], signal) : zippo(m[1], m[2], signal);
  m = CC_LAST.exec(s);
  if (m && /\d/.test(m[1])) return zippo(m[2], m[1], signal);
  return [];
}

async function byName(q: string, signal?: AbortSignal): Promise<Place[]> {
  // Allow "Paris, FR" / "Paris, France" — search the first part, prefer matches on the rest.
  const [head, ...rest] = q.split(',').map((x) => x.trim()).filter(Boolean);
  if (!head || head.length < 2) return [];
  const j = await getJSON(
    'https://geocoding-api.open-meteo.com/v1/search?' +
      new URLSearchParams({ name: head, count: '10', language: 'en', format: 'json' }),
    signal,
  );
  let list: any[] = j?.results ?? [];
  const hint = rest.join(' ').toLowerCase();
  if (hint) {
    const score = (r: any) =>
      [r.country_code, r.country, r.admin1, r.admin2].some((x: string | undefined) => x && (x.toLowerCase() === hint || x.toLowerCase().startsWith(hint))) ? 1 : 0;
    list = [...list].sort((a, b) => score(b) - score(a));
  }
  return list.slice(0, 7).map((r) => ({
    name: r.name,
    region: r.admin1 && r.admin1 !== r.name ? r.admin1 : r.admin2,
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const s = q.trim();
  if (s.length < 2) return [];
  const [p, n] = await Promise.all([postal(s, signal), isPostcodeLike(s) && /\d/.test(s) && !UK_OUT.test(s) ? Promise.resolve([]) : byName(s, signal)]);
  return [...p, ...n];
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const j = await getJSON(
    'https://api.bigdatacloud.net/data/reverse-geocode-client?' +
      new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'en' }),
  );
  return {
    name: j?.city || j?.locality || j?.principalSubdivision || 'My location',
    region: j?.principalSubdivision && j.principalSubdivision !== (j.city || j.locality) ? j.principalSubdivision : undefined,
    country: j?.countryName,
    countryCode: j?.countryCode,
    lat,
    lon,
  };
}
