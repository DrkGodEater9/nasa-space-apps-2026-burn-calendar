// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.

const nf = new Intl.NumberFormat('en-US');

export function fmtInt(v: number): string {
  return nf.format(Math.round(v));
}

export function fmtNum(v: number, digits = 1): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtRatio(v: number): string {
  if (v >= 10) return `${Math.round(v)}×`;
  return `${v.toFixed(1)}×`;
}

const LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);

/** "SAN ANDRÉS DE TUMACO" -> "San Andrés de Tumaco"; keeps "D.C." as is. */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/(\s+|-|\()/)
    .map((w, i) => {
      if (!w.trim() || w === '-' || w === '(') return w;
      if (w === 'd.c.') return 'D.C.';
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtInt(n)} ${n === 1 ? one : many}`;
}
