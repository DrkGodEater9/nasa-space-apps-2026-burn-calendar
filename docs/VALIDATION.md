# Validation against IDEAM (Step 6)

*AI note: the IDEAM figures were extracted from the official reports with the help of an AI assistant (see [IDEAM_REFERENCE.md](IDEAM_REFERENCE.md)). The comparison script and this document were written with the help of an AI assistant (Claude Code). Nothing was tuned to match IDEAM: every combination that was tried is listed in the output files.*

## What IDEAM publishes

The four semester reports (2023-S1 to 2024-S2) give **semester** figures, not monthly ones: the national total, and the **top 10 departments** per semester (the first five in the text, places 6 to 10 only in a chart). They say "MODIS and VIIRS" from FIRMS but not which satellites, filters, or date basis. Details and sources: [IDEAM_REFERENCE.md](IDEAM_REFERENCE.md).

The criteria in [METHOD.md](METHOD.md) (department-month pairs, 90% within +-10%) cannot be applied as written, because IDEAM has no monthly or all-department figures. The team must confirm the adapted criteria used below.

## What was compared

`python scripts/validate_ideam.py` counts **raw detections** (not 1 km cells) inside Colombia, assigned to departments with the DANE MGN 2018 municipality polygons, by semester using the FIRMS UTC date. It tries every combination of eight sensor sets and three quality filters (`raw`, `type0` = archive `type = 0`, `type0_not_low`) against 4 national totals and 40 department values.

Outputs in `data/processed/`:
- `validation_ideam_counts_dept_semester.csv`: raw counts per department, semester, sensor and filter.
- `validation_ideam_national.csv`: every combination against the IDEAM national total.
- `validation_ideam_departments.csv`: every combination against the 40 IDEAM department values.
- `validation_snpp_dept_month_2023_2024.csv`: raw S-NPP counts per department and month (UTC and local date), for anyone who later finds monthly figures.

## Result

Best match: **MODIS + VIIRS S-NPP + VIIRS NOAA-20, archive `type = 0`, no confidence filter.**

| Semester | Ours | IDEAM | Difference |
|---|---:|---:|---:|
| 2023-S1 | 157,216 | 156,655 | +0.4% |
| 2023-S2 | 54,054 | 53,665 | +0.7% |
| 2024-S1 | 168,867 | 168,208 | +0.4% |
| 2024-S2 | 57,826 | 57,205 | +1.1% |

The next best combination (same sensors, without the `type` filter and with low confidence dropped) averages 5.0% off. Every combination that includes NOAA-21 is 21% or more off. Any single sensor is more than 50% off.

Departments (40 values, top 10 of each semester): mean absolute difference **1.3%**, **38 of 40 within 5%**, **39 of 40 within 10%**. The department order matches in every semester. The values that are not within 5%:

| Semester | Department | Ours | IDEAM | Difference |
|---|---|---:|---:|---:|
| 2024-S2 | Caquetá | 2,418 | 2,818 | -14.2% |
| 2024-S1 | Caquetá | 11,852 | 12,888 | -8.0% |

Caquetá is the only department that does not match. It is 3.3% under in 2023-S1 as well, so it is always under, never over.

An earlier comparison that used only the text of the reports showed Casanare 2024-S2 as +19.7% off. That was an inconsistency inside the IDEAM report (the text says 4.070 and the chart says 4870). Our count of 4,873 matches the chart. See [IDEAM_REFERENCE.md](IDEAM_REFERENCE.md).

## Against the adapted criteria

| Criterion | Result |
|---|---|
| National total within +-5% in every semester | Pass (0.4% to 1.1%) |
| At least 90% of the IDEAM department values within +-10% | Pass (39 of 40 = 97.5%) |

## How to read this

- **This is an inference, not a confirmed method.** IDEAM does not say it sums MODIS, S-NPP and NOAA-20, and the reports do not mention the `type` filter. The match is very close (about 0.6% against 5% for the next option), which makes it likely, but only IDEAM can confirm it. Twenty-four combinations were tried, so a close match by chance is possible in principle, but the gap to the second best is large and it holds in every semester and for 38 of 40 departments.
- **This validates our data pipeline, not the harmonized cells.** Raw detections from three sensors are summed here to reproduce IDEAM. Our method never sums sensors and counts active 1 km cells (METHOD.md, sections 2 and 3). What the result supports: our ingestion of the FIRMS files, the `type` filter, the DANE boundaries and the department assignment agree with IDEAM's.
- **It also shows why raw counts overstate activity.** IDEAM's figure counts the same fire several times (three sensors, several pixels per fire). That is the reason the method uses cells and a per-sensor baseline.
- **Not tested:** UTC against local date (the script uses UTC only), and the NRT data (2023-2024 is all archive). The accepted-differences list in METHOD.md still applies.

## Sanity check of the newest extreme alerts

On 2026-11-13 Antioquia, Norte de Santander and Santander show `extreme` 7-day levels at department level (Antioquia: 73 cells against a P97.5 of 21). Because they are the first thing a visitor sees, they were checked against data the alert does not use:

1. **Independent sensors agree.** In those days the reference series is NOAA-20 (S-NPP has no data after 2026-11-01). MODIS and NOAA-21 are independent of it, and both are far above their own history for November 1-13 too. Antioquia, active cells on November 1-13:

   | Sensor | 2018-2025 range | 2026 |
   |---|---:|---:|
   | MODIS | 0 to 6 | 19 |
   | NOAA-20 | 2 to 40 | 84 |
   | NOAA-21 (from 2023) | 5 to 23 | 91 |

   Norte de Santander (NOAA-21: 7 to 39 before, 66 in 2026) and Santander (NOAA-21: 2 to 20 before, 47 in 2026) behave the same way. So the jump is not an effect of switching from S-NPP to NOAA-20.
2. **No fixed heat source.** Each active cell appears on 1 day, at most 2, of the 13. A gas flare, mine or industrial source would repeat on most days. The activity is spread over many places (in Antioquia mainly Segovia, El Bagre, Yondó, Amalfi, Remedios and Zaragoza).

Conclusion: the alerts look real (dispersed burning seen by three satellites), not a data error. Caveat: November 2026 comes from near-real-time data, which FIRMS later replaces with the science-quality archive, while the history is archive data.

## Open points

1. Caquetá 2024 (-14.2% and -8.0%) is a **border assignment difference with Meta**, not a counting error, but its exact cause is not identified. Evidence, for the best combination:

   | Semester | Meta, ours vs IDEAM | Caquetá, ours vs IDEAM | Meta + Caquetá |
   |---|---:|---:|---:|
   | 2023-S1 | +238 | -225 | +13 (+0.04%) |
   | 2024-S1 | +1,011 | -1,036 | -25 (-0.06%) |
   | 2024-S2 | +442 | -400 | +42 (+0.32%) |

   The two departments together match IDEAM almost exactly, and the error of one is the mirror of the other. So some detections that we assign to Meta are assigned to Caquetá by IDEAM. The amount (about 1,000 in 2024-S1) is too large to come from the 300 m simplification of our boundaries: only 496 Meta detections lie within 10 km of Caquetá. No single municipality explains it either: the Meta municipalities that touch Caquetá are Uribe and La Macarena, and their counts (1,276 and 6,248 in 2024-S1) do not match the shift in all three semesters. The most likely cause is that IDEAM uses another boundary version or layer along the Meta-Caquetá limit, which METHOD.md already lists as an accepted difference ("MGN version"). It affects only this comparison: our dataset assigns every area consistently with the MGN 2018.

   Research on this (see [IDEAM_META_CAQUETA_BOUNDARY.md](IDEAM_META_CAQUETA_BOUNDARY.md)) found that **no source says which department layer IDEAM uses**, so the hypothesis is neither confirmed nor contradicted. It did find indirect support: the MGN 2018 uses an IGAC layer of May 2016, and a provisional IGAC limit in force since September 2020 moves about 274,000 ha from Meta to Caquetá according to press reports, which matches the sign of our difference (Meta too high, Caquetá too low). These facts come from the research and are not verified by us.

   **To test it with data:** unzip the DANE MGN 2023 department shapefile (download it by hand from the DANE geoportal; it could not be fetched automatically) and run `python scripts/compare_boundary_versions.py data/processed/dane_mgn2018_departamentos.geojson <path to the 2023 department layer>`. If the gap closes with the 2023 layer, the hypothesis is supported. Until then it stays an open, documented difference. With the 2018 layer alone the script reproduces the current numbers (Caquetá -1,033, Meta +1,016 in 2024-S1).
2. The team must confirm that the semester-based criteria above replace the monthly ones in METHOD.md.
3. Values 6 to 10 of each IDEAM list were read from chart images (see IDEAM_REFERENCE.md), so a misread digit is possible. Re-check against the PDFs if a value looks odd.
