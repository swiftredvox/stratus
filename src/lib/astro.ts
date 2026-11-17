// Sun position (NOAA approximation) and moon phase.

const RAD = Math.PI / 180;

/** Solar elevation and azimuth (degrees, azimuth clockwise from north) for a UTC time. */
export function sunPosition(utcMs: number, lat: number, lon: number): { elevation: number; azimuth: number } {
  const d = new Date(utcMs);
  const jd = utcMs / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 / RAD *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD));
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  let tst = (minutes + eqTime + 4 * lon) % 1440;
  if (tst < 0) tst += 1440;
  let ha = tst / 4 - 180;
  if (ha < -180) ha += 360;
  const latR = lat * RAD;
  const cosZen = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha * RAD);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  const elevation = 90 - zen / RAD;
  let az = Math.acos(
    Math.min(1, Math.max(-1, (Math.sin(latR) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(latR) * Math.sin(zen) || 1e-9))),
  ) / RAD;
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
  return { elevation, azimuth: az };
}

const J2000 = Date.UTC(2000, 0, 1, 12);

/** Moon phase 0..1 (0 new, 0.5 full). Includes the main periodic corrections (~±2h accuracy for events). */
export function moonPhase(utcMs: number): number {
  const days = (utcMs - J2000) / 86400000;
  // Mean phase plus correction from the moon's and sun's mean anomalies.
  const T = days / 36525;
  const M = (357.5291 + 35999.0503 * T) * RAD;            // sun mean anomaly
  const Mm = (134.9634 + 477198.8676 * T) * RAD;          // moon mean anomaly
  const D = (297.8502 + 445267.1115 * T) * RAD;           // mean elongation
  // Elongation with leading terms (degrees)
  const elong = D / RAD + 6.289 * Math.sin(Mm) - 2.1 * Math.sin(M) + 1.274 * Math.sin(2 * D - Mm) +
    0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mm) - 0.11 * Math.sin(D);
  let p = (elong % 360) / 360;
  if (p < 0) p += 1;
  return p;
}

export const moonIllumination = (phase: number) => (1 - Math.cos(phase * 2 * Math.PI)) / 2;

export function moonPhaseName(p: number): string {
  if (p < 0.02 || p > 0.98) return 'New moon';
  if (p < 0.23) return 'Waxing crescent';
  if (p < 0.27) return 'First quarter';
  if (p < 0.48) return 'Waxing gibbous';
  if (p < 0.52) return 'Full moon';
  if (p < 0.73) return 'Waning gibbous';
  if (p < 0.77) return 'Last quarter';
  return 'Waning crescent';
}

/** Next time (UTC ms) the phase crosses `target` (0 new, 0.5 full) after `fromUtc`. */
export function nextPhase(fromUtc: number, target: number): number {
  const step = 3600e3 * 3;
  let t = fromUtc;
  const dist = (x: number) => ((x - target + 1.5) % 1) - 0.5; // signed distance in (-0.5, 0.5]
  let prev = dist(moonPhase(t));
  for (let i = 0; i < 300; i++) {
    t += step;
    const cur = dist(moonPhase(t));
    if (prev < 0 && cur >= 0) {
      // refine by bisection
      let a = t - step, b = t;
      for (let k = 0; k < 20; k++) {
        const mid = (a + b) / 2;
        if (dist(moonPhase(mid)) < 0) a = mid; else b = mid;
      }
      return b;
    }
    prev = cur;
  }
  return t;
}
