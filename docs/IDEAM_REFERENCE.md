# IDEAM hot spot figures (2023 and 2024)

*AI note: the figures were extracted from the official IDEAM reports with the help of AI assistants (Claude). No figure was invented or estimated. Values read from charts are marked as such. Extraction date: November 14, 2026.*

Intended use: validate our own FIRMS counts (MODIS and VIIRS) for Colombia. See [VALIDATION.md](VALIDATION.md).

## 1. Documents

Repository page: <https://www.ideam.gov.co/sala-de-prensa/informes/Reporte-semestral-de-Incendios-de-la-Cobertura-Vegetal>

| Title | Published on the IDEAM site | URL |
|---|---|---|
| Semester report on vegetation cover fires, through hot spots and registered events. First semester 2023 (Publication No. 01) | May 29, 2026 | <https://www.ideam.gov.co/file-download/download/public/20672> |
| Same. Second semester 2023 (Publication No. 02 inside) | May 30, 2026 | <https://www.ideam.gov.co/file-download/download/public/20673> |
| Same. First semester 2024 (Publication No. 03) | May 31, 2026 | <https://www.ideam.gov.co/file-download/download/public/20676> |
| Same. Second semester 2024 (Publication No. 04 inside) | June 1, 2026 | <https://www.ideam.gov.co/file-download/download/public/20678> |

Each PDF has 10 pages. The hot spot data is on page 4 of each one: a text box with the national total and the top-5 departments, and a bar chart with the **top 10** departments. Minor note: the covers of 2023-S2 and 2024-S2 say "Publication No. 01", while the inside says No. 02 and No. 04.

The files in this repository are in `data/processed/`:
- `ideam_semester_national.csv`: the four national totals.
- `ideam_semester_departments.csv`: 40 department values (top 10 of each semester), with the DANE department code, the value in the report text when it has one, and the source.

## 2. Resolution available

**Semester only, not monthly.** The reports have no monthly figures. By department they give only the top 10 of each semester (the first 5 also appear in the text; places 6 to 10 only in the chart). The map and the other charts do not give department figures.

## 3. National totals

| Period | Total | Type |
|---|---:|---|
| 2023, semester 1 | 156,655 | Reported |
| 2023, semester 2 | 53,665 | Reported (IDEAM: -65.7% versus the previous semester) |
| 2023, annual | 210,320 | Computed by us: sum of the two semesters |
| 2024, semester 1 | 168,208 | Reported (IDEAM: +7.37% versus the first semester of 2023) |
| 2024, semester 2 | 57,205 | Reported (IDEAM: +6.6% versus the second semester of 2023) |
| 2024, annual | 225,413 | Computed by us: sum of the two semesters |

IDEAM does not report an annual total in these documents; the annual rows are our sums. Consistency check (ours): the percentage changes IDEAM reports agree with its totals: (156,655-53,665)/156,655 = 65.7%; 168,208/156,655 = +7.37%; 57,205/53,665 = +6.6%.

## 4. Top 10 departments per semester

Read from the bar chart on page 4 (the first five also in the text).

| # | 2023-S1 | 2023-S2 | 2024-S1 | 2024-S2 |
|---:|---|---|---|---|
| 1 | Vichada 29,129 | Vichada 14,997 | Vichada 32,555 | Vichada 15,440 |
| 2 | Meta 24,294 | Meta 8,291 | Meta 30,796 | Meta 10,317 |
| 3 | Bolívar 12,059 | Casanare 2,993 | Casanare 13,003 | Casanare 4,870 |
| 4 | Cesar 11,115 | Tolima 2,901 | Caquetá 12,888 | Tolima 3,584 |
| 5 | Casanare 10,929 | Cesar 2,499 | Bolívar 11,960 | Caquetá 2,818 |
| 6 | Magdalena 9,948 | Norte de Santander 2,289 | Magdalena 9,460 | Arauca 2,281 |
| 7 | Antioquia 8,651 | La Guajira 2,216 | Guaviare 8,120 | Cauca 2,079 |
| 8 | Guaviare 8,535 | Antioquia 1,975 | Arauca 8,111 | Putumayo 1,897 |
| 9 | Caquetá 6,847 | Bolívar 1,628 | Antioquia 7,964 | Huila 1,729 |
| 10 | Arauca 6,460 | Cauca 1,605 | Cesar 7,920 | Norte de Santander 1,569 |

**An inconsistency inside the IDEAM report.** For 2024-S2 the text says Casanare has **4.070** hot spots, while the chart says **4870**. The two other values around it agree between text and chart. The CSV uses the chart value (4870) and keeps the text value in its own column with a note. Our own count (4,873) agrees with the chart, so the text looks like a typing slip.

The chart values were read from the rendered page images, so a misread digit is possible. All 20 values that also appear in the text were checked against it, and 19 match exactly.

The DANE department codes in the CSV were checked by matching the names against the official 2018 department boundaries in `data/processed/dane_mgn2018_departamentos.geojson`.

## 5. Methodology described by IDEAM

What the reports say (pages 2 and 4):
- Source: "the NASA FIRMS platform, which provides hot spot data from the MODIS and VIIRS sensors".
- Method: "cartographic analysis of the density of hot spots detected by the MODIS and VIIRS satellites", combined with layers of departments, national protected areas and ecosystems (the ecosystem map is the *Mapa de ecosistemas continentales, costeros y marinos de Colombia*, IDEAM 2017, scale 1:100,000, according to the footnote).
- Fire events in vegetation cover come from the records of the Regional Environmental Authorities, the large urban centers, UNGRD and National Parks, consolidated in an IDEAM database. This is separate from the hot spots.

What the four reports do **not** say (searched the text for: NRT, near real time, confidence, UTC, local time, volcano, fixed source, MGN, DANE, S-NPP, NOAA, Suomi, processed, comparab-, filter, threshold, resolution; no matches):
- Which VIIRS satellites it uses, or whether it mixes MODIS and VIIRS in one count.
- Whether it uses archive (processed) or near-real-time data.
- Which confidence filters it applies.
- Whether it discards volcanoes, static sources or other non-vegetation detections.
- Which MGN version it uses, or how each point is assigned to a department.
- Whether it uses the UTC date or the Colombian local date.
- Any caveat on comparability (for example between hot spots and field records).

Our comparison infers part of this (see [VALIDATION.md](VALIDATION.md)): the counts match when MODIS, VIIRS S-NPP and VIIRS NOAA-20 are summed using archive detections of `type = 0`. That is an inference from the match, not something IDEAM states.

## 6. Not found or ambiguous

- Counts by department and month for 2023 and 2024: not found. The reports are semester only.
- Counts for all departments: not found; only the top 10 of each semester.
- Detailed methodology (filters, NRT or archive, VIIRS satellites, MGN version, UTC or local date): not found.
- An IDEAM monitoring dashboard with monthly series: not found in the search. A search result suggested that IDEAM keeps a monthly base by department and municipality and publishes "national overview" presentations, but this was not verified and data.gov.co was not reviewed in depth.
