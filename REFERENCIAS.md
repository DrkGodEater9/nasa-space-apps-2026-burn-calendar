# Referencias de datos y uso de IA

- DANE, *Marco Geoestadístico Nacional (MGN) integrado con CNPV 2018*, capas de departamentos (`SHP_MGN2018_INTGRD_DEPTO.zip`) y áreas municipales (`SHP_MGN2018_INTGRD_MPIO.zip`), versión espacial **2018**. [Página oficial de descarga](https://www.dane.gov.co/files/geoportal-provisional/). Se reproyectaron de EPSG:4686 a EPSG:4326 y se simplificaron a 300 m para los GeoJSON de la web.
- DANE, *Codificación de la División Político Administrativa de Colombia (DIVIPOLA)*, `Listados_DIVIPOLA.zip`, listado fechado **marzo de 2022**. [Página oficial de descarga](https://www.dane.gov.co/files/geoportal-provisional/). Se conserva como referencia; no se mezclaron sus nombres con los polígonos MGN 2018.
- Bibliotecas usadas para procesar los límites: [GeoPandas](https://geopandas.org/), [Shapely](https://shapely.readthedocs.io/) y [pyproj](https://pyproj4.github.io/pyproj/).

Registro de IA: Codex ayudó a inspeccionar las capas, escribir `scripts/process_dane_boundaries.py`, generar los GeoJSON y redactar las notas DANE. **Claude no escribió ninguna parte de ese script.** El script preexistente `scripts/download_firms.py` indica en su encabezado que se escribió con ayuda de Claude Code. La elección del método de armonización de MODIS y VIIRS corresponde al equipo, según `PLAN.md`.
