// Plain-language rain outlook used in the hero and the next-hours panel.
import type { Forecast } from '../api/weather';
import { hourIndex } from '../api/weather';
import { isSnowy } from './codes';
import { time, relDay } from './format';

const WET_15 = 0.05; // mm per 15 minutes
const WET_H = 0.1;   // mm per hour

export interface RainOutlook {
  headline: string;
  wetNow: boolean;
  chance: number;     // %
  chanceLabel: string; // "today" | "next 12h"
}

export function rainOutlook(f: Forecast, now: number): RainOutlook {
  const h = f.hourly;
  const hi = hourIndex(h, now);
  const kind = (i: number) => (isSnowy(h.code[i]) ? 'Snow' : 'Rain');

  // Chance of rain for the rest of today, or the next 12h late in the day.
  const endOfDay = Math.floor(now / 86400000) * 86400000 + 86400000;
  const hoursLeft = (endOfDay - now) / 3600e3;
  const until = hoursLeft < 5 ? now + 12 * 3600e3 : endOfDay;
  let chance = 0;
  for (let i = hi; i < h.time.length && h.time[i] < until; i++) chance = Math.max(chance, h.pop[i]);
  const chanceLabel = hoursLeft < 5 ? 'next 12h' : 'today';

  const m = f.minutely;
  let wetNow = f.current.precip > 0.05 && f.current.code >= 51;
  if (m && m.time.length) {
    let s = 0;
    while (s < m.time.length - 1 && m.time[s + 1] <= now) s++;
    const slots = m.time.slice(s).map((t, k) => ({ t, wet: m.precip[s + k] >= WET_15 }));
    if (slots.length) wetNow = wetNow || slots[0].wet;
    const word = kind(hi);
    if (wetNow) {
      const dry = slots.findIndex((x, k) => k > 0 && !x.wet && (slots[k + 1]?.wet === false || k === slots.length - 1));
      if (dry > 0) return { headline: `${word} easing around ${time(slots[dry].t)}`, wetNow, chance, chanceLabel };
    } else {
      const wet = slots.findIndex((x) => x.wet);
      if (wet > 0) {
        const mins = Math.max(5, Math.round((slots[wet].t - now) / 60000 / 5) * 5);
        return { headline: mins <= 50 ? `${kind(hourIndex(h, slots[wet].t))} starting in about ${mins} min` : `${kind(hourIndex(h, slots[wet].t))} starting around ${time(slots[wet].t)}`, wetNow, chance, chanceLabel };
      }
    }
  }

  if (wetNow) {
    let j = hi;
    while (j < h.time.length && (h.precip[j] >= WET_H || h.pop[j] >= 60) && j - hi < 24) j++;
    if (j - hi >= 24) return { headline: `${kind(hi)} continuing for the next day`, wetNow, chance, chanceLabel };
    return { headline: `${kind(hi)} easing around ${time(h.time[j])}`, wetNow, chance, chanceLabel };
  }

  // Look ahead 24h
  let peak = 0;
  for (let i = hi + 1; i < Math.min(h.time.length, hi + 25); i++) {
    if (h.pop[i] >= 50 && h.precip[i] >= WET_H) {
      const day = relDay(h.time[i], now);
      const when = day === 'Today' ? `from ${time(h.time[i])}` : day === 'Tomorrow' && new Date(h.time[i]).getUTCHours() < 5 ? `overnight` : `${day.toLowerCase()} from ${time(h.time[i])}`;
      return { headline: `${kind(i)} likely ${when}`, wetNow, chance, chanceLabel };
    }
    peak = Math.max(peak, h.pop[i]);
  }
  if (peak >= 25) return { headline: `Small chance of showers in the next 24 hours`, wetNow, chance, chanceLabel };
  return { headline: 'Dry for the next 24 hours', wetNow, chance, chanceLabel };
}
