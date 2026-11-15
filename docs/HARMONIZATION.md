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
3. **Municipalities and drawn areas: never rescaled,** because the rule was not tested at that scale. *Replaced on November 15 by Part 5: shown with the factor of their department and a low-confidence warning.* Decision 2 was replaced the same way.

So the single calendar from 2003 exists for the national totals and for 15 departments (74% of the national activity). *Superseded on November 15 by version 2 (Parts 3 and 4): 17 departments.*

### What this does and does not show

- It shows that, inside 2013-2025, a monthly national factor predicts the national VIIRS total from MODIS with a median error of about 7%.
- It does **not** show that the factor held in 2003-2011. There is no VIIRS then.
- It was not tested at municipality scale. The error there is unknown and is expected to be larger.
- MODIS here is two satellites (Terra and Aqua) against one VIIRS satellite (S-NPP).

### Where it is used

- `scripts/build_dataset.py` runs this test on every build and uses the rule only if the national test passes. If it ever fails, the sensors stay separate.
- `data/processed/harmonization.json` holds the factors, the test error per month and the status and level of each department.
- The web app draws the MODIS-era days hatched, with the test error of that month.
- `scripts/check_dataset.py` and `npm run verify` check that the rule is applied only where it passed.

---

## Part 3. Department factor (version 2): fixed before the test

**Written on 2026-11-15 at 11:59 (Colombia time), before any version 2 test error was computed.** The team chose the method. At that point only the version 1 results above, and the descriptive department ratios in Part 2, had been seen. The numbers in this part were not changed afterwards.

**Why.** The national factor fails in departments where VIIRS and MODIS relate differently (Part 2). Version 2 gives each department its own level and keeps the national monthly shape.

### The rule (changes from Part 1 only)

1. **Factor of department d in calendar month m:** `f[d,m] = f_nat[m] × (R_d / R_nat)`.
   - `f_nat[m]` is the national factor of Part 1.
   - `R_d` = S-NPP total of department d over all months of the training years / MODIS total of department d over the same months (a ratio of totals).
   - `R_nat` is the same ratio for the whole country.
2. **Departments with little data keep the national factor:** if the training years hold fewer than **100** MODIS detections or fewer than **100** S-NPP detections in the department, then `f[d,m] = f_nat[m]`.
3. **National series:** unchanged. The national total keeps the national factor, and the national criterion (15%, both readings) is unchanged.
4. **Quantity:** detections, as decided on November 14. Active cells are computed and reported only.
5. **Municipalities and drawn areas:** still never rescaled. *(Replaced later the same day by Part 5.)*

### The test

The same leave-one-year-out test as Part 1. For each withheld year, `f_nat`, `R_d` and `R_nat` are all recomputed with the other twelve years only. The department margin (30%), the minimum of 30 S-NPP detections per department-month, the reading of "most months" and the three statuses (`ok`, `low_confidence`, `viirs_only`) are unchanged.

### Which version is used

- Version 2 applies to **every** department or to none. There is no choosing per department whichever version gave the lower error.
- **Version 2 replaces version 1 only if it shows more departments from 2003** (status `ok` plus `low_confidence`) than version 1 (15). On a tie or fewer, version 1 stays.
- Both results are reported here, whichever wins.

## Part 4. Version 2 results

Same national test (unchanged, passes). Department criterion, margin 30%:

| | Cells v1 | Cells v2 | Detections v1 | Detections v2 |
|---|---:|---:|---:|---:|
| Department-months within 30% | 44.7% | 55.6% | 50.5% | 57.1% |
| Median department-month error | 34.0% | 25.5% | 29.7% | 24.8% |
| Within the margin (`ok`) | 10 | 13 | 14 | 16 |
| Low confidence | 1 | 0 | 1 | 1 |
| Above 30% in most months | 18 | 16 | 14 | 12 |
| Too few detections | 4 | 4 | 4 | 4 |
| **Shown from 2003** | 11 | 13 | **15** | **17** |

**Decision by the rule of Part 3: version 2 is used** (17 departments shown from 2003 against 15, with detections).

With detections, version 2:
- **Within the margin (16):** Antioquia, Arauca, Casanare, Cesar, Chocó, Córdoba, Guainía, Guaviare, La Guajira, Magdalena, Meta, Norte de Santander, Tolima, Valle del Cauca, Amazonas, Vichada.
- **Low confidence (1):** Vaupés.
- **Above 30% in most months (12):** Atlántico, Bolívar, Boyacá, Caldas, Caquetá, Cauca, Cundinamarca, Huila, Nariño, Putumayo, Santander, Sucre.
- **Too few detections (4):** Bogotá, Quindío, Risaralda, San Andrés.

**What changed, department by department:**
- **Gained (5):** Magdalena (30.1% → 22.8%), Tolima (38.1% → 27.8%), Valle del Cauca (37.5% → 25.2%), Amazonas (33.8% → 29.5%) and Vaupés (39.1% → 32.9%, low confidence).
- **Lost (3):** Caquetá (27.9% → 32.7%, now above 30% in 10 of 12 months), Caldas (23.0% → 41.8%, only 6 evaluable calendar months) and Huila (low confidence → above 30% in 8 of 11 months).
- **Still failing:** Bolívar improves (44.0% → 30.4%) but stays above 30% in 7 of 12 months. Nariño gets worse (42.1% → 55.4%) on few evaluable months (7 calendar months).
- **Caquetá is the costliest loss.** It holds 6.8% of the S-NPP detections of 2013-2025. Its level (0.86) lowers its factor, and the test says that does not predict it better than the national factor. The rule of Part 3 does not allow keeping version 1 for Caquetá alone.

**Share of activity covered.** The departments shown from 2003 hold about the same share of the S-NPP detections of 2013-2025 in both versions: 78.0% in version 1 and 77.6% in version 2. Version 2 shows more departments, not more fire activity. (The 74.3% of Part 2 could not be reproduced from the processed tables with any of the definitions tried. The figure above is the share of S-NPP detections, 2013-2025.)

Per-department detail of both versions: `data/processed/harmonization_version_comparison.csv`.

**How much better any factor could do (diagnostic only, not used).** After version 2, two "oracle" factors were computed that know the year being predicted, so no honest method can beat them. A factor per department and month fitted on all 13 years, including the predicted one, gives a median department-month error of 20.7% and 25 departments shown. A perfect factor per department and year gives 23.0% and 22. So about 20% is the noise floor between the two sensors at department and month scale (clouds, overpass times, small fires seen by one sensor and not the other), and an honest method would add at most a few departments to version 2. Boyacá, Nariño, Sucre and Vaupés stay above 30% even with the first oracle. The ratio VIIRS/MODIS varies about 4% from year to year in Meta and Vichada, against 14% in Bolívar and 30% in Nariño. No third version was tested.

---

## Part 5. Every area from 2003: team decision after the results (November 15, 2026)

**This is a change of what is shown, taken after the results were known.** The method (version 2) and the test are unchanged.

**Why.** The challenge asks for one calendar from the early 2000s to today on the harmonized dataset, for the region the user chooses, and for the current month compared with the historical median of that area. Until this decision only 17 departments and the national totals had it. The team chose to show it everywhere and to say clearly, area by area, how far the estimate was tested.

**What changes:**
1. **Every area shows the MODIS era (2003-01-01 to 2012-01-19)** inside the single calendar, always hatched and labeled as an estimate.
   - Departments `ok`: as before, with the test error of each month.
   - Departments `low_confidence`, `viirs_only` (failed the test) and `insufficient`: shown with a visible **low-confidence warning**. The failed ones show their test error (above 30% in most months); the insufficient ones say the error is unknown.
   - Municipalities and drawn areas: each municipality uses the factor of its department (`factor[m] × level`). Shown with the warning **"not tested at this scale: the error is unknown"**. This replaces the decision of November 14, "municipalities and drawn areas: never rescaled".
2. **Monthly comparison from 2003.** The month is compared with the same month (or, for the current unfinished month, the same days) in every other year since 2003: VIIRS from 2012, MODIS rescaled for 2003-2011. Only windows that lie entirely before 2012-01-20 are taken from the MODIS era, so no window mixes the two sensors. MODIS no-data days count as zero, as VIIRS no-data days do.
3. **Internal anomalies of the MODIS era** are computed for every department with MODIS data, not only those that passed. Municipalities and drawn areas have none.
4. **Unchanged:** the daily alert levels (unusual, extreme) use VIIRS since 2012 only. The national series keeps the national factor. Different satellites are never summed on the same day.

**What this costs.** In departments that failed and at municipality scale, the 2003-2011 estimates and the medians that use them can be off by more than 30%, and at municipality scale nobody knows by how much. The warnings say so where the numbers are shown. The test results of Parts 2 and 4 stay as they were: this decision does not make any department pass.
