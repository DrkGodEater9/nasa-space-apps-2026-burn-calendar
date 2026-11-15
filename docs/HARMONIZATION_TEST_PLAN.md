# Harmonization rule and its test plan

**Written on 2026-11-14 at 21:55 (Colombia time), before any test error was computed.** The numbers in this file are not to be changed after the test runs. Results go in [HARMONIZATION_RESULTS.md](HARMONIZATION_RESULTS.md).

*AI note: the rule, the margins and the fallback below were written by the Horum Labs team (answers dated November 14, 2026). Claude Code translated them to English, formatted them, and implemented them. The AI did not propose the rule. Where the team text left a detail open, the reading used is listed in "Open details" and marked as pending team confirmation.*

*What had been seen before writing this file: the descriptive ratios VIIRS S-NPP / MODIS by year, calendar month and department (they are what the team decided from). No leave-one-year-out error had been computed.*

## Why

The challenge asks for one burn calendar from the early 2000s to today on a harmonized dataset, where the sensor of origin no longer matters. Until now the project kept the sensors apart: VIIRS from 2012 as the reference, and MODIS 2003-2011 in a separate view.

## The rule (team decision)

1. **Start year: 2003.** It is the first full year with Terra and Aqua together (Aqua starts on 2002-07-04). 2000-2002 stay excluded: until mid-2002 only Terra was flying and there are gaps. The web app says so in a note.
2. **Quantity:** active 1 km cells per day. Whether cells or raw detections are used is settled by the test below: both are tested, and the one with the lower error is kept, with the same margins. If cells are kept, that is declared as a design choice and not as a stability result.
3. **Data that relate the sensors:** the overlap of MODIS and VIIRS S-NPP, 2013 to 2025.
4. **Spatial unit:** one factor computed at national scale.
5. **Not the same all year:** one factor per calendar month, computed with the national data of 2013 to 2025.
6. **MODIS era in the calendar (2003-2011):** MODIS values converted to VIIRS-equivalent units with the monthly factor, drawn with another color or pattern, labeled "MODIS rescaled to VIIRS units (estimated)", and visually separate from what VIIRS observed.
7. **Uncertainty shown to the user:** the band comes from the error of the test, measured at the granularity that is shown (for example month and region), not from the national annual range. A visible sentence: "The error can be larger in regions and months with few detections."
8. **Anomalies in the MODIS era:** not computed against the VIIRS baseline. They are computed against the MODIS era itself (2003-2011), with the same +-15 day windows and the same percentiles, shown as "internal anomaly of the MODIS era", with no current alerts and not compared with those of the VIIRS era.
9. **2003-2011 assumption:** that the 2013-2025 ratio also held before cannot be verified, because there is no VIIRS then. It is declared as an unverifiable assumption, and that era is marked as lower confidence on the method page.
10. **Different satellites are still never summed on the same day.**

## The test (team decision)

**Leave one year out.** For each year from 2013 to 2025: estimate the monthly factor with the other twelve years, apply it to the MODIS cells of the withheld year, and compare with what VIIRS S-NPP observed that year. The error is computed per month at national scale, and per department and month.

**Margins, fixed here before running:**
- National: up to **15%** median absolute error in the national monthly total.
- Department and month: up to **30%**.
- **Small counts:** a department-month enters the 30% criterion only if VIIRS observed at least **30 cells** in it. Below that it is marked "insufficient data to evaluate".

**Departments that fail the 30%:** shown in the calendar as a harmonized value of low confidence, with a pattern or marker and the note "estimated error above 30%". If the failure repeats in most months, the department is shown with VIIRS data from 2012 only, and MODIS stays in the separate view.

**Choosing the quantity:** the winner between cells and detections is the one with the lower national monthly median absolute error.

**If the test fails or there is no time:** the sensors stay separate as they are today, with MODIS in the "Long history" view and without rescaling, declared as a limitation.

## Open details (readings used, pending team confirmation)

The team text does not settle these four points. To avoid choosing after seeing the result, the readings are fixed here, and where two readings exist both are reported and the stricter one decides.

- **h. "Median absolute error" at national scale.** Two readings: (h1) the median over all 156 withheld year-months; (h2) the median for each calendar month over its 13 years, required in all 12 months. **Both are reported. The rule passes only if both pass.**
- **i. What rejects the whole rule.** The phrase "large error in several years, or a ratio that varies a lot" has no number. Reading used: the whole rule is rejected only if the national criterion (h) fails. The error of every withheld year is reported so the team can judge the phrase itself.
- **j. "Most months" for a department.** Reading used: more than half of the calendar months in which the department has at least one evaluable department-month (30 cells or more) have a median error above 30%.
- **k. Minimum count if detections win.** Not defined by the team. If detections win, the implementation stops and the team is asked.

## How the factor is computed

For a calendar month `m`: `factor[m] = (sum of S-NPP cells in month m over the training years) / (sum of MODIS cells in month m over the same years)`, at national scale. It is a ratio of totals, the same definition as the descriptive table the team decided from. "Cells" means the sum over municipalities and days of active 1 km cells, after the quality filters of METHOD.md. S-NPP means S-NPP only, without the NOAA-20 fill.

The error of a prediction is `abs(predicted - observed) / observed`, with observed = S-NPP.
