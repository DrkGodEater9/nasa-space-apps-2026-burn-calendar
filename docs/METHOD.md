# Method

How the Colombia Burn Calendar turns the NASA FIRMS hot spots of four satellites into one calendar from 2003 to today. These are the decisions of the Horum Labs team, with the reason for each.

*AI note: the method is the team's. Claude Code wrote this document from the team's text and decisions, and implemented it. A few details that the team text did not fix were set during implementation and then reviewed and confirmed by a team member on November 14, 2026. Those points are marked "(confirmed default)". The first version of this method kept MODIS apart from VIIRS; the single calendar from 2003 was added on November 14, 2026, after the test in [HARMONIZATION.md](HARMONIZATION.md).*

## 1. Quality filters

Discarded:
- VIIRS detections with `low` confidence.
- MODIS detections with confidence below 30. MODIS classes are below 30 low, 30-79 nominal, 80-100 high, the usual FIRMS convention (confirmed default).
- In the historical archive, everything with `type` other than 0: volcanoes, static sources and offshore.
- In near-real-time data, which has no `type`, the cells of a **static-source mask** built from the archive. A cell is in the mask if it ever had `type` 1, 2 or 3, or if it had detections in at least 7 months of one calendar year (confirmed default).

Why: so that the Galeras volcano and the gas flares of Meta and Casanare do not show up as wildfires.

Day and night passes are used together. Why: splitting them would cut the data in two without gaining precision.

## 2. Time and place

- **Local date.** Every detection is moved to Colombian time (UTC-5) before it is assigned to a day. Why: the real error is in the UTC date, which puts evening fires on the next day.
- **1 km grid.** Detections are placed on a common 0.01 degree grid.
- **Municipality.** Each cell belongs to the municipality that contains its center, using the DANE Marco Geoestadístico Nacional 2018. Cells outside every polygon are dropped.
- **Daily values.** Everything is stored per day and per sensor.

Coverage is Colombia only: 33 departments and 1,122 municipality-level areas.

## 3. What is counted

**Hot spots:** the accepted detections of a day. Active 1 km cells (cells with at least one detection) are kept as a second figure.

The first version counted active cells. Both quantities were put through the same test with the same margins, and hot spots had the lower error (6.92% against 8.28%), which was the criterion fixed in advance. See [HARMONIZATION.md](HARMONIZATION.md).

## 4. One reference sensor from 2012

- **VIIRS S-NPP** is the reference from 2012-01-20.
- **VIIRS NOAA-20** fills the days when S-NPP has no data, and those days are flagged. It has the same orbit. This is only possible from 2018-04-01 (confirmed default).
- **VIIRS NOAA-21** is an informational layer. Its history since 2023 is too short for a baseline.
- **Satellites are never summed on the same day.** Why: several satellites see the same fire, so adding them counts it several times.

A day has no data for a sensor when it has zero raw detections in the whole country (confirmed default). The newest days come from the FIRMS API and are merged with the near-real-time files, keeping each detection once.

## 5. MODIS converted to VIIRS units for 2003-2011

VIIRS reports about four times more hot spots than MODIS for the same fires: its pixel is about seven times smaller in area, it detects smaller fires, and it loses less resolution at the swath edges. So the two records cannot be compared directly.

The rule:
- **One factor per calendar month**, at national scale, from the years when both sensors overlap (2013-2025). The factor is the VIIRS S-NPP total of that month divided by the MODIS total. It goes from 3.56 (November) to 5.11 (July).
- **2003-01-01 to 2012-01-19** are MODIS multiplied by that factor.
- **2000-2002 are excluded.** Until mid-2002 only one MODIS satellite (Terra) was flying, so the factor, computed with two satellites, would not apply.

The rule was tested by leaving one year out, with the margins written before the test ran. What follows from the test:

| Where | Result | What is shown |
|---|---|---|
| National totals | Passed (median error 6.9%, margin 15%) | One series from 2003 |
| 14 departments | Passed (margin 30%) | One calendar from 2003 |
| 1 department (Huila) | Above 30%, but not in most months | From 2003, marked low confidence |
| 14 departments | Above 30% in most months | From 2012. MODIS shown raw, in its own view |
| 4 departments | Too few detections to evaluate | From 2012 |
| Municipalities and drawn areas | Not tested at this scale | From 2012 |

The days that come from MODIS are **estimates, not observations**. They are always hatched and labeled "MODIS rescaled to VIIRS units (estimated)", with the test error of that month.

**What cannot be verified:** that the factor of 2013-2025 also held in 2003-2011. VIIRS did not exist then.

## 6. Gaps and uncertainty

The calendar has these states:
- **Zero:** base color.
- **No data:** striped. No satellite observation that day. It is a gap, not a zero.
- **Hot spots:** color scale.
- **Estimated:** hatched. MODIS rescaled to VIIRS units.
- **Filled with NOAA-20:** a dot.

Fixed notices:

> Hot spot = thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide fires: a zero does not guarantee absence of fire. Data from different satellites are never summed on the same day.

> MODIS data (2003-2011) are converted to VIIRS-equivalent units with a different factor for each month, estimated from the years when both sensors overlap (2013-2025). They are estimates, not observations. The error can be larger in regions and months with few detections. The assumption that the factor also holds in 2003-2011 cannot be verified. Data from different satellites are never summed on the same day.

## 7. Unusual activity

For each place and day, the hot spots of that day and the 6 days before it are added up. That 7-day total is compared with the same 7-day totals within 15 days before and after the same date, in every other year since 2012. That gives about 400 windows per place. Neighboring windows overlap, so they are not independent samples, but their percentiles describe the normal range.

| Level | Range |
|---|---|
| Normal | up to the 75th percentile |
| Elevated | 75th to 90th |
| Unusual | 90th to 97.5th |
| Extreme | above the 97.5th |

- **At least 3 hot spots** are needed to call a window unusual or extreme. Why: so that 1 against 0 does not raise an alarm.
- **Insufficient history:** if the baseline has fewer than 10 days with activity, the level is not computed. The place shows its raw count and the level of its department instead.
- A window with 4 or more no-data days is not rated (confirmed default).
- **Alerts use VIIRS from 2012 only.** The MODIS era has its own "internal anomaly", computed the same way against 2003-2011 only. It is never shown as a current alert or compared with the VIIRS levels.

**Month against its history.** Each month is compared with the median of the same month in the other years since 2012, as a ratio ("2.3x normal") and a percentile. The current, unfinished month is compared with the same days of that month in the other years, never with whole months.

## 8. Drawn areas

Data are counted per municipality. A drawn polygon or box is answered with the municipalities that have at least 25% of their area inside it, counted in full. The list of municipalities and the share of each inside the shape are always shown. For several municipalities, the level of a day is the highest among them.

## 9. Validation

Two separate checks, described in their own documents:
- **The harmonization rule** is tested by leaving one year out: [HARMONIZATION.md](HARMONIZATION.md).
- **The data pipeline** (reading the NASA files, the filters, the boundaries) is checked by reproducing the totals IDEAM publishes: [VALIDATION.md](VALIDATION.md).

## Limits

- The MODIS era is an estimate, tested only inside 2013-2025.
- The conversion error is larger where there are few detections, and was not measured below department scale.
- A hot spot is one detection, not one fire. A large fire produces several.
- Satellites pass a few times a day. Short fires between passes, and fires under cloud or smoke, are missed.
- A MODIS day with zero detections in the whole country is marked "no data". For MODIS some of those 196 days in 2003-2012 may be true zeros.
- The newest days are near-real-time data, which FIRMS later replaces with standard processing.
- Other boundary versions move some detections between neighboring departments.
