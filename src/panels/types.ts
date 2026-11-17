import type { Forecast, Place } from '../api/weather';
import type { AirQuality } from '../api/air';

export interface Ctx {
  f: Forecast;
  air: AirQuality | null;
  place: Place;
  now: number;  // location-local ms
  hi: number;   // current hour index
  di: number;   // today's day index
  preview: (hourIndex: number | null, lock?: boolean) => void;
}

export interface Chip { label: string; value: string; tone?: string }

export interface PanelDef {
  id: string;
  title: string;
  /** grid footprint: columns (1, 2 or 'full') and rows (100px units) */
  cols: 1 | 2 | 'full';
  rows: number;
  render: (c: Ctx) => string;
  mount?: (el: HTMLElement, c: Ctx) => void;
  chip?: (c: Ctx) => Chip | null;
}
