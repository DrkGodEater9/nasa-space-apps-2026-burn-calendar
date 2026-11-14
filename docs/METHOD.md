# Harmonization method (Step 5)

These are the decisions of the Horum Labs team. The choices and their reasons are ours.

*AI note: Claude Code only transcribed and formatted this document from the team's text, and checked against the CSV files that the `type` and `confidence` columns exist as described. It did not propose the method. The "Implementation decisions" section at the end lists defaults that were filled in while writing the code, because the team text left them open. They need team confirmation.*

## 1. Quality

Discarded:
- VIIRS detections with `low` confidence (`l`).
- MODIS detections with confidence below 30.
- In the historical archive, everything with `type` other than 0 (volcanoes, static sources, offshore).
- In near-real-time (NRT) data, the cells of a **static-source mask** built from the historical archive. A cell enters the mask if it ever had `type` 1, 2 or 3 (active volcano, other static source, offshore), or if it had detections in more than 50% of the months of a year. Why: so that Galeras and the gas flares in Meta and Casanare do not show up as wildfires.

Confidence: three common classes (low, nominal, high). Nominal and high are used; low never enters.

Day and night: both are used together, not separated. The date of each detection is converted to Colombian time (UTC-5) before aggregating. Why: splitting would cut the data in two without gaining precision; the real error is in the UTC date.

## 2. Spatial and temporal scale

- **Unit of measurement:** active cells on a common 1 km grid (0.01 degrees). A cell is active if it has at least one detection that day. Counted per sensor. Why: a large fire stops counting as 8 VIIRS points, and duplicates from overlapping passes disappear by themselves.
- **Municipality assignment:** by the centroid of the cell, using the current DANE MGN, in a fixed and documented version.
- **Time:** stored per day, and the calendar shows days. The anomaly is computed on a rolling sum of 7 days. There is also a monthly summary.
- **Duplicates between satellites:** never summed. Each sensor is handled separately (section 3).

## 3. Comparability between sensors

- Counts are never summed across sensors.
- **Reference sensor:** VIIRS S-NPP from 2012. Days when S-NPP has no data are filled with NOAA-20 (equivalent orbit) and flagged.
- **NOAA-21:** informational layer only; its history is too short to be a baseline.
- **MODIS:** long history only. It does not generate current alerts.
- **Why VIIRS gives about 4 times more:** its pixel is about 7 times smaller in area, so one fire appears as several points; it detects smaller fires; and it loses less resolution at the swath edges. Counting 1 km cells reduces the gap, and comparing each sensor against its own history removes it.

## 4. MODIS-only period

- 2000-2002 is excluded (only Terra was flying and there are gaps).
- 2003-2011 is shown in a separate view, "Long history (MODIS)", with a notice. No VIIRS equivalent is estimated.
- Comparability starts in 2012. Every alert and anomaly uses VIIRS from 2012.

## 5. Gaps and uncertainty

The calendar has three states:
- **Zero:** light base color.
- **No data:** striped gray. Days without a file, or with a sensor outage in both VIIRS sources.
- **Detections:** color scale.

**Little data:** if the municipality baseline has fewer than 10 active days in the season window, the anomaly is not computed. The municipality is shown in neutral gray with the raw count, the label "insufficient history", and the department anomaly as a fallback.

Fixed notice:

> Hot spot = thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide fires: a zero does not guarantee absence of fire. Data from different satellites are not summed.

## 6. Unusual activity

The sum of active cells over the last 7 days is compared with the same 7-day windows, within +-15 days around the same date, in every year since 2012 except the current one (about 400 samples per municipality).

| Level | Range |
|---|---|
| Normal | up to P75 |
| Elevated | P75 to P90 |
| Unusual | P90 to P97.5 |
| Extreme | above P97.5 |

Minimum floor: at least 3 active cells are needed to flag an unusual or extreme level.

Current month: compared with the median of the same month in the history, showing the ratio ("2.3x normal") and the percentile.

## 7. Validation

- VIIRS S-NPP is used with raw detections (not cells), with the same filters and boundaries that IDEAM uses. Compared by department and month in 2023-2024.
- First step: confirm which source and filters IDEAM uses. Its exact method is not known, and the validation only makes sense if it is replicated.
- **Pass criteria:** at least 90% of department-month pairs within +-10%, and the annual national total within +-5%.
- **Accepted differences (documented):** UTC date versus local date, MGN version, static-source mask, NRT versus the historical archive. Any other difference is an error to fix.

## Consequences

- **Hand-drawn polygon:** the municipalities with at least 25% of their area inside the polygon are used. The list of municipalities and the percentage covered are always shown.
- **Nariño:** Galeras is left out by the mask. Municipalities without enough history use the department fallback. The daily calendar is shown, but alerts come from the monthly or department level.

## Implementation decisions (defaults chosen while coding, pending team confirmation)

The team text left these open. The code uses the defaults below and they are written into `data/processed/build_info.json`.

1. **MODIS confidence classes:** below 30 is low (discarded), 30-79 nominal, 80-100 high. This follows the usual FIRMS convention.
2. **Static-source mask:** built from archive detections of all four sensors combined, after the quality filters (`type = 0`, not low confidence). A cell is in the mask if, in any calendar year, it had detections in at least 7 distinct months (more than 50% of 12), or if it ever had `type` 1, 2 or 3 in the archive. Types 1 and 3 were added after the first build showed that Galeras (a volcano, `type = 1`) was not covered by `type = 2` alone. The mask is applied to NRT data only, as decided.
3. **NOAA-20 fill:** only possible from 2018-04-01. Before that, a day without S-NPP data stays "no data".
4. **No-data day:** a sensor has no data on a local day if it has zero raw detections in the whole country that day. A day is "no data" in the reference series when neither S-NPP nor NOAA-20 has data. The first and last local days of each sensor are dropped because they are only partly covered.
5. **7-day window:** the day itself plus the 6 days before it. A window with 4 or more no-data days is not computed.
6. **Baseline windows:** the same calendar date +-15 days in every other year since 2012 (29 February maps to 28 February). Because neighboring days overlap, the roughly 400 samples are not independent. The percentiles are still useful, but this should be stated.
7. **Insufficient history:** fewer than 10 days with at least one active cell in the baseline season window.
8. **Municipality assignment:** by the cell centroid with the 2018 MGN. Cells whose centroid falls outside every polygon are dropped, and the count is reported in the build info.
9. **Validation:** IDEAM only publishes semester figures (national total and top 10 departments), so the monthly department comparison in section 7 could not be done. It was replaced by a semester comparison: national total within +-5% in every semester and at least 90% of the 40 department values within +-10%. Both are met. The team must confirm this change of criteria. See [VALIDATION.md](VALIDATION.md).
10. **Newest days:** the most recent days come from the FIRMS area API (`*_NRT` sources) and are merged with the NRT files, keeping each detection once. VIIRS S-NPP has no data after 2026-11-01, so those days are filled with NOAA-20 as the method says.
