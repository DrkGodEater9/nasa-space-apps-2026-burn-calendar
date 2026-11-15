# Harmonization test: results

*AI note: computed by `scripts/harmonization_test.py` (written with the help of Claude Code) on 2026-11-14, after the margins were fixed in [HARMONIZATION_TEST_PLAN.md](HARMONIZATION_TEST_PLAN.md). Nothing was adjusted after seeing these numbers. The decisions that follow from them belong to the team.*

Reproduce with `python scripts/harmonization_test.py`. Full tables: `data/processed/harmonization_test_national.csv`, `harmonization_test_departments.csv`, `harmonization_factors.csv`, `harmonization_summary.json`.

## National criterion (margin 15%)

Leave one year out, 2013-2025, 156 withheld year-months, one factor per calendar month.

| Quantity | h1: median over 156 year-months | h2: worst calendar-month median | Passes both |
|---|---:|---:|---|
| Active 1 km cells | 8.28% | 14.85% (April) | Yes |
| Raw detections | 6.92% | 14.91% (April) | Yes |

Both quantities pass under both readings of the national criterion. Reading h2 passes narrowly: April (14.9%), June (13-15%) and September (12-14%) are close to the margin. Those are low-activity months.

Median error by withheld year, cells: 4.8% (2023) to 14.2% (2020). Detections: 4.4% (2015) to 10.8% (2020). No year is above the margin.

## Which quantity wins

The fixed criterion is the lower national monthly median absolute error. **Detections win: 6.92% against 8.28%.**

By the team's rule this means the harmonized quantity changes to detections. The plan says that in this case the implementation stops and the team is asked, because the minimum count for a department-month in detections (point k) was never defined. **That decision is pending.** The department figures for detections below use 30 as a placeholder and are provisional.

## Department criterion (margin 30%, at least 30 observed)

The single national factor is applied to each department.

| | Cells | Detections (provisional) |
|---|---:|---:|
| Evaluable department-months | 2,619 | 2,788 |
| Within 30% | 44.7% | 50.5% |
| Median error | 34.0% | 29.7% |
| Departments `ok` (median error up to 30%) | 10 | 14 |
| Departments `low_confidence` | 1 | 1 |
| Departments `viirs_only` (above 30% in most months) | 18 | 14 |
| Departments `insufficient` (no evaluable month) | 4 | 4 |
| Share of national activity in `ok` departments | 63.4% | 74.3% |

So a national factor works at national scale and for the departments with the most activity (Vichada, Meta, Caquetá, Casanare, Cesar, Guaviare, La Guajira, Norte de Santander, Guainía, Chocó in both quantities), and fails in most months for about half of the departments. By the team's rule those departments keep VIIRS data from 2012 only, with MODIS in the separate view. Bolívar (7.8% of national activity) and Magdalena (5.0%) are the largest ones that fail. Nariño fails too.

The four `insufficient` departments are Bogotá, Risaralda, Quindío and San Andrés.

## The 12 factors (all 13 years)

| Month | Cells | Detections |
|---|---:|---:|
| Jan | 2.62 | 3.78 |
| Feb | 2.84 | 4.04 |
| Mar | 3.18 | 4.28 |
| Apr | 3.84 | 4.91 |
| May | 3.65 | 4.53 |
| Jun | 3.84 | 4.75 |
| Jul | 4.08 | 5.11 |
| Aug | 3.83 | 4.75 |
| Sep | 3.87 | 4.85 |
| Oct | 3.49 | 4.40 |
| Nov | 2.74 | 3.56 |
| Dec | 2.69 | 3.63 |

## What this does and does not show

- It shows that, inside 2013-2025, a monthly national factor predicts the national VIIRS total from MODIS with a median error of 7 to 8%.
- It does **not** show that the factor held in 2003-2011. There is no VIIRS then, so this stays an assumption that cannot be verified.
- It was not tested at municipality scale. The error there is unknown and is expected to be larger than at department scale.
- MODIS here is two satellites (Terra and Aqua) against one VIIRS satellite (S-NPP).

## Pending team decisions

1. **Quantity.** Detections won by the fixed criterion (6.92% against 8.28%). Follow the rule and change the product to detections (and define point k), or keep cells and declare it as a deviation from the written criterion, with the reason.
2. **Departments that fail.** Confirm that the departments marked `viirs_only` show VIIRS from 2012 only, as the rule says. In that case the single calendar from 2003 exists at national scale and for the `ok` and `low_confidence` departments.
3. **Municipalities.** The rule does not cover them. Decide whether a municipality inherits the status of its department, or is never shown rescaled.
4. **Open details h, i, j** of the plan: confirm the readings used.
