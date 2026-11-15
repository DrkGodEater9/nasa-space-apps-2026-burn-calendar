// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Accessibility checks of the color scales, run with: npm run a11y
// It fails (exit code 1) if a scale loses distinction for a color vision deficiency, if the
// lightness order of the sequential scale breaks, or if a text color is below WCAG contrast.
//
// Methods:
//  - Color vision deficiency: Machado, Oliveira and Fernandes (2009), "A Physiologically-based Model
//    for Simulation of Color Vision Deficiency", severity 1.0 matrices, applied in linear RGB.
//  - Color difference: CIEDE2000 (Sharma, Wu and Dalal 2005). The implementation is checked against
//    two pairs of their published test data before anything else runs.
//  - Contrast: WCAG 2.1 relative luminance. Text 4.5:1 (SC 1.4.3), graphical objects 3:1 (SC 1.4.11).
//
// Thresholds (fixed before the first run, see docs/ACCESSIBILITY.md):
//  - MIN_STEP = 10: neighboring classes of a scale must differ by at least 10 CIEDE2000 units for
//    every type of vision. About 2.3 is a just-noticeable difference for large patches side by
//    side; the calendar squares are 11 px and are not always adjacent, so several times that is
//    required. This is a convention of this project, not a standard.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CELL_RAMP, CELL_ZERO, LEVELS, NO_ACTIVITY } from '../src/lib/colors.ts';

const MIN_STEP = 10;
const TEXT_CONTRAST = 4.5;
const GRAPHIC_CONTRAST = 3;

import { ciede2000, contrast, hex, lab, linear, simulate } from './color-metrics.ts';

let failures = 0;
const report: string[] = [];
const say = (s: string) => { report.push(s); console.log(s); };
const check = (ok: boolean, label: string) => { say(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };

// ---- 0. the CIEDE2000 implementation reproduces published test pairs
const t1 = ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485]);
const t2 = ciede2000([50, 2.5, 0], [73, 25, -18]);
check(Math.abs(t1 - 2.0425) < 0.001 && Math.abs(t2 - 27.1492) < 0.001, `CIEDE2000 implementation matches the published test data (${t1.toFixed(4)}, ${t2.toFixed(4)})`);

const VISIONS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
const seen = (h: string, kind: string) => lab(simulate(linear(hex(h)), kind));

// ---- 1. sequential scale: zero + ramp
say(`\nSequential scale (zero, then the ${CELL_RAMP.length} classes): CIEDE2000 between neighbors, and lightness L*`);
const scale = [CELL_ZERO, ...CELL_RAMP];
for (const kind of VISIONS) {
  const labs = scale.map((h) => seen(h, kind));
  const steps = labs.slice(1).map((l, i) => ciede2000(labs[i], l));
  const light = labs.map((l) => l[0]);
  say(`  ${kind.padEnd(13)} steps ${steps.map((s) => s.toFixed(1)).join('  ')}   L* ${light.map((l) => l.toFixed(0)).join(' ')}`);
  check(Math.min(...steps) >= MIN_STEP, `${kind}: every neighboring step is at least ${MIN_STEP} (smallest ${Math.min(...steps).toFixed(1)})`);
  check(light.every((l, i) => i === 0 || l > light[i - 1]), `${kind}: lightness grows with the value, so the order survives without hue`);
}

// ---- 2. anomaly levels: every pair must stay apart
say('\nAnomaly levels (no activity, normal, elevated, unusual, extreme, insufficient): smallest pairwise CIEDE2000');
const levels = [NO_ACTIVITY, ...LEVELS];
for (const kind of VISIONS) {
  let worst = Infinity;
  let pair = '';
  for (let i = 0; i < levels.length; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const d = ciede2000(seen(levels[i].color, kind), seen(levels[j].color, kind));
      if (d < worst) { worst = d; pair = `${levels[i].key} / ${levels[j].key}`; }
    }
  }
  check(worst >= MIN_STEP, `${kind}: closest pair is ${pair} at ${worst.toFixed(1)} (needs ${MIN_STEP})`);
}

// ---- 3. contrast
const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'), 'utf8');
const cssVar = (name: string) => { const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)); if (!m) throw new Error(`--${name} not found`); return m[1]; };
const bg = cssVar('bg');
const panel = cssVar('panel');
say(`\nContrast (WCAG 2.1). Page background ${bg}, panel ${panel}`);
for (const name of ['text', 'text-2', 'muted']) {
  const c = contrast(cssVar(name), panel);
  check(c >= TEXT_CONTRAST, `text color --${name} on the panel: ${c.toFixed(2)}:1 (needs ${TEXT_CONTRAST}:1)`);
}
for (const l of levels) {
  const c = contrast(l.text, l.color);
  check(c >= TEXT_CONTRAST, `label "${l.label}" on its own color: ${c.toFixed(2)}:1 (needs ${TEXT_CONTRAST}:1)`);
}
say('  Calendar classes against the panel (graphical objects, 3:1). The zero class is the empty state and is listed for information:');
say(`    zero ${contrast(CELL_ZERO, panel).toFixed(2)}:1`);
CELL_RAMP.forEach((h, i) => {
  const c = contrast(h, panel);
  check(c >= GRAPHIC_CONTRAST, `class ${i + 1} (${h}) against the panel: ${c.toFixed(2)}:1 (needs ${GRAPHIC_CONTRAST}:1)`);
});
const lowest = contrast(CELL_RAMP[0], CELL_ZERO);
say(`    lowest class against the zero class: ${lowest.toFixed(2)}:1, CIEDE2000 ${ciede2000(seen(CELL_ZERO, 'normal'), seen(CELL_RAMP[0], 'normal')).toFixed(1)}`);

// ---- 4. information never depends on color alone
say('\nNon-color cues present in the source');
const src = (f: string) => readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', f), 'utf8');
const cal = src('components/ActivityCalendar.tsx');
check(cal.includes('id="cal-nodata"') && cal.includes('lg-nodata'), 'no-data days are striped, and the legend says so');
check(cal.includes('id="cal-est"') && cal.includes('lg-est'), 'estimated days (MODIS rescaled) are hatched, and the legend says so');
check(cal.includes('cal-fill-dot') && cal.includes('NOAA-20 fill'), 'NOAA-20 fill days carry a dot, and the legend says so');
check(cal.includes('drawing.rings') && cal.includes('lg-ring'), 'unusual and extreme days are outlined, and the legend says so');
check(cal.includes('tip-title') && cal.includes('levelInfo(lv).label'), 'the tooltip states the value and the level in words');
check(cal.includes('onKeyDown') && cal.includes('tabIndex={0}') && cal.includes('aria-label'), 'the calendar is reachable and movable by keyboard and has an accessible name');
check(css.includes(':focus-visible'), 'keyboard focus is visible');
check(css.includes('prefers-reduced-motion'), 'reduced-motion preference is respected');

say(failures ? `\n${failures} accessibility check(s) failed` : '\nAll accessibility checks passed');
process.exit(failures ? 1 : 0);
