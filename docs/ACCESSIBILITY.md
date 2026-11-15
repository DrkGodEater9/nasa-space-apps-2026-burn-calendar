# Accessibility of the color scales

*AI note: the test script, the color search and this document were written with the help of an AI assistant (Claude Code). The numbers below are the output of `npm run a11y` (in `web/`), not estimates. The thresholds were written into the script before its first run.*

The challenge suggests accessible color scales. This page says what was tested, what failed, what was changed, and what was not tested. It does not claim full WCAG conformance.

## How to run it

```bash
cd web
npm run a11y
```

It exits with an error if a check fails, so it can guard future color changes. The color math is in `web/scripts/color-metrics.ts` and the checks in `web/scripts/check-accessibility.ts`.

## Methods and thresholds

| What | Method | Threshold |
|---|---|---|
| Color vision deficiency | Machado, Oliveira and Fernandes (2009) simulation matrices, severity 1.0, applied in linear RGB, for protanopia, deuteranopia and tritanopia | - |
| Difference between two colors | CIEDE2000 (Sharma, Wu and Dalal 2005). The implementation is checked against two published test pairs on every run (2.0425 and 27.1492) | Neighboring classes at least **10** for every type of vision |
| Order of the sequential scale | CIE L* lightness must grow with the value for every type of vision | Strictly increasing |
| Text contrast | WCAG 2.1 relative luminance, success criterion 1.4.3 | **4.5:1** |
| Calendar classes against the panel | WCAG 2.1, success criterion 1.4.11 (graphical objects) | **3:1** |

The value 10 for neighboring classes is a convention of this project, not a standard. About 2.3 CIEDE2000 units is a just-noticeable difference for large patches side by side. The calendar squares are 11 pixels and are not always next to each other, so several times that was required.

## Result of the first run: the original scale failed

The original scale had six classes sampled from "inferno": `#5c1a7a #8f2469 #c33b4f #e9622c #fa9a12 #f8d348`.

| Check | Result |
|---|---|
| Normal vision, smallest step | 14.2. Pass |
| **Protanopia, smallest step** | **6.8** (classes 1 and 2). **Fail** |
| **Deuteranopia, smallest step** | **8.3** (classes 5 and 6). **Fail** |
| Tritanopia, smallest step | 11.4. Pass |
| Lightness order | Increasing for all four. Pass |
| **Class 1 against the panel** | **1.60:1. Fail** |
| **Class 2 against the panel** | **2.22:1. Fail** |
| **Label "Extreme" (white on `#e5383b`)** | **4.23:1. Fail** |
| Other text and labels | Pass |
| Anomaly level colors, closest pair | 10.1 (deuteranopia). Pass |

## What was changed

**The sequential scale now has four classes**, still from "inferno": `#b73557 #eb6628 #fcb418 #fcffa4`.

To find it, 920 six-class, 3,450 five-class and 3,450 four-class candidates were sampled from five perceptually uniform palettes (inferno, magma, plasma, viridis, cividis) and scored with the same script. On the dark panel no six-class or five-class candidate met both conditions at once (steps of 10 for every type of vision, and 3:1 against the panel): the best reached 7.5 and 9.3. With six classes the steps reach 10 only if the darkest class has 1.6:1 against the panel. Four classes meet everything, so four were chosen. The exact value of each day is still in the tooltip, the year totals and the CSV.

**The label "Extreme"** now uses dark text (`#1a0203`) on the same red.

**The hatch of the estimated days** (MODIS rescaled to VIIRS units) was changed from white lines to dark and light lines side by side, because white lines disappear on the lightest class. This was a visual judgment, not a measured check.

## Result after the change

| Check | Normal | Protanopia | Deuteranopia | Tritanopia |
|---|---:|---:|---:|---:|
| Smallest step between neighboring classes (needs 10) | 24.4 | 17.5 | 13.5 | 15.4 |
| Lightness L* of zero and the four classes | 13, 43, 59, 78, 98 | 14, 36, 52, 74, 96 | 13, 47, 63, 80, 97 | 13, 43, 58, 75, 97 |
| Closest pair of anomaly level colors (needs 10) | 18.1 | 15.8 | 10.1 | 10.2 |

| Contrast | Result | Needs |
|---|---:|---:|
| Main text on the panel | 14.98:1 | 4.5:1 |
| Secondary text on the panel | 9.68:1 | 4.5:1 |
| Muted text on the panel | 5.71:1 | 4.5:1 |
| Level labels on their own color | 4.71:1 to 10.55:1 | 4.5:1 |
| Class 1 against the panel | 3.10:1 | 3:1 |
| Classes 2, 3 and 4 against the panel | 5.48:1, 9.90:1, 16.93:1 | 3:1 |

Two of these pass narrowly: the anomaly level colors under deuteranopia and tritanopia (10.1 and 10.2), and class 1 against the panel (3.10:1).

The zero class (`#1a2232`) has 1.12:1 against the panel on purpose: it is the empty state. What must be visible is the difference between zero and the first class, which is 37.1 CIEDE2000 units.

## Information never depends on color alone

The script also checks that these cues exist in the source and in the legend:

- No-data days are striped.
- Estimated days (MODIS rescaled to VIIRS units) are hatched.
- Days filled with NOAA-20 carry a dot.
- Unusual and extreme days are outlined.
- The tooltip states the value and the level in words.
- The calendar can be reached and moved with the keyboard and has an accessible name.
- Keyboard focus is visible, and the reduced-motion preference is respected.

These are checks that the code is present, not tests with users.

## Not tested

- Real screen readers (NVDA, JAWS, VoiceOver). The calendar is drawn as one image with an accessible name and a tooltip; a screen reader user gets the numbers from the CSV downloads and the text panels, not from the individual squares.
- People with color vision deficiency. The simulation is a model.
- The map colors and the basemap, which come from the CARTO style.
- Anomalous trichromacy at partial severity, low vision, and high-contrast modes.
- The legibility of the two-tone hatch at small sizes, beyond looking at it.
- Mobile screens.
