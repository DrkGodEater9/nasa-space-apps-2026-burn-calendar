# References and AI use

Everything external to this repository is listed here. Keep this file complete: it feeds the "NASA Data" and "Other References" fields of the submission.

## NASA data

- NASA FIRMS (Fire Information for Resource Management System): active fire detections ("hot spots") from the MODIS instrument (Collection 6.1) and the VIIRS 375 m instrument on S-NPP, NOAA-20 and NOAA-21. Archive Download (standard processing, up to 2026-08-31 for MODIS and 2026-07-31 for VIIRS), near-real-time files, and the FIRMS area API for the newest days. <https://firms.modaps.eosdis.nasa.gov/> (MAP_KEY: <https://firms.modaps.eosdis.nasa.gov/api/map_key/>). Used in `scripts/download_firms.py`, `scripts/build_dataset.py` and the notebooks. Raw files stay in `data/raw/` (ignored by Git). Acknowledgement: "We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Goddard Space Flight Center Earth Science Data and Information System (ESDIS) with funding provided by NASA Headquarters."
- NASA GIBS (Global Imagery Browse Services): daily VIIRS and MODIS corrected-reflectance (true-color) imagery shown under the map for the selected day in the web app, plus deep links to NASA Worldview and to the FIRMS map to see the individual detections. <https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api>. Acknowledgement: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."

## Colombian official data

- DANE, *Marco Geoestadístico Nacional (MGN) integrado con CNPV 2018*: 2018 department (`SHP_MGN2018_INTGRD_DEPTO.zip`) and municipality-area (`SHP_MGN2018_INTGRD_MPIO.zip`) boundaries, spatial version **2018**. [Official DANE download page](https://www.dane.gov.co/files/geoportal-provisional/). Reprojected from EPSG:4686 to EPSG:4326 and simplified to 300 m for the web GeoJSON files. See [DANE processing and key columns](docs/DANE_BOUNDARIES.md).
- DANE, *Codificación de la División Político Administrativa de Colombia (DIVIPOLA)*, `Listados_DIVIPOLA.zip`, list dated **March 2022**. [Official DANE download page](https://www.dane.gov.co/files/geoportal-provisional/). Kept as a reference; its names were not mixed with the MGN 2018 polygons.
- IDEAM, *Reporte semestral de incendios de la cobertura vegetal, mediante puntos de calor y eventos registrados*, four reports: first and second semester of 2023 and of 2024 (publications No. 01 to 04). Used only for validation, never as an input of the dataset. Repository page: <https://www.ideam.gov.co/sala-de-prensa/informes/Reporte-semestral-de-Incendios-de-la-Cobertura-Vegetal>. Direct files: <https://www.ideam.gov.co/file-download/download/public/20672>, `.../20673`, `.../20676`, `.../20678`. Figures and caveats: [docs/IDEAM_REFERENCE.md](docs/IDEAM_REFERENCE.md). The PDFs are kept in `data/raw/ideam/` (ignored by Git).
- IDEAM hot spot portal (<https://puntosdecalor.ideam.gov.co/>) and its metadata, DANE *Manual de uso del MGN* (versions 2.0 and 3.0), and the press and Senate sources on the Meta-Caquetá limit: consulted only to investigate one validation difference. Listed with their links in [docs/IDEAM_META_CAQUETA_BOUNDARY.md](docs/IDEAM_META_CAQUETA_BOUNDARY.md). None of them is an input of the dataset.

## Software

- [pandas](https://pandas.pydata.org/), [NumPy](https://numpy.org/), [PyArrow](https://arrow.apache.org/docs/python/), [DuckDB](https://duckdb.org/): data processing and the Parquet files.
- [GeoPandas](https://geopandas.org/), [Shapely](https://shapely.readthedocs.io/) and [pyproj](https://pyproj4.github.io/pyproj/): boundary files and the point-in-polygon assignment.
- [requests](https://requests.readthedocs.io/): FIRMS API calls.
- [Matplotlib](https://matplotlib.org/) and [Jupyter](https://jupyter.org/): the exploration notebook.
- [PyMuPDF](https://pymupdf.readthedocs.io/): reading the IDEAM PDF reports and rendering their charts (one-off extraction, not part of the pipeline).

## Web app

Source in `web/` (see `web/README.md`). Also listed on the web app's "Data & credits" page.

- **Basemap:** CARTO Dark Matter vector tiles, <https://carto.com/basemaps>. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), style © CARTO. Loaded from `basemaps.cartocdn.com`.
- **Frameworks and build:** [React](https://react.dev/) (UI), [Vite](https://vite.dev/) (build tool) and [TypeScript](https://www.typescriptlang.org/) (language).
- **Map:** [MapLibre GL JS](https://maplibre.org/).
- **Geometry in the browser:** [Turf.js](https://turfjs.org/) (`@turf/area`, `@turf/bbox`, `@turf/boolean-point-in-polygon`, `@turf/helpers`, `@turf/intersect`), used for the polygon overlap rule (at least 25% of a municipality inside the drawn area) and the point lookup.
- **Typefaces:** Inter, Space Grotesk and JetBrains Mono through [Fontsource](https://fontsource.org/).
- **NASA services used by the web app:** GIBS imagery and links to NASA Worldview and the FIRMS map (see "NASA data" above). No NASA logos or emblems are used.

## AI use

- **Claude Code (Anthropic)** assisted with the web app in `web/` (every source file carries an AI note in its header), implementing the method decided by the team.
- **Claude Desktop (Anthropic)** did the web research on IDEAM and the Meta-Caquetá boundary (`docs/IDEAM_REFERENCE.md`, `docs/IDEAM_META_CAQUETA_BOUNDARY.md`). Its findings were translated to English and have not been re-checked by the team; the press sources are not official documents.
- **Claude Code (Anthropic)** also assisted with: `scripts/download_firms.py`, `scripts/build_dataset.py`, `scripts/check_dataset.py`, `scripts/validate_ideam.py`, the exploration notebook, the data documentation (`docs/DATA_CONTRACT.md`, `docs/VALIDATION.md`, `docs/IDEAM_REFERENCE.md`), the English translation of the planning documents, and the extraction of the IDEAM figures from the PDF reports. Each script carries an AI note in its header.
- **Codex** assisted with `scripts/process_dane_boundaries.py`, its generated GeoJSON files and the DANE documentation (`docs/DANE_BOUNDARIES.md`). Claude did not write that script.
- **The harmonization method is the team's.** The choices in `docs/METHOD.md` were decided by the three team members, as the challenge rules require. The AI transcribed them, implemented them in code, and listed in `docs/METHOD.md` the defaults it had to fill in where the team text was silent. A team member reviewed and confirmed those defaults as they are.
- No IDEAM or FIRMS figure was invented or estimated. Values read from IDEAM charts are marked as such in `data/processed/ideam_semester_departments.csv`.
