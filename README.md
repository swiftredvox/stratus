# Stratus

A weather app built around a living sky. The background is a real-time WebGL scene driven by the actual sun position and current conditions: drifting clouds, rain, snow, fog, lightning, stars and the real moon phase. Above it sits a deliberately calm first screen with the essentials, and everything else is one scroll away.

**[Open Stratus](https://swiftredvox.github.io/stratus/)**

## Features

- **At a glance:** temperature, conditions, feels-like, today's high and low, chance of rain, and a plain-language rain outlook ("Rain starting in about 20 min", "Dry for the next 24 hours")
- **Living sky:** sun and twilight colours from real solar elevation, cloud cover, precipitation, fog and wind from the forecast, and the true moon phase at night
- **Preview any hour:** hover or tap an hour (or a day) and the sky changes to show that forecast
- **Detail panels:** rain over the next 4 hours in 15-minute steps, 48-hour timeline, 14-day forecast, wind, sun, UV, air quality, feels like, humidity, pressure trend, visibility, moon, pollen and rainfall totals
- **Your layout:** drag panels into any order, hide the ones you don't need, and pin up to four to the top of the page
- **Search anywhere:** city names, UK postcodes and outcodes (`SW1A 1AA`, `M1`), US ZIP codes, and other countries' postcodes (`DE 10115`, `75001 FR`), plus your current location
- **Saved and recent places**, shareable links (`?lat=…&lon=…`), and old `?q=` / `?postal=` links still work
- **Units:** °C/°F, mph, km/h, m/s or knots, mm or inches, hPa or inHg, 24- or 12-hour clock. UK defaults, US units picked automatically for US browsers
- **Respectful:** no cookies, accounts, analytics or API keys. Settings stay in your browser

## Data sources

| What | Source |
| --- | --- |
| Forecast, air quality, pollen, place search | [Open-Meteo](https://open-meteo.com/) |
| UK postcodes | [postcodes.io](https://postcodes.io/) |
| Other postcodes | [Zippopotam.us](https://zippopotam.us/) |
| Name of your current location | [BigDataCloud](https://www.bigdatacloud.com/) (client-side reverse geocoding) |

Sun position and moon phase are calculated in the browser.

## Running locally

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`. Pushing to `main` builds and deploys it to GitHub Pages through the included workflow.

## License

[MIT](LICENSE). Please keep the data source credits in the footer.
