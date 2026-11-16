# Colombia Burn Calendar

**NASA Space Apps Challenge 2026 · Harmonization of MODIS and VIIRS Hot Spots · Team Horum Labs (NASA Space Apps Ipiales local event)**

A web app that shows when and where Colombia burns, on one harmonized calendar of satellite hot spots from January 1, 2003 to November 13, 2026 (the current data snapshot). Pick a department, a municipality or draw an area, choose the dates, and see the daily activity, how it compares with the history of that place, and download the data.

## The problem, and how this answers it

Fire in Colombia follows the seasons: every year the dry months bring burning to the eastern plains and to the edge of the Amazon. To tell an ordinary dry season from an unusual one, you need a long and consistent record. That record exists in two pieces that do not fit together. MODIS has observed fires since the early 2000s but is near the end of its life. VIIRS continues the record with finer detail, and for the same fires it reports about four times more hot spots. Put side by side, the two would show a jump in 2012 that is caused by the instrument, not by fire.

The challenge asks to harmonize them, so that the sensor of origin no longer matters and patterns, trends and anomalies become the focus, and to put the result in a web app where a user picks a region and dates.

This project does that in two steps:

1. **It converts the MODIS years into VIIRS-equivalent units and measures how well that works.** The conversion was tested before it was used. The app shows the converted years for every area from 2003, and says clearly, area by area, how far the estimate was tested: where the test failed, could not be run, or was not done at that scale (municipalities and drawn areas), the app shows a warning next to the data.
2. **It turns the harmonized record into answers a person can use:** which months burn most in a place, which years were worst, whether this week or this month is unusual for that place and season, and the hot spots themselves as a file to download.

It is meant for anyone who needs to read fire activity without processing satellite files themselves. We chose to show the limits of the data next to the data, because a calendar that looks more certain than it is would mislead the people it is meant to help.

## What it does

- **One calendar from January 1, 2003 to November 13, 2026.** From 2012 the values are what VIIRS observed. For 2003-2011, MODIS is converted to VIIRS-equivalent units with one factor per calendar month, adjusted to each department. Those days are estimates and are always hatched and labeled as such.
- **Region and dates chosen by the user:** search by name, click the map, draw a polygon or a box, or type coordinates.
- **Number of hot spots detected** per day, with the 7-day total and the yearly totals.
- **Historical comparison and anomalies:** each day is compared with the same season in the other years (percentiles 75, 90 and 97.5), and each month with the median of the same month in every other year since 2003 (2003-2011 estimated from MODIS). The current month is compared with the same days of that month in those years. We use the median, not the average, so one extreme year does not hide unusual activity.
- **Downloadable CSV:** the individual hot spot points of the search (date, time, latitude, longitude, sensor, confidence, fire radiative power), the daily series, and the monthly comparison.
- **Downloadable images:** the calendar and the charts as PNG, with the area, the dates, the legend and the data source.
- **Accessible color scales,** tested with color vision deficiency simulations and WCAG contrast.

Coverage is **Colombia only**: 33 departments and 1,122 municipality-level areas.

## Why harmonization is needed, and how we did it

MODIS has more than two decades of fire data but is near the end of its life, and VIIRS replaces it. The two records cannot be compared directly: VIIRS has a pixel about seven times smaller, so it reports about four times more hot spots for the same fires.

Our method, in short:

1. **Quality filters.** Low-confidence detections are dropped, along with volcanoes, gas flares and other static sources.
2. **Local time.** Every detection is moved to Colombian time (UTC-5) before it is assigned to a day.
3. **One reference sensor.** VIIRS S-NPP since 2012. NOAA-20 fills the days S-NPP has no data. Satellites are never summed on the same day.
4. **MODIS rescaled to VIIRS units.** One factor per calendar month, from the years when both sensors overlap (2013-2025), adjusted to the VIIRS/MODIS level of each department.
5. **Tested before it was used.** Leaving one year out at a time, with the error margins written down before the test ran.

**What the test showed.** The national monthly total is predicted with a median error of 6.9% (margin 15%). At department scale, with each department's own level, 16 of 33 departments are within the 30% margin, 1 is shown as low confidence, 12 are not, and 4 have too few detections to evaluate (with the national factor alone it was 14, 1, 14 and 4; the department level was written down before it was tested). The departments that passed hold about 78% of the VIIRS hot spots of 2013-2025. **Every area still shows the calendar from 2003**, because that is what the challenge asks: the departments that failed or have too few detections, and every municipality and drawn area (which use the factor of their department and were never tested at that scale), carry a visible low-confidence warning.

**Limits we want you to know.** The MODIS era is an estimate: that the 2013-2025 factor also held in 2003-2011 cannot be verified, because VIIRS did not exist then. 2000-2002 are excluded, because only one MODIS satellite was flying. A hot spot is a thermal anomaly seen by a satellite, not a confirmed fire, and clouds can hide fires.

Full detail: [docs/METHOD.md](docs/METHOD.md) and [docs/HARMONIZATION.md](docs/HARMONIZATION.md).

## Validation

We reproduced the hot spot totals that IDEAM, Colombia's environmental agency, publishes in its semester reports. Our counts differ from IDEAM's national totals by 0.4% to 1.1%, and 39 of 40 department values are within 10%. This checks our reading of the NASA files, our filters and the boundaries. It does not validate the harmonized series, which is tested separately as described above. See [docs/VALIDATION.md](docs/VALIDATION.md).

## Run it

**Web app** (needs Node.js 24 or later: `npm run verify` and `npm run a11y` run TypeScript files directly with Node):

```bash
cd web
npm install
npm run dev        # copies the data and starts the app at http://localhost:5173
npm run build      # production build in web/dist
npm run verify     # checks the web numbers against the data pipeline
npm run a11y       # accessibility checks of the colors
```

**Data pipeline** (needs Python 3.11 or later). The processed data is already in the repository, so this is only needed to rebuild it:

```bash
pip install -r requirements.txt
python scripts/build_dataset.py      # builds every table from data/raw
python scripts/export_web_json.py    # writes the files the web app reads
python scripts/check_dataset.py      # integrity checks
python scripts/harmonization_test.py # the leave-one-year-out test
python scripts/validate_ideam.py     # comparison with IDEAM
```

To rebuild from scratch you need the raw NASA FIRMS files in `data/raw/archive/`. They are not in the repository because of their size. Request them on the FIRMS Archive Download page for the area west -79.5, south -4.5, east -66.5, north 12.8, all four sensors, CSV format. The newest days come from the FIRMS API with `scripts/download_firms.py`, which reads the MAP_KEY from the `FIRMS_MAP_KEY` environment variable.

## Repository layout

| Path | Content |
|---|---|
| `web/` | The web app (React, TypeScript, MapLibre). See [web/README.md](web/README.md) |
| `scripts/` | The data pipeline, the tests and the validation |
| `data/processed/` | The tables and the files the web app reads. Described in [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) |
| `data/sample/` | A small sample for one department (Nariño) |
| `docs/` | Method, test plan and results, validation, accessibility, data contract |
| `notebooks/` | The first exploration of the raw data |

## Data sources and references

Every external source, library and service is listed in [REFERENCES.md](REFERENCES.md). The main ones:

- **NASA FIRMS:** active fire detections from MODIS (Collection 6.1) and VIIRS 375 m (S-NPP, NOAA-20, NOAA-21). <https://firms.modaps.eosdis.nasa.gov/>
- **NASA GIBS:** the daily true-color imagery shown under the map.
- **DANE:** the 2018 department and municipality boundaries (Marco Geoestadístico Nacional).
- **IDEAM:** the semester hot spot reports of 2023 and 2024, used only for validation.
- **Basemap:** CARTO Dark Matter, with data from OpenStreetMap contributors.

We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Goddard Space Flight Center Earth Science Data and Information System (ESDIS) with funding provided by NASA Headquarters.

## Use of AI

We used AI assistants to build this project, and we want to be exact about how.

**What the team did**

- **We chose how to harmonize the two sensors.** The method is ours: the quality filters, the reference sensor, the seasonal baseline, the alert levels, and the rule that converts MODIS to VIIRS units with one factor per month adjusted to each department.
- **We obtained the data.** We requested the historical archive from NASA FIRMS, got the API key, and downloaded the official boundaries from DANE and the reports from IDEAM.
- **We set the test and its margins** (15% national, 30% per department) before any result was known.
- **We made the decisions after the results:** which quantity to count, and what to show where the test did not pass.
- **We reviewed** what the AI produced and asked for corrections.

**What the AI did**

- **It wrote the code that carries out those decisions, almost all of it.** Claude Code (Anthropic) wrote the scripts that download, filter and aggregate the data, apply the harmonization rule, run the test and export the files, and it wrote the web application. Codex wrote the script that processes the DANE boundaries. Every AI-assisted file carries a note in its header.
- **Claude Desktop (Anthropic)** searched for sources on the Meta-Caquetá boundary difference and computed descriptive tables from the project data.
- **Claude Code also produced the demo video.** It wrote the English narration script, recorded the real web app in a browser, and edited and captioned the footage with FFmpeg. The video shows the real app, not mocked-up screens.
- **The demo video narration was generated with ElevenLabs** from that script, using the voice of one of our team members, so it is their own voice and no third-party voice is used. The video says on screen that the narration is AI-generated.
- **No AI-generated images are used.** The site has no logo: its mark is a simple flame line icon, the same one used across the interface.
- **It wrote the documentation** from our decisions, and translated our planning documents from Spanish to English.
- **It ran the analysis we asked for:** the exploration of the raw data, the harmonization test, the comparison with IDEAM and the accessibility checks.
- **It helped us find what we had not considered.** When we described what we wanted, the AI pointed out gaps and open questions: details our method did not define, cases the data would hit, and places where a number could mislead (for example, comparing a half-finished month with whole months). It raised the points; we decided each one.
- **It checked the whole project at the end.** As a final sweep, we used the AI to verify the integrity of the project: that the data tables add up, that the web app shows the same numbers as the data pipeline, that the documents match the code, and that the references and the AI notes are complete. The checks are scripts in this repository and can be rerun.
- **It read reference material for us:** it extracted the IDEAM figures from the official PDF reports, including values read from chart images, and searched for sources on a boundary difference between two departments. Those findings are marked as not re-checked by us.

**Implementation details.** A few details were not fixed in our text, such as the exact confidence cutoffs and what counts as a day without data. They were set during implementation, and a team member reviewed and confirmed each one. They are marked "(confirmed default)" in [docs/METHOD.md](docs/METHOD.md).

No figure in this project was invented or estimated by the AI. Numbers come from the NASA files, from the official reports, or from tests that can be rerun with the scripts in this repository. No NASA logos are used.

The full record is in [REFERENCES.md](REFERENCES.md), section "AI use".

## Team

**Horum Labs**, NASA Space Apps Challenge 2026, Ipiales local event.

- Alexander Morales Ujueta
- Tomas Gutierrez Muñoz
- Jhoe Luis Jean Paul Miranda Alvarez
