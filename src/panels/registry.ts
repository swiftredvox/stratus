import type { PanelDef } from './types';
import { hourly } from './hourly';
import { daily } from './daily';
import {
  nexthour, windPanel, sunPanel, uvPanel, airPanel, feelsPanel, humidityPanel, pressurePanel, visibilityPanel, moonPanel, pollenPanel, precipPanel,
} from './tiles';

export const PANELS: Record<string, PanelDef> = Object.fromEntries(
  [nexthour, hourly, daily, windPanel, sunPanel, uvPanel, airPanel, feelsPanel, humidityPanel, pressurePanel, visibilityPanel, moonPanel, pollenPanel, precipPanel]
    .map((p) => [p.id, p]),
);
