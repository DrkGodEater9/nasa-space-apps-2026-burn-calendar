# References and AI use

- DANE, *Marco Geoestadístico Nacional (MGN) integrado con CNPV 2018*, 2018 department and municipality-area boundary shapefiles. [Official DANE download page](https://www.dane.gov.co/files/geoportal-provisional/). See [DANE processing and key columns](docs/DANE_BOUNDARIES.md).
- DANE, *Codificación de la División Político Administrativa de Colombia (DIVIPOLA)*, March 2022 list. [Official DANE download page](https://www.dane.gov.co/files/geoportal-provisional/).
- Software used to build the boundary files: [GeoPandas](https://geopandas.org/), [Shapely](https://shapely.readthedocs.io/), and [pyproj](https://pyproj4.github.io/pyproj/).

AI use: Codex assisted with `scripts/process_dane_boundaries.py`, its generated GeoJSON files, and DANE documentation. Claude did not write that script. The pre-existing `scripts/download_firms.py` records Claude Code assistance in its header. The team owns the MODIS–VIIRS harmonization choices.
