# Data contract: Data -> Web

Everything here is produced by `python scripts/build_dataset.py` from `data/raw`, following [METHOD.md](METHOD.md). The full tables live in `data/processed/` and a small copy for one department (Nariño, code `52`) lives in `data/sample/` with the prefix `sample_` and the same columns, in Parquet and CSV.

*AI note: this document and the script were written with the help of an AI assistant (Claude Code).*

After a build, run `python scripts/check_dataset.py`. It verifies the integrity of every table (codes, sparsity, continuous dates, monthly totals against the daily series, anomaly rules, mask coverage of Galeras, and that the sample matches the full tables).

## General rules

- **Keys are strings.** `mpio_code` is the 5-character DANE code (`MPIO_CDPMP`), and `dpto_code` is the 2-character department code. Leading zeros matter. Names are display values only.
- **Dates are local Colombian dates (UTC-5)**, stored as `date` (Parquet `date32`, ISO `YYYY-MM-DD` in CSV).
- **Sparse tables.** Rows exist only where there was activity. A municipality-day that is missing from a daily table means **zero active cells**, unless the day is `no_data` in `reference_status_daily`.
- **Unit:** `active_cells` is the number of 1 km (0.01 degree) grid cells with at least one accepted detection that day. Counts are never summed across sensors.
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
The series the calendar is drawn from. Columns: `mpio_code`, `date`, `active_cells`, `sensor` (the reference sensor used that day), `filled` (true when NOAA-20 replaced S-NPP).

### `daily_by_municipio`
Same shape but for **every sensor** (`MODIS_C61` from 2003, `VIIRS_SNPP`, `VIIRS_N20`, `VIIRS_N21`), plus `detections` (raw accepted detections behind the active cells). Use it for the informational NOAA-21 layer and the separate "Long history (MODIS)" view.

### `sensor_coverage_daily`
`date`, `sensor`, `has_data`. `false` means the sensor had zero raw detections in the whole country that local day (file gap or outage).

### `anomaly_municipio` and `anomaly_departamento`
One row per municipality (or department, key `dpto_code`) and day where the 7-day sum is above zero.

| Column | Meaning |
|---|---|
| `cells_7d` | Sum of `active_cells` over that day and the 6 days before it |
| `p75`, `p90`, `p97_5` | Baseline percentiles for the same calendar window (+-15 days) in all other years since 2012 |
| `baseline_samples` | Number of baseline 7-day windows used |
| `baseline_active_days` | Days with activity inside the baseline season window |
| `level` | `normal`, `elevated`, `unusual`, `extreme`, or `insufficient` |

`insufficient` means fewer than 10 baseline active days: show the raw count in neutral gray labeled "insufficient history" and use the department row as fallback. `unusual` and `extreme` need at least 3 active cells (otherwise capped at `elevated`).

### `monthly_municipio` and `monthly_departamento`
One row per municipality (or department) and month, for every month in the reference range.

| Column | Meaning |
|---|---|
| `month` | First day of the month |
| `cell_days` | Sum of daily `active_cells` in the month |
| `active_days` | Days with at least one active cell |
| `no_data_days` | Days flagged `no_data` |
| `month_complete` | False for the first and last partial months |
| `history_years` | Complete same-month years used as history |
| `hist_median_cell_days` | Median `cell_days` of the same month in other years |
| `ratio_vs_median` | `cell_days / hist_median_cell_days` ("2.3x normal"); empty if the median is 0 |
| `percentile_vs_history` | Percent of historical months with `cell_days` less than or equal to this one |

Only municipalities and departments that had at least one active cell in the reference series appear in the tables. Any other code from the lookup is zero everywhere.

### `static_source_mask`
Cells excluded from near-real-time data as static sources (volcanoes such as Galeras, gas flares, industrial heat, offshore): `cell_id`, `lon`, `lat` (cell centroid). Useful if the web app wants to show where detections are suppressed.

### Other files
- `build_info.json`: parameters, mask size, filter counts, reference range.
- `filter_report.csv`: detections kept and dropped per sensor and reason.
- `validation_snpp_dept_month_2023_2024.csv`: raw S-NPP counts per department and month.
- `validation_ideam_*.csv`, `ideam_semester_*.csv`: the IDEAM figures and the comparison against our raw counts (see [VALIDATION.md](VALIDATION.md)). Not used by the web app.

## Fixed notice to show in the web app

> Hot spot = thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide fires: a zero does not guarantee absence of fire. Data from different satellites are not summed.

## Polygon queries

The data is aggregated per municipality, so a drawn polygon is answered with the municipalities that have at least 25% of their area inside it. Always show the list of municipalities used and the percentage covered. The boundaries are in `data/processed/dane_mgn2018_municipios.geojson`.
