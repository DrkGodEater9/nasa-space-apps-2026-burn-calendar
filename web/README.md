# Colombia Burn Calendar — web app

Static web app for the NASA Space Apps 2026 challenge "Harmonization of MODIS and VIIRS Hot Spots" (team Horum Labs). It reads the files exported by the data pipeline (`data/processed/web/` and the DANE GeoJSON) and shows, for any municipality, department or drawn area of Colombia:

- **Activity calendar**: one square per day of hot spots (accepted detections), with no-data days striped, NOAA-20 fill days marked, and unusual or extreme 7-day levels outlined. For the departments that passed the harmonization test it is **one calendar from 2003**: the days before the VIIRS reference (2012-01-20) are MODIS rescaled to VIIRS units with a factor per month, always hatched and labeled as estimates, with the test error of that month. Departments that failed the test, municipalities and drawn areas start in 2012, because the rule did not pass or was not tested there. It can also be colored by anomaly level, or switched to raw MODIS (2003+) or the informational NOAA-21 layer.
- **National totals since 2003**: hot spots per year on the home view, with 2003-2011 estimated from MODIS.
- **Area selection**: search by name, click on the map, draw a polygon or a box, or type a lat/lon point or a bounding box. Drawn shapes use the municipalities with at least 25% of their area inside (METHOD.md), and the list with the coverage of each one is always shown.
- **History**: the month against the median of the same month in other years ("2.3× normal" and its percentile), a year × month seasonality matrix, the busiest years and months, and the list of unusual episodes.
- **Data coverage**: no-data days, NOAA-20 fill days, municipalities with insufficient history (department fallback), and the fixed notice.
- **Day inspector**: the selected day with NASA GIBS true-color imagery under the map, plus links to NASA Worldview and FIRMS to see the individual detections.
- **CSV downloads** of the query (the individual hot spot points of the search with date, time, latitude, longitude, sensor, confidence and FRP; the daily series; by municipality; monthly vs. history) and **shareable links** (the whole view is in the URL).

## Run

```bash
cd web
npm install
npm run dev       # copies ../data/processed into public/data, then starts Vite
npm run build     # type check + production build in web/dist
npm run verify    # checks the web aggregation, the harmonized calendar and the points against the pipeline's tables
npm run a11y      # accessibility checks of the color scales (see ../docs/ACCESSIBILITY.md)
```

`npm run sync-data` (run automatically before `dev` and `build`) copies the data from `../data/processed`; `public/data/` is not committed. To refresh the data, rebuild it with the Python scripts (see the main README) and run the web build again.

## Deploy

`.github/workflows/deploy-web.yml` builds and publishes the site on GitHub Pages on every push to `main` (enable Pages with source "GitHub Actions" once). The build uses a relative base path, so `web/dist` can also be dropped on Netlify, Vercel or any static host.

## Structure

- `src/lib/` — data loading (`data.ts`), series and statistics (`analysis.ts`), polygon selection (`geo.ts`), CSV export (`csv-exporter.ts`), NASA imagery links (`imagery.ts`), colors, dates.
- `src/components/` — `MapView`, `ActivityCalendar`, `Charts`, `AreaPicker`, `DayInspector`, `NationalOverview`, `Panels`.
- `src/pages/` — Explore, Method and Data & credits.

## External code and services

React, Vite, TypeScript, MapLibre GL JS, Turf.js and Fontsource fonts (Inter, Space Grotesk, JetBrains Mono); CARTO Dark Matter basemap (© OpenStreetMap contributors, © CARTO); NASA GIBS imagery. These must be listed in the root `REFERENCES.md`.

*AI note: this web app was written with the help of an AI assistant (Claude Code), implementing the method decided by the Horum Labs team in `docs/METHOD.md`. Every source file carries a note in its header.*
