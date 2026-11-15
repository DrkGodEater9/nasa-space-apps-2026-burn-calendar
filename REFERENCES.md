# References and AI use

Everything external to this repository is listed here. Keep this file complete: it feeds the "NASA Data" and "Other References" fields of the submission.

## NASA data

- NASA FIRMS (Fire Information for Resource Management System): active fire detections ("hot spots") from the MODIS instrument (Collection 6.1) and the VIIRS 375 m instrument on S-NPP, NOAA-20 and NOAA-21. Archive Download (standard processing, up to 2026-08-31 for MODIS and 2026-07-31 for VIIRS), near-real-time files, and the FIRMS area API for the newest days. <https://firms.modaps.eosdis.nasa.gov/> (MAP_KEY: <https://firms.modaps.eosdis.nasa.gov/api/map_key/>). Used in `scripts/download_firms.py`, `scripts/build_dataset.py` and the notebooks. Raw files stay in `data/raw/` (ignored by Git). Acknowledgement: "We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Goddard Space Flight Center Earth Science Data and Information System (ESDIS) with funding provided by NASA Headquarters."
- NASA GIBS (Global Imagery Browse Services): daily VIIRS and MODIS corrected-reflectance (true-color) imagery shown under the map for the selected day in the web app, plus deep links to NASA Worldview and to the FIRMS map to see the individual detections. <https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api>. Acknowledgement: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."

## Colombian official data

- DANE, *Marco Geoestadístico Nacional (MGN) integrado con CNPV 2018*: 2018 department (`SHP_MGN2018_INTGRD_DEPTO.zip`) and municipality-area (`SHP_MGN2018_INTGRD_MPIO.zip`) boundaries, spatial version **2018**. [Official DANE download page](https://www.dane.gov.co/files/geoportal-provisional/). Reprojected from EPSG:4686 to EPSG:4326 and simplified to 300 m for the web GeoJSON files. See the boundaries section of [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).
- DANE, *Codificación de la División Político Administrativa de Colombia (DIVIPOLA)*, `Listados_DIVIPOLA.zip`, list dated **March 2022**. [Official DANE download page](https://www.dane.gov.co/files/geoportal-provisional/). Kept as a reference; its names were not mixed with the MGN 2018 polygons.
- IDEAM, *Reporte semestral de incendios de la cobertura vegetal, mediante puntos de calor y eventos registrados*, four reports: first and second semester of 2023 and of 2024 (publications No. 01 to 04). Used only for validation, never as an input of the dataset. Repository page: <https://www.ideam.gov.co/sala-de-prensa/informes/Reporte-semestral-de-Incendios-de-la-Cobertura-Vegetal>. Direct files: <https://www.ideam.gov.co/file-download/download/public/20672>, `.../20673`, `.../20676`, `.../20678`. Figures and caveats: [docs/VALIDATION.md](docs/VALIDATION.md). The PDFs are kept in `data/raw/ideam/` (ignored by Git).
- IDEAM hot spot portal (<https://puntosdecalor.ideam.gov.co/>) and its metadata, DANE *Manual de uso del MGN* (versions 2.0 and 3.0), and the press and Senate sources on the Meta-Caquetá limit: consulted only to investigate one validation difference. Listed with their links in [docs/VALIDATION.md](docs/VALIDATION.md). None of them is an input of the dataset.

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
- **Color scale:** four classes sampled from the "inferno" colormap of [Matplotlib](https://matplotlib.org/) (by Stéfan van der Walt and Nathaniel Smith, released under CC0).
- **Accessibility methods** (implemented in `web/scripts/color-metrics.ts`, results in [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)): Machado, Oliveira and Fernandes (2009), "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE Transactions on Visualization and Computer Graphics 15(6); Sharma, Wu and Dalal (2005), "The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations", Color Research and Application 30(1); and the W3C [Web Content Accessibility Guidelines 2.1](https://www.w3.org/TR/WCAG21/).
- **NASA services used by the web app:** GIBS imagery and links to NASA Worldview and the FIRMS map (see "NASA data" above). No NASA logos or emblems are used.

## AI use

The method and the harmonization rule are the team's. AI assistants were used to carry them out.

- **Code.** Claude Code (Anthropic) wrote most of the code, almost all of it: the web app in `web/`, the data scripts (`download_firms.py`, `build_dataset.py`, `export_web_json.py`, `check_dataset.py`, `harmonization_test.py`, `validate_ideam.py`, `compare_boundary_versions.py`) and the exploration notebook. Codex wrote `scripts/process_dane_boundaries.py` and the boundary files it generates. Every AI-assisted file carries a note in its header.
- **Documentation.** Claude Code wrote the documents in `docs/` and the READMEs from the team's decisions, and translated the team's Spanish texts to English.
- **Running the analysis.** Claude Code ran the harmonization test, the comparison with IDEAM and the accessibility checks. The results are the output of scripts in this repository and can be rerun.
- **Finding gaps.** When the team described what it wanted, the AI pointed out open questions and cases the data would hit. The team decided each one.
- **Reading reference material.** Claude Code extracted the IDEAM figures from the official PDF reports; places 6 to 10 of each list were read from chart images. Claude Desktop searched for sources on the Meta-Caquetá limit and computed descriptive tables from the project data. Those sources were not re-checked by the team, and the press sources are not official documents.
- **Implementation details.** A few details were not fixed in the team's text, such as the exact confidence cutoffs and what counts as a day without data. They were set during implementation, are marked "(confirmed default)" in `docs/METHOD.md`, and were reviewed and confirmed by a team member.
- **Final integrity sweep.** Claude Code was used at the end to verify the project as a whole: the data checks (`scripts/check_dataset.py`), the agreement between the web app and the pipeline (`npm run verify`), the accessibility checks (`npm run a11y`), and the consistency of the documents with the code.

No IDEAM or FIRMS figure was invented or estimated. Values read from IDEAM charts are marked as such in `data/processed/ideam_semester_departments.csv`. No NASA logos or emblems are used.
