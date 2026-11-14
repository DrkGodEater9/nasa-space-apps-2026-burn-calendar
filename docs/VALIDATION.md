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

## Open points

1. Caquetá 2024 (-14.2% and -8.0%) is unexplained. Our count by sensor is in `validation_ideam_counts_dept_semester.csv`. Possible causes to check: department assignment along the Caquetá borders (the boundaries here are simplified to 300 m, and IDEAM may use another boundary version), or a different treatment of one sensor in that period.
2. The team must confirm that the semester-based criteria above replace the monthly ones in METHOD.md.
3. Values 6 to 10 of each IDEAM list were read from chart images (see IDEAM_REFERENCE.md), so a misread digit is possible. Re-check against the PDFs if a value looks odd.
