# Validation of the data pipeline against IDEAM

*AI note: the comparison script and this document were written with the help of Claude Code. The IDEAM figures were extracted from the official reports with AI help: the values in the text were read from the PDF text, and places 6 to 10 of each list were read from chart images, so a misread digit is possible there. The research on the Meta-Caquetá limit was done with Claude Desktop and its sources were not re-checked by the team. No figure was invented or estimated. Nothing was tuned to match IDEAM: every combination that was tried is in the output files.*

This checks that we read the NASA files, apply the filters and assign the boundaries correctly. It does **not** validate the harmonized series, which is tested separately in [HARMONIZATION.md](HARMONIZATION.md).

## What IDEAM publishes

IDEAM, Colombia's environmental agency, publishes the *Reporte semestral de incendios de la cobertura vegetal, mediante puntos de calor y eventos registrados*. We used the four reports for 2023 and 2024 (publications No. 01 to 04).

- Repository page: <https://www.ideam.gov.co/sala-de-prensa/informes/Reporte-semestral-de-Incendios-de-la-Cobertura-Vegetal>
- Files: <https://www.ideam.gov.co/file-download/download/public/20672> (2023-S1), `.../20673` (2023-S2), `.../20676` (2024-S1), `.../20678` (2024-S2).

Each report gives, on page 4, the national total of hot spots for the **semester** and the **top 10 departments** (the first five in the text, all ten in a bar chart). There are no monthly figures and no figures for the other departments.

The reports say the source is "the NASA FIRMS platform, which provides hot spot data from the MODIS and VIIRS sensors". They do **not** say which VIIRS satellites, whether the data is archive or near-real-time, which confidence filters apply, whether volcanoes and static sources are removed, which boundary layer is used, or whether dates are UTC or local.

The figures are in `data/processed/ideam_semester_national.csv` and `ideam_semester_departments.csv`. The department codes were checked against the official DANE boundaries.

**One inconsistency inside a report.** For 2024-S2 the text says Casanare has 4.070 hot spots and the chart says 4870. The other 19 values that appear in both agree. We use the chart value; our own count is 4,873.

## What was compared

`python scripts/validate_ideam.py` counts **raw detections** inside Colombia, assigned to departments with the DANE boundaries, by semester and FIRMS UTC date. Because IDEAM does not state its method, the script tries every combination of eight sensor sets and three filters (24 in all) against the 4 national totals and the 40 department values.

## Result

Best match: **MODIS + VIIRS S-NPP + VIIRS NOAA-20, archive `type = 0`, no confidence filter.**

| Semester | Ours | IDEAM | Difference |
|---|---:|---:|---:|
| 2023-S1 | 157,216 | 156,655 | +0.4% |
| 2023-S2 | 54,054 | 53,665 | +0.7% |
| 2024-S1 | 168,867 | 168,208 | +0.4% |
| 2024-S2 | 57,826 | 57,205 | +1.1% |

The next best combination averages 5.0% off. Every combination with NOAA-21 is 21% or more off, and any single sensor is more than 50% off.

Departments: mean absolute difference **1.3%**, **38 of 40 within 5%**, **39 of 40 within 10%**. The order of the departments matches in every semester.

| Criterion | Result |
|---|---|
| National total within 5% in every semester | Pass (0.4% to 1.1%) |
| At least 90% of the department values within 10% | Pass (39 of 40) |

The team's first criteria were monthly (department-month pairs). They were replaced by these semester criteria because IDEAM publishes no monthly figures.

## How to read this

- **It is an inference, not a confirmed method.** IDEAM does not say it sums MODIS, S-NPP and NOAA-20. The match is very close (0.6% against 5% for the next option) and holds in every semester, which makes it likely, but only IDEAM can confirm it.
- **It supports the pipeline:** our reading of the FIRMS files, the `type` filter, the DANE boundaries and the department assignment agree with IDEAM's.
- **It shows why summing sensors overstates activity.** IDEAM's figure counts the same fire several times: three sensors, and several pixels per fire. That is why our method uses one reference sensor and rescales MODIS instead of adding it.
- **Not tested:** UTC against local date, and near-real-time data (2023-2024 is all archive).

## The one department that does not match: Caquetá

| Semester | Meta, ours minus IDEAM | Caquetá, ours minus IDEAM | Both together |
|---|---:|---:|---:|
| 2023-S1 | +238 | -225 | +13 (+0.04%) |
| 2024-S1 | +1,011 | -1,036 | -25 (-0.06%) |
| 2024-S2 | +442 | -400 | +42 (+0.32%) |

Caquetá is 8.0% and 14.2% under IDEAM in 2024, but Meta and Caquetá together match almost exactly, and the error of one mirrors the other. So some detections that we assign to Meta are assigned to Caquetá by IDEAM. It is not a counting error.

What was ruled out: the 300 m simplification of our boundaries (only 496 Meta detections lie within 10 km of Caquetá, against a shift of about 1,000), and a single municipality (Uribe and La Macarena, the two that touch Caquetá, do not explain the shift in all three semesters).

**Most likely cause, not confirmed:** IDEAM uses another boundary layer along that limit. No source says which layer IDEAM uses. Indirect support, from research that the team did not re-check: the DANE boundaries of 2018 use an IGAC layer of May 2016, and a provisional limit between the two departments has been in force since September 2020, giving Caquetá about 274,000 hectares that used to be Meta's according to press reports. That matches the sign of our difference. The DANE manuals that give the layer dates are <https://geoportal.dane.gov.co/descargas/descarga_mgn/Manual_MGN.pdf> and <https://geoportal.dane.gov.co/descargas/mgn_2023/MGN2023_ManualDeUso.pdf>; a press account of the dispute is <https://consonante.org/noticia/el-mapa-de-la-discordia-el-catastro-rural-revivio-la-disputa-territorial-entre-meta-y-caqueta/>.

**To test it:** download the DANE 2023 department boundaries by hand and run `python scripts/compare_boundary_versions.py data/processed/dane_mgn2018_departamentos.geojson <path to the 2023 layer>`. If the gap closes, the hypothesis is supported. This affects only this comparison: our dataset assigns every area consistently with the 2018 boundaries.

## Sanity check of the newest extreme alerts

On 2026-11-13 three departments show `extreme` 7-day levels: Antioquia (87 hot spots against a 97.5th percentile of 25), Norte de Santander (53 against 34) and Santander (32 against 17). They are the first thing a visitor sees, so they were checked against sensors the alert does not use. In those days the reference series is NOAA-20, because S-NPP has no data after 2026-11-01. Hot spots on November 1-13:

| Department | Sensor | Range in 2018-2025 | 2026 |
|---|---|---:|---:|
| Antioquia | MODIS | 1 to 6 | 19 |
| Antioquia | NOAA-20 | 3 to 45 | 98 |
| Antioquia | NOAA-21 (from 2023) | 5 to 30 | 114 |
| Santander | MODIS | 1 to 3 | 0 |
| Santander | NOAA-20 | 2 to 16 | 34 |
| Santander | NOAA-21 (from 2023) | 2 to 22 | 51 |
| Norte de Santander | MODIS | 1 to 16 | 11 |
| Norte de Santander | NOAA-20 | 7 to 66 | 56 |
| Norte de Santander | NOAA-21 (from 2023) | 9 to 44 | 80 |

- **Antioquia:** all three sensors are far above their own history. The alert is well supported.
- **Santander:** both VIIRS sensors are above their history. MODIS saw nothing, so it gives no support.
- **Norte de Santander:** it is above the 97.5th percentile, but NOAA-20 saw more in one earlier year (66) and MODIS is inside its usual range. Only NOAA-21, with three years of history, is above its range. The level is high, but this is the weakest of the three.

No fixed heat source explains them: in each department every active 1 km cell appears on 1 day, at most 2, of the 13, while a gas flare or an industrial source would repeat on most days.

Caveat: November 2026 comes from near-real-time data, which FIRMS later replaces with standard processing, while the history is archive data.
