# Harmonization of MODIS and VIIRS: the rule, its test and the results

*AI note: the rule, the test and the margins are the Horum Labs team's. Claude Code translated them to English, wrote `scripts/harmonization_test.py`, ran it and wrote this document from the output. Nothing was adjusted after the results were known.*

The challenge asks for one burn calendar from the early 2000s to today on a harmonized dataset, where the sensor of origin no longer matters. This document has two parts: what was fixed **before** the test, and what the test showed.

Reproduce with `python scripts/harmonization_test.py`. Full tables in `data/processed/`: `harmonization_test_national.csv`, `harmonization_test_departments.csv`, `harmonization_department_month_error.csv`, `harmonization_factors.csv`, `harmonization_summary.json`.

---

## Part 1. Fixed before the test

**Written on 2026-11-14 at 21:55 (Colombia time), before any test error was computed.** At that point only the descriptive ratios VIIRS S-NPP / MODIS by year, month and department had been seen. The numbers in this part were not changed afterwards.

### The rule

1. **Start year: 2003.** It is the first full year with Terra and Aqua together (Aqua starts on 2002-07-04). 2000-2002 stay excluded: until mid-2002 only Terra was flying and there are gaps.
2. **Quantity:** active 1 km cells or raw detections. Both are tested with the same margins, and the one with the lower error is kept.
3. **Data that relate the sensors:** the overlap of MODIS and VIIRS S-NPP, 2013 to 2025.
4. **Spatial unit:** one factor computed at national scale.
5. **One factor per calendar month.** `factor[m] = (S-NPP total of month m over the training years) / (MODIS total of month m over the same years)`, a ratio of totals.
6. **MODIS era in the calendar (2003-2011):** MODIS converted to VIIRS-equivalent units with the monthly factor, drawn with another pattern, labeled "MODIS rescaled to VIIRS units (estimated)", and visually separate from what VIIRS observed.
7. **Uncertainty shown to the user:** the band comes from the error of the test at the granularity that is shown (month and region). A visible sentence: "The error can be larger in regions and months with few detections."
8. **Anomalies in the MODIS era:** computed against the MODIS era itself (2003-2011), with the same windows and percentiles, shown as "internal anomaly of the MODIS era", with no current alerts.
9. **2003-2011 assumption:** that the 2013-2025 ratio also held before cannot be verified. It is declared as such, and that era is marked as lower confidence.
10. **Different satellites are never summed on the same day.**

### The test

**Leave one year out.** For each year from 2013 to 2025: estimate the monthly factors with the other twelve years, apply them to the MODIS data of the withheld year, and compare with what VIIRS S-NPP observed. The error is `abs(predicted - observed) / observed`, per month at national scale and per department and month.

**Margins:**
- National: up to **15%** median absolute error in the national monthly total.
- Department and month: up to **30%**.
- A department-month enters the 30% criterion only if VIIRS observed at least **30** in it. Below that it is "insufficient data to evaluate".

**Departments that fail the 30%:** shown as low confidence, with the note "estimated error above 30%". If the failure repeats in most months, the department is shown with VIIRS from 2012 only, and MODIS stays in a separate view.

**Choosing the quantity:** the lower national monthly median absolute error wins.

**If the test fails:** the sensors stay separate, with MODIS in its own view and not rescaled, declared as a limitation.

### Readings fixed for four details

The rule did not settle these four points. To avoid choosing after seeing the result, the readings were fixed here, and where two readings exist both are reported and the stricter one decides.

- **National "median absolute error".** Two readings: the median over all 156 withheld year-months, and the median of each calendar month over its 13 years, required in all 12. **The rule passes only if both pass.**
- **What rejects the whole rule:** only the national criterion. The error of every withheld year is reported as well.
- **"Most months" for a department:** more than half of the calendar months that have at least one evaluable department-month.
- **Minimum count if detections win:** not defined in advance. If detections win, the work stops and the team decides.

---

## Part 2. Results

### National criterion (margin 15%)

| Quantity | Median over 156 year-months | Worst calendar-month median | Passes both |
|---|---:|---:|---|
| Active 1 km cells | 8.28% | 14.85% (April) | Yes |
| Detections | 6.92% | 14.91% (April) | Yes |

Both pass under both readings. The second reading passes narrowly: April (14.9%), June (13.1%) and September (11.9%) are the weakest months for detections, and they are low-activity months.

Median error by withheld year, detections: 4.4% (2015) to 10.8% (2020). No year is above the margin.

### Which quantity

**Detections: 6.92% against 8.28%.** They are also better at department scale. The minimum for a department-month was then set at 30 detections, the stricter option: a cell-equivalent value would be higher and would keep noisier months out of the test.

### Department criterion (margin 30%)

The single national factor is applied to each department.

| | Cells | Detections |
|---|---:|---:|
| Evaluable department-months | 2,619 | 2,788 |
| Within 30% | 44.7% | 50.5% |
| Median error | 34.0% | 29.7% |
| Departments within the margin | 10 | 14 |
| Low confidence | 1 | 1 |
| Above 30% in most months | 18 | 14 |
| Too few detections to evaluate | 4 | 4 |
| Share of national activity in departments within the margin | 63.4% | 74.3% |

With detections:
- **Within the margin (14):** Antioquia, Arauca, Caldas, Caquetá, Casanare, Cesar, Chocó, Córdoba, Guainía, Guaviare, La Guajira, Meta, Norte de Santander, Vichada.
- **Low confidence (1):** Huila.
- **Above 30% in most months (14):** Amazonas, Atlántico, Bolívar, Boyacá, Cauca, Cundinamarca, Magdalena, Nariño, Putumayo, Santander, Sucre, Tolima, Valle del Cauca, Vaupés.
- **Too few detections (4):** Bogotá, Quindío, Risaralda, San Andrés.

**Why some fail.** The national factor is about 4.15 over the year, and it is dominated by the eastern plains, where VIIRS sees about 3.6 to 3.9 times what MODIS sees (Meta 3.63, Vichada 3.88). In Bolívar, Nariño and Magdalena VIIRS sees 5.4 to 6.1 times more, so the national factor underestimates them by 30 to 45%. Magdalena misses the margin by very little (30.07%) but fails in 8 of 12 months. Nariño has few evaluable months (30 of 156), so its result is the least firm.

### The 12 factors and their test error (detections)

| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Factor | 3.78 | 4.04 | 4.28 | 4.91 | 4.53 | 4.75 | 5.11 | 4.75 | 4.85 | 4.40 | 3.56 | 3.63 |
| Median test error | 2.5% | 5.5% | 3.5% | 14.9% | 7.3% | 13.1% | 5.5% | 7.4% | 11.9% | 9.0% | 7.3% | 4.0% |

### Decisions taken after the results (November 14, 2026)

1. **Quantity: detections ("hot spots").** Active cells remain as a second figure.
2. **Departments above 30% in most months: VIIRS from 2012 only**, as the rule says.
3. **Municipalities and drawn areas: never rescaled,** because the rule was not tested at that scale.

So the single calendar from 2003 exists for the national totals and for 15 departments (74% of the national activity).

### What this does and does not show

- It shows that, inside 2013-2025, a monthly national factor predicts the national VIIRS total from MODIS with a median error of about 7%.
- It does **not** show that the factor held in 2003-2011. There is no VIIRS then.
- It was not tested at municipality scale. The error there is unknown and is expected to be larger.
- MODIS here is two satellites (Terra and Aqua) against one VIIRS satellite (S-NPP).

### Where it is used

- `scripts/build_dataset.py` runs this test on every build and uses the rule only if the national test passes. If it ever fails, the sensors stay separate.
- `data/processed/harmonization.json` holds the factors, the test error per month and the status of each department.
- The web app draws the MODIS-era days hatched, with the test error of that month.
- `scripts/check_dataset.py` and `npm run verify` check that the rule is applied only where it passed.
