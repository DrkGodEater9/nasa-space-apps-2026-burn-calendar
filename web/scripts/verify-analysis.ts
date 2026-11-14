// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Checks that the web app recomputes the monthly comparison exactly like the data pipeline
// (monthly_municipio / monthly_departamento) and that per-area sums match department totals.
// Run with: npm run verify (after npm run sync-data).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Area, DeptFile, Manifest, NationalFile, StatusFile } from '../src/lib/types.ts';
import { computeAreaSeries, indexDept, indexNational, makeRefContext, type IndexedDept } from '../src/lib/analysis.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'web');
const load = <T>(f: string): T => JSON.parse(readFileSync(path.join(root, f), 'utf8')) as T;
const manifest = load<Manifest>('manifest.json');
const ctx = makeRefContext(manifest.reference_range, load<StatusFile>('status.json'));
const national = indexNational(load<NationalFile>('departments.json'));

let failures = 0;
const check = (label: string, ok: boolean) => { if (!ok) { failures++; if (failures < 25) console.log('MISMATCH', label); } };
const close = (a: number | null, b: number | null, tol: number) =>
  (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) <= tol);

for (const code of ['52', '50', '99', '11']) {
  const dep = indexDept(load<DeptFile>(`departments/${code}.json`));
  const depts = new Map<string, IndexedDept>([[code, dep]]);
  const firstMo = 0;
  // Every municipality that has monthly rows.
  const munis = new Set(dep.file.monthly.m);
  let rowsChecked = 0;
  for (const m of munis) {
    const u = dep.file.municipalities[m];
    const area: Area = { kind: 'municipality', key: `m:${u.code}`, label: u.name, sublabel: '', dptoCodes: [code],
      members: [{ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 }] };
    const s = computeAreaSeries(area, depts, national, ctx);
    const mb = dep.file.monthly;
    for (let r = 0; r < mb.m.length; r++) {
      if (mb.m[r] !== m) continue;
      const row = s.monthly[mb.mo[r] - firstMo];
      rowsChecked++;
      check(`${u.code} mo${mb.mo[r]} cd ${row?.cd} vs ${mb.cd[r]}`, row?.cd === mb.cd[r]);
      check(`${u.code} mo${mb.mo[r]} ad`, row?.ad === mb.ad[r]);
      check(`${u.code} mo${mb.mo[r]} nd`, row?.nd === mb.nd[r]);
      check(`${u.code} mo${mb.mo[r]} ok`, row?.ok === (mb.ok[r] === 1));
      check(`${u.code} mo${mb.mo[r]} med ${row?.med} vs ${mb.med[r]}`, close(row?.med ?? null, mb.med[r], 1e-6));
      check(`${u.code} mo${mb.mo[r]} pct ${row?.pct} vs ${mb.pct[r]}`, close(row?.pct ?? null, mb.pct[r], 0.051));
      check(`${u.code} mo${mb.mo[r]} ratio ${row?.ratio} vs ${mb.ratio[r]}`, close(row?.ratio ?? null, mb.ratio[r], 0.0051)); // stored rounded to 2 decimals
    }
  }
  // Whole department: sum of municipalities vs departments.json monthly.
  const di = national.deptIndex.get(code)!;
  const area: Area = { kind: 'department', key: `d:${code}`, label: code, sublabel: '', dptoCodes: [code],
    members: dep.file.municipalities.map((u) => ({ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 })) };
  const s = computeAreaSeries(area, depts, national, ctx);
  const nm = national.file.monthly;
  let deptRows = 0;
  for (const r of national.monthlyRows[di]) {
    const row = s.monthly[nm.mo[r]];
    deptRows++;
    check(`dept ${code} mo${nm.mo[r]} cd ${row.cd} vs ${nm.cd[r]}`, row.cd === nm.cd[r]);
    check(`dept ${code} mo${nm.mo[r]} med ${row.med} vs ${nm.med[r]}`, close(row.med, nm.med[r], 1e-6));
    check(`dept ${code} mo${nm.mo[r]} pct ${row.pct} vs ${nm.pct[r]}`, close(row.pct, nm.pct[r], 0.051));
  }
  // 7-day sums vs the alert rows.
  const a = dep.file.alerts;
  for (let r = 0; r < a.m.length; r += 7) {
    const u = dep.file.municipalities[a.m[r]];
    const single: Area = { kind: 'municipality', key: '', label: '', sublabel: '', dptoCodes: [code],
      members: [{ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 }] };
    if (r > 2000) break;
    const ss = computeAreaSeries(single, depts, national, ctx);
    check(`c7 ${u.code} d${a.d[r]} ${ss.cells7[a.d[r] - ctx.refStart]} vs ${a.c[r]}`, ss.cells7[a.d[r] - ctx.refStart] === a.c[r]);
  }
  console.log(`dept ${code}: ${munis.size} municipalities, ${rowsChecked} municipal month rows, ${deptRows} department month rows`);
}
console.log(failures ? `FAILED: ${failures} mismatches` : 'OK: web aggregation matches the data pipeline');
process.exit(failures ? 1 : 0);
