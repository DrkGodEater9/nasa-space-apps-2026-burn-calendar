# Data contract: Data -> Web

Everything here is produced by `python scripts/build_dataset.py` from `data/raw`, following [METHOD.md](METHOD.md). The full tables live in `data/processed/` and a small copy for one department (Nariño, code `52`) lives in `data/sample/` with the prefix `sample_` and the same columns, in Parquet and CSV.

*AI note: this document and the script were written with the help of an AI assistant (Claude Code).*

After a build, run `python scripts/check_dataset.py`. It verifies the integrity of every table (codes, sparsity, continuous dates, monthly totals against the daily series, anomaly rules, mask coverage of Galeras, and that the sample matches the full tables).

## Boundaries (DANE)

`dane_mgn2018_departamentos.geojson` (33 departments) and `dane_mgn2018_municipios.geojson` (1,122 municipality-level areas) come from the DANE *Marco Geoestadístico Nacional integrado con CNPV 2018*. The source shapefiles are in EPSG:4686; they were simplified to 300 m and transformed to EPSG:4326 by `scripts/process_dane_boundaries.py` (written with the help of Codex). All input geometries were valid.

| Column | Meaning |
|---|---|
| `DPTO_CCDGO` | Two-character department code, with leading zero |
| `DPTO_CNMBR` | Department name |
| `MPIO_CCDGO` | Three-character code inside a department (not unique in the country) |
| `MPIO_CDPMP` | Five-character municipality code: the key to use. It is `DPTO_CCDGO` + `MPIO_CCDGO` |
| `MPIO_CNMBR` | Municipality-area name |
| `VERSION` | Boundary version (`2018`) |

The 1,122 areas include non-municipalized areas, so they are not all legal municipalities. The shapes are simplified for map display; for an exact decision at an edge, use the original shapefiles. To rebuild them, extract the DANE archives under `data/raw/dane/` and run the script.

## General rules

- **Keys are strings.** `mpio_code` is the 5-character DANE code (`MPIO_CDPMP`), and `dpto_code` is the 2-character department code. Leading zeros matter. Names are display values only.
- **Dates are local Colombian dates (UTC-5)**, stored as `date` (Parquet `date32`, ISO `YYYY-MM-DD` in CSV).
- **Sparse tables.** Rows exist only where there was activity. A municipality-day that is missing from a daily table means **zero active cells**, unless the day is `no_data` in `reference_status_daily`.
- **Unit: hot spots.** `detections` (called `hotspots` in the summary tables) is the number of accepted FIRMS detections that day. It is the harmonized quantity since November 14, 2026 (see [HARMONIZATION.md](HARMONIZATION.md)). `active_cells`, the number of 1 km (0.01 degree) grid cells with at least one accepted detection, is kept as a second figure. Counts are never summed across sensors on the same day.
- **Estimates are separate from observations.** MODIS rescaled to VIIRS units exists only for 2003-01-01 to 2012-01-19 and only for the departments that passed the harmonization test. It is never written into the VIIRS reference tables.
- Boundaries are the DANE MGN 2018 municipality-level areas (1,122 areas, not all legal municipalities). The municipality of a cell is the one containing the cell centroid.

## Tables

### `municipios_lookup`
One row per municipality-level area: `mpio_code`, `mpio_name`, `dpto_code`, `dpto_name`.

### `reference_status_daily`
One row per day of the reference series (starts 2012-01-20).

| Column | Meaning |
|---|---|
| `date` | Local date |
| `status` | `snpp` (S-NPP used), `n20_fill` (S-NPP had no data, NOAA-20 used), `no_data` (neither had data) |
| `ref_sensor` | `VIIRS_SNPP`, `VIIRS_N20`, or empty when `no_data` |

Draw `no_data` days as striped gray and `n20_fill` days with a "filled" marker.

### `reference_daily_by_municipio`
The series the calendar is drawn from (VIIRS, from 2012-01-20). Columns: `mpio_code`, `date`, `detections` (hot spots, the value shown), `active_cells`, `sensor` (the reference sensor used that day), `filled` (true when NOAA-20 replaced S-NPP).

### `daily_by_municipio`
One row per municipality, day and **sensor** (`MODIS_C61` from 2003, `VIIRS_SNPP`, `VIIRS_N20`, `VIIRS_N21`), with `active_cells` and `detections`. Use it for the informational NOAA-21 layer and for MODIS: raw in its own view, and rescaled inside the single calendar.

### `sensor_coverage_daily`
`date`, `sensor`, `has_data`. `false` means the sensor had zero raw detections in the whole country that local day (file gap or outage).

### `anomaly_municipio` and `anomaly_departamento`
One row per municipality (or department, key `dpto_code`) and day where the 7-day sum is above zero.

| Column | Meaning |
|---|---|
| `hotspots_7d` | Sum of hot spots over that day and the 6 days before it |
| `p75`, `p90`, `p97_5` | Baseline percentiles for the same calendar window (+-15 days) in all other years since 2012 |
| `baseline_samples` | Number of baseline 7-day windows used |
| `baseline_active_days` | Days with activity inside the baseline season window |
| `level` | `normal`, `elevated`, `unusual`, `extreme`, or `insufficient` |

`insufficient` means fewer than 10 baseline active days: show the raw count in neutral gray labeled "insufficient history" and use the department row as fallback. `unusual` and `extreme` need at least 3 hot spots (otherwise capped at `elevated`).

### `anomaly_modis_era_departamento`
The same columns, for the MODIS era (2003-01-01 to 2012-01-19) and only for the departments that passed the harmonization test. `hotspots_7d` is MODIS rescaled to VIIRS units (a decimal estimate), and the percentiles come from the MODIS era itself. These are "internal anomalies of the MODIS era": do not show them as current alerts and do not compare them with the VIIRS-era levels.

### `monthly_municipio` and `monthly_departamento`
One row per municipality (or department) and month, for every month in the reference range.

| Column | Meaning |
|---|---|
| `month` | First day of the month |
| `hotspots` | Sum of daily hot spots in the month |
| `active_days` | Days with at least one active cell |
| `no_data_days` | Days flagged `no_data` |
| `month_complete` | False for the first and last partial months |
| `compare_first_day`, `compare_last_day` | Day-of-month range covered and compared (1 to the last day for complete months; for example 1-13 for the current month) |
| `history_years` | Other years used as history (complete months, or the same days for a partial month) |
| `hist_median_hotspots` | Median `hotspots` of the same month in other years. **For a partial month, the median over the same days of the month** (never whole months) |
| `ratio_vs_median` | `hotspots / hist_median_hotspots` ("2.3x normal"); empty if the median is 0 |
| `percentile_vs_history` | Percent of historical months with `hotspots` less than or equal to this one |

Only municipalities and departments that had at least one active cell in the reference series appear in the tables. Any other code from the lookup is zero everywhere.

### `static_source_mask`
Cells excluded from near-real-time data as static sources (volcanoes such as Galeras, gas flares, industrial heat, offshore): `cell_id`, `lon`, `lat` (cell centroid). Useful if the web app wants to show where detections are suppressed.

### Web JSON files (`data/processed/web/`)

For a static web app that cannot read Parquet. Built by `python scripts/export_web_json.py` from the tables above and checked by `scripts/check_dataset.py`. Load `manifest.json` first.

| File | Content |
|---|---|
| `manifest.json` | Departments (code, name, file, bytes), `levels`, `status_legend`, date bases, the fixed notice, alert parameters, `quantity`, and `harmonization` (see below) |
| `status.json` | One status code per day of the reference series (`start`, `end`, `legend`, `status[]`), `c[]`, the national hot spots per day (used to compare a partial month day for day at national level), and `modis_era` (`start`, `c[]`): the national MODIS hot spots per day of the MODIS era, raw |
| `departments.json` | Department-level `alerts` and `monthly` for all 33 departments (the fallback for municipalities with insufficient history), and `alerts_modis_era` for the departments that passed the harmonization test |
| `departments/<code>.json` | One department: `municipalities`, `daily`, `other_sensors`, `alerts`, `monthly` |

Format rules:
- **Columnar:** each block is an object of equal-length arrays (one array per column).
- **Dates are integers.** Day index `d` = days since `manifest.day_base` (2003-01-01). Month index `mo` = months since `manifest.month_base` (2012-01).
- **`m` is a position** in that department's `municipalities` array (in `departments.json`, a position in its `departments` array).
- **Level codes** `l` index into `manifest.levels`: `normal`, `elevated`, `unusual`, `extreme`, `insufficient`. Status codes index into `status_legend`: `snpp`, `n20_fill`, `no_data`.
- **Sparse:** `daily` has only rows with activity (a missing municipality-day is zero, unless the day is `no_data`). `municipalities` lists every area of the department, including those with no activity.
- **Columns:** `daily` is `m, d, c` (hot spots) and `k` (active 1 km cells). `alerts` is `m, d, c` (7-day hot spots), `p75, p90, p975, act` (baseline active days), `l`. `monthly` is `m, mo, cd` (hot spots in the month), `ad` (active days), `nd` (no-data days), `ok` (complete month, 0/1), `d1, d2` (day-of-month range compared), `med`, `ratio`, `pct`. `other_sensors` is `s, m, d, c, k` with `legend` listing the sensors (MODIS Collection 6.1 and VIIRS NOAA-21); `c` is hot spots as observed, never rescaled in the file.
- **`manifest.harmonization`:** `accepted` (false means the test failed and nothing may be rescaled), `factors` (12, January first), `national_error_pct` (12, the median test error per calendar month), `modis_era` (first and last day), `modis_no_data_days`, `departments` (per code: `status` = `ok`, `low_confidence`, `viirs_only` or `insufficient`, and `error_pct`, 12 values or null), and `notice` (the fixed text to show). **To draw the single calendar:** for a department with status `ok` or `low_confidence`, the value of a day before the VIIRS reference starts is its MODIS hot spots multiplied by the factor of that calendar month. Draw those days as estimates (hatched), show the error of that month, and never do this for a municipality, a drawn area, or a department with another status.
- **Missing numbers are null.**
- **Size:** about 41 MB raw in total, but each department file is 0.06 to 0.5 MB once gzipped, which static hosts do automatically. Load only the departments the user selects.

### Hot spot points (`data/processed/web/points/`)

The individual accepted detections, for the "points of a search" CSV. One gzipped CSV per department and year: `points/<department code>/<year>.csv.gz` (771 files, about 3.1 million points, 37 MB in total). `manifest.points` gives the path template, the columns and the year range.

| Column | Meaning |
|---|---|
| `date`, `time` | Local Colombian date and time (UTC-5) of the detection |
| `latitude`, `longitude` | Center of the fire pixel, as FIRMS reports it |
| `sensor` | `MODIS_C61`, `VIIRS_SNPP`, `VIIRS_N20` or `VIIRS_N21` |
| `confidence` | `nominal` or `high` (low confidence is never included) |
| `daynight` | `D` or `N`, as FIRMS reports it |
| `frp` | Fire radiative power in MW, as FIRMS reports it |
| `mpio_code` | Municipality of the 1 km cell the detection falls in |

These are exactly the detections the calendar counts: same quality filters, same local date, same municipality. `scripts/check_dataset.py` and `npm run verify` check that the points add up to the daily tables and to the calendar values. **Points of different sensors must not be added together**: several satellites see the same fire. The files are gzipped, so the browser has to decompress them (`DecompressionStream('gzip')`); some hosts decompress `.gz` on their own, so check for the gzip magic bytes first. A file does not exist when that department had no detections that year.

In the web app, a drawn shape returns the points of the municipalities used for the calendar (those with at least 25% of their area inside), with a column `inside_drawn_shape` that says whether each point is inside the shape.

### Other files
- `build_info.json`: parameters, mask size, filter counts, reference range.
- `harmonization.json`, `harmonization_summary.json`, `harmonization_factors.csv`, `harmonization_test_national.csv`, `harmonization_test_departments.csv`, `harmonization_department_month_error.csv`: the harmonization rule, its factors and the full leave-one-year-out test (see [HARMONIZATION.md](HARMONIZATION.md)).
- `filter_report.csv`: detections kept and dropped per sensor and reason.
- `validation_snpp_dept_month_2023_2024.csv`: raw S-NPP counts per department and month.
- `validation_ideam_*.csv`, `ideam_semester_*.csv`: the IDEAM figures and the comparison against our raw counts (see [VALIDATION.md](VALIDATION.md)). Not used by the web app.

## Fixed notice to show in the web app

> Hot spot = thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide fires: a zero does not guarantee absence of fire. Data from different satellites are never summed on the same day.

Wherever MODIS rescaled to VIIRS units is shown, also show the harmonization notice (`manifest.harmonization.notice`):

> MODIS data (2003-2011) are converted to VIIRS-equivalent units with a different factor for each month, estimated from the years when both sensors overlap (2013-2025). They are estimates, not observations. The error can be larger in regions and months with few detections. The assumption that the factor also holds in 2003-2011 cannot be verified. Data from different satellites are never summed on the same day.

## Polygon queries

The data is aggregated per municipality, so a drawn polygon is answered with the municipalities that have at least 25% of their area inside it. Always show the list of municipalities used and the percentage covered. The boundaries are in `data/processed/dane_mgn2018_municipios.geojson`.
