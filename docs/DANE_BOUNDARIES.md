# DANE MGN 2018 boundaries

Source: DANE, *Marco Geoestadístico Nacional (MGN) integrado con CNPV 2018*, department and municipality-area shapefiles. The downloaded DIVIPOLA spreadsheet is dated March 2022, so its names and codes are kept as a separate reference rather than silently mixed into the 2018 spatial layer. See [REFERENCIAS.md](../REFERENCIAS.md).

| Source layer | Features | Source CRS | Web GeoJSON | Simplification |
|---|---:|---|---|---:|
| `MGN_ANM_DPTOS.shp` | 33 departments | EPSG:4686 (MAGNA-SIRGAS) | `data/processed/dane_mgn2018_departamentos.geojson`, EPSG:4326 | 300 m |
| `MGN_ANM_MPIOS.shp` | 1,122 municipality-level areas | EPSG:4686 (MAGNA-SIRGAS) | `data/processed/dane_mgn2018_municipios.geojson`, EPSG:4326 | 300 m |

The 1,122 features are the **municipality-level MGN areas**, including non-municipalized areas; do not label them as 1,122 legal municipalities. The two GeoJSONs retain the source `VERSION=2018`. All 33 and 1,122 input geometries were valid. The processing script checks counts, codes, encoding, and geometries before writing files.

## Key columns for Datos and Web

| Output column | Meaning | Source |
|---|---|---|
| `DPTO_CCDGO` | Two-character department code, including leading zero | Both shapefiles |
| `DPTO_CNMBR` | Department name | Department shapefile; joined into municipality GeoJSON by `DPTO_CCDGO` |
| `MPIO_CCDGO` | Three-character code *within* a department; not globally unique | Municipality shapefile |
| `MPIO_CDPMP` | Five-character nationwide municipality-area code; use as the municipal selector key | Municipality shapefile |
| `MPIO_CNMBR` | Municipality-area name | Municipality shapefile |
| `VERSION` | MGN source version (`2018`) | Both shapefiles |

Keep all codes as **strings** so leading zeros survive. `MPIO_CDPMP = DPTO_CCDGO + MPIO_CCDGO`. Select a department with `DPTO_CCDGO`, or a municipality-level area with `MPIO_CDPMP`. Names are display values, not keys.

The full source schema was read from the shapefiles. Both layers share `DPTO_CCDGO`, `VERSION`, `AREA`, `LATITUD`, `LONGITUD`, `STCTNENCUE`, `STP3_1_SI`, `STP3_2_NO`, `STP3A_RI`, `STP3B_TCN`, `STP4_1_SI`, `STP4_2_NO`, `STP9_1_USO`, `STP9_2_USO`, `STP9_3_USO`, `STP9_4_USO`, `STP9_2_1_M`, `STP9_2_2_M`, `STP9_2_3_M`, `STP9_2_4_M`, `STP9_2_9_M`, `STP9_3_1_N`, `STP9_3_2_N`, `STP9_3_3_N`, `STP9_3_4_N`, `STP9_3_5_N`, `STP9_3_6_N`, `STP9_3_7_N`, `STP9_3_8_N`, `STP9_3_9_N`, `STP9_3_10`, `STP9_3_99`, `STVIVIENDA`, `STP14_1_TI`, `STP14_2_TI`, `STP14_3_TI`, `STP14_4_TI`, `STP14_5_TI`, `STP14_6_TI`, `STP15_1_OC`, `STP15_2_OC`, `STP15_3_OC`, `STP15_4_OC`, `TSP16_HOG`, `STP19_EC_1`, `STP19_ES_2`, `STP19_EE_1`, `STP19_EE_2`, `STP19_EE_3`, `STP19_EE_4`, `STP19_EE_5`, `STP19_EE_6`, `STP19_EE_9`, `STP19_ACU1`, `STP19_ACU2`, `STP19_ALC1`, `STP19_ALC2`, `STP19_GAS1`, `STP19_GAS2`, `STP19_GAS9`, `STP19_REC1`, `STP19_REC2`, `STP19_INT1`, `STP19_INT2`, `STP19_INT9`, `STP27_PERS`, `STPERSON_L`, `STPERSON_S`, `STP32_1_SE`, `STP32_2_SE`, `STP34_1_ED`, `STP34_2_ED`, `STP34_3_ED`, `STP34_4_ED`, `STP34_5_ED`, `STP34_6_ED`, `STP34_7_ED`, `STP34_8_ED`, `STP34_9_ED`, `STP51_PRIM`, `STP51_SECU`, `STP51_SUPE`, `STP51_POST`, `STP51_13_E`, `STP51_99_E`, `Shape_Leng`, `Shape_Area`, and `geometry`. The department layer adds `DPTO_CNMBR`; the municipality layer adds `MPIO_CCDGO`, `MPIO_CNMBR`, and `MPIO_CDPMP`. The script prints the exact source column lists on each run.

## Rebuild and use

Extract the three DANE archives under `data/raw/dane/{depto,mpio,divipola}`. With `geopandas` installed, run `python scripts/process_dane_boundaries.py` from the repository root. The script reads the original EPSG:4686 shapes, simplifies them in metre-based EPSG:3116, then transforms to EPSG:4326 for the web and FIRMS coordinates. It explicitly decodes the DBF names as `utf-8-sig`; the default decoding damaged accented names in these files.

The GeoJSON shapes are simplified for fast map display and approximate point filtering. For exact boundary decisions near an edge, use the raw shapefiles locally. `data/raw/` is ignored by Git; only the two compact processed GeoJSONs belong in the repository.

AI use: Codex assisted with the processing script and this documentation. Claude did not write this DANE script. The existing `scripts/download_firms.py` declares Claude assistance separately.
