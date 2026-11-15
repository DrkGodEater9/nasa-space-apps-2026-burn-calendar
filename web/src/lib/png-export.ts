// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// PNG download of a chart: the chart's SVG, a title with the area and the dates, its legend, and the data
// source, drawn on one canvas. Data visualization only (no AI-generated imagery).

/** One legend entry read from the card (`.lg-item`): a swatch color and its label. */
interface LegendItem { color: string; label: string; hatched: boolean; striped: boolean; dashed: string | null }

export interface PngOptions {
  filename: string;
  title: string;
  subtitle?: string;
  /** Extra line above the source, such as "Hatched = estimated". */
  note?: string;
}

const SOURCE = 'Source: NASA FIRMS (VIIRS S-NPP, NOAA-20, MODIS C6.1) · Colombia Burn Calendar, Horum Labs · Hot spot = thermal anomaly, not a confirmed fire.';

/** Computed properties copied onto every SVG node, so the image does not depend on the page stylesheet. */
const PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'opacity',
  'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline',
  'visibility', 'display', 'paint-order',
];

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  const parts: string[] = [];
  for (const p of PROPS) {
    const v = cs.getPropertyValue(p);
    // Pattern fills (url(#...)) stay as attributes: the computed value can carry the page URL.
    if (v && !v.includes('url(')) parts.push(`${p}:${v}`);
  }
  const own = dst.getAttribute('style');
  dst.setAttribute('style', parts.join(';') + (own ? `;${own}` : ''));
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function readLegend(root: Element): LegendItem[] {
  const out: LegendItem[] = [];
  root.querySelectorAll('.lg-item').forEach((item) => {
    const i = item.querySelector('i');
    const label = (item.textContent ?? '').trim();
    if (!i || !label || i.classList.contains('lg-ring')) return;
    const cs = getComputedStyle(i);
    out.push({
      color: cs.backgroundColor,
      // A line swatch (such as the dashed median) is a zero-height box with a dashed top border.
      dashed: cs.borderTopStyle === 'dashed' ? cs.borderTopColor : null,
      label,
      hatched: i.classList.contains('lg-est'),
      striped: i.classList.contains('lg-nodata'),
    });
  });
  return out;
}

function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineWidth = 1;
  for (let k = -h; k < w + h; k += 3.5) {
    ctx.strokeStyle = 'rgba(11,15,23,0.75)';
    ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.moveTo(x + k + 1.2, y + h); ctx.lineTo(x + k + 1.2 + h, y); ctx.stroke();
  }
  ctx.restore();
}

/** Draws `svg` (and the legend of `legendRoot`) to a PNG and downloads it. */
export async function downloadSvgPng(svg: SVGSVGElement, legendRoot: Element | null, opts: PngOptions): Promise<void> {
  const box = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width));
  const h = Math.max(1, Math.round(box.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.style.minWidth = '0';
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();

  const bg = cssVar('--bg', '#090d14');
  const text = cssVar('--text', '#e6ecf5');
  const text2 = cssVar('--text-2', '#b4c0d3');
  const font = 'Inter Variable, Inter, "Segoe UI", Arial, sans-serif';
  const legend = legendRoot ? readLegend(legendRoot) : [];

  const PAD = 24;
  const scale = Math.min(2, 16000 / (h + 200));
  const width = w + 2 * PAD;
  // Legend entries flow in rows across the width.
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `11.5px ${font}`;
  const legendRows: LegendItem[][] = [];
  let row: LegendItem[] = [];
  let rowW = 0;
  for (const item of legend) {
    const iw = 18 + measure.measureText(item.label).width + 14;
    if (row.length && rowW + iw > w) { legendRows.push(row); row = []; rowW = 0; }
    row.push(item); rowW += iw;
  }
  if (row.length) legendRows.push(row);
  // Text lines wrap to the width of the chart, so nothing is cut off on narrow charts.
  const wrap = (s: string, f: string): string[] => {
    measure.font = f;
    const lines: string[] = [];
    let line = '';
    for (const word of s.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure.measureText(next).width > w) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const titleFont = `600 16px ${font}`;
  const subFont = `12.5px ${font}`;
  const footFont = `11px ${font}`;
  const titleLines = wrap(opts.title, titleFont);
  const subLines = opts.subtitle ? wrap(opts.subtitle, subFont) : [];
  const footLines = [...(opts.note ? wrap(opts.note, footFont) : []), ...wrap(SOURCE, footFont)];
  const top = PAD + titleLines.length * 22 + subLines.length * 18 + 10;
  const legendTop = top + h + 14;
  const footTop = legendTop + legendRows.length * 20 + 8;
  const height = footTop + footLines.length * 16 + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  let ty = PAD + 14;
  ctx.fillStyle = text;
  ctx.font = titleFont;
  for (const l of titleLines) { ctx.fillText(l, PAD, ty); ty += 22; }
  ctx.fillStyle = text2;
  ctx.font = subFont;
  for (const l of subLines) { ctx.fillText(l, PAD, ty - 2); ty += 18; }
  ctx.drawImage(img, PAD, top, w, h);

  ctx.font = `11.5px ${font}`;
  legendRows.forEach((items, r) => {
    let x = PAD;
    const y = legendTop + r * 20;
    for (const it of items) {
      if (it.dashed) {
        ctx.strokeStyle = it.dashed; ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 12, y + 6); ctx.stroke();
        ctx.setLineDash([]);
      } else if (it.striped) {
        ctx.fillStyle = '#2b3342';
        ctx.fillRect(x, y, 12, 12);
        ctx.strokeStyle = '#5b667a'; ctx.lineWidth = 1.4;
        for (let k = -12; k < 12; k += 4) { ctx.beginPath(); ctx.moveTo(x + k, y + 12); ctx.lineTo(x + k + 12, y); ctx.stroke(); }
      } else {
        ctx.fillStyle = it.color;
        ctx.fillRect(x, y, 12, 12);
        if (it.hatched) hatch(ctx, x, y, 12, 12);
      }
      ctx.fillStyle = text2;
      ctx.fillText(it.label, x + 18, y + 10);
      x += 18 + ctx.measureText(it.label).width + 14;
    }
  });

  ctx.fillStyle = text2;
  ctx.font = footFont;
  footLines.forEach((l, k) => ctx.fillText(l, PAD, footTop + 10 + k * 16));

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
