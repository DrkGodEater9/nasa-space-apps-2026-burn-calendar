// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Area selection without the map: search by name, or type coordinates (point or bounding box).

import { memo, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { GeoIndex } from '../lib/geo.ts';
import type { Area } from '../lib/types.ts';
import { Icon } from './Icon.tsx';

interface Props {
  geo: GeoIndex;
  onDepartment: (code: string) => void;
  onMunicipality: (code: string) => void;
  onPoint: (lon: number, lat: number) => string | null;
  onBox: (w: number, s: number, e: number, n: number) => string | null;
  compact?: boolean;
}

interface Hit {
  kind: 'department' | 'municipality';
  code: string;
  name: string;
  sub: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const AreaPicker = memo(function AreaPicker({ geo, onDepartment, onMunicipality, onPoint, onBox, compact }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [coordMode, setCoordMode] = useState<'none' | 'point' | 'box'>('none');
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => {
    const items: (Hit & { key: string })[] = [];
    for (const d of geo.deptByCode.values()) {
      items.push({ kind: 'department', code: d.code, name: d.name, sub: `Department · ${d.municipalities.length} municipalities`, key: norm(d.name) });
    }
    for (const m of geo.muniList) {
      items.push({ kind: 'municipality', code: m.code, name: m.name, sub: `${m.dptoName} · ${m.code}`, key: norm(`${m.name} ${m.dptoName} ${m.code}`) });
    }
    return items;
  }, [geo]);

  const hits = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const starts = index.filter((i) => i.key.startsWith(t));
    const contains = index.filter((i) => !i.key.startsWith(t) && i.key.includes(t));
    return [...starts, ...contains].slice(0, 8);
  }, [q, index]);

  const choose = (h: Hit) => {
    if (h.kind === 'department') onDepartment(h.code);
    else onMunicipality(h.code);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(hits[Math.min(active, hits.length - 1)]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={`picker ${compact ? 'compact' : ''}`}>
      <div className="search">
        <Icon name="search" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder="Search a municipality or department…"
          aria-label="Search a municipality or department"
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="search-results"
          aria-autocomplete="list"
        />
        {q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear search"><Icon name="close" size={14} /></button>}
        {open && hits.length > 0 && (
          <ul className="search-results" id="search-results" role="listbox">
            {hits.map((h, i) => (
              <li
                key={`${h.kind}${h.code}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseDown={(e) => { e.preventDefault(); choose(h); }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={`badge ${h.kind}`}>{h.kind === 'department' ? 'DPT' : 'MUN'}</span>
                <span className="sr-name">{h.name}</span>
                <span className="sr-sub">{h.sub}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="coord-switch">
        <span className="muted small">or by coordinates:</span>
        <button className={`chip ${coordMode === 'point' ? 'on' : ''}`} onClick={() => setCoordMode(coordMode === 'point' ? 'none' : 'point')}>
          <Icon name="pin" size={13} /> Lat / Lon point
        </button>
        <button className={`chip ${coordMode === 'box' ? 'on' : ''}`} onClick={() => setCoordMode(coordMode === 'box' ? 'none' : 'box')}>
          <Icon name="square" size={13} /> Bounding box
        </button>
      </div>
      {coordMode === 'point' && <PointForm onPoint={onPoint} />}
      {coordMode === 'box' && <BoxForm onBox={onBox} />}
    </div>
  );
});

function num(v: string): number {
  return Number(v.trim().replace(',', '.'));
}

function PointForm({ onPoint }: { onPoint: Props['onPoint'] }) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = num(lat);
    const o = num(lon);
    if (!Number.isFinite(a) || !Number.isFinite(o) || a < -5 || a > 14 || o < -82 || o > -66) {
      setErr('Enter a latitude between -5 and 14 and a longitude between -82 and -66 (decimal degrees).');
      return;
    }
    setErr(onPoint(o, a));
  };
  return (
    <form className="coord-form" onSubmit={submit}>
      <label>Latitude<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="1.2136" /></label>
      <label>Longitude<input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-77.2811" /></label>
      <button className="btn primary" type="submit">Find municipality</button>
      {err && <div className="form-err">{err}</div>}
    </form>
  );
}

function BoxForm({ onBox }: { onBox: Props['onBox'] }) {
  const [v, setV] = useState({ n: '', s: '', w: '', e: '' });
  const [err, setErr] = useState<string | null>(null);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const [n, s, w, e] = [num(v.n), num(v.s), num(v.w), num(v.e)];
    if (![n, s, w, e].every(Number.isFinite) || n <= s || e <= w) {
      setErr('North must be greater than south and east greater than west (decimal degrees).');
      return;
    }
    setErr(onBox(w, s, e, n));
  };
  const field = (k: keyof typeof v, label: string, ph: string) => (
    <label>{label}<input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} /></label>
  );
  return (
    <form className="coord-form box" onSubmit={submit}>
      {field('n', 'North', '4.5')}
      {field('s', 'South', '3.0')}
      {field('w', 'West', '-74.0')}
      {field('e', 'East', '-72.0')}
      <button className="btn primary" type="submit">Use this box</button>
      {err && <div className="form-err">{err}</div>}
    </form>
  );
}

export const AreaMembers = memo(function AreaMembers({ area }: { area: Area }) {
  const [showAll, setShowAll] = useState(false);
  if (area.kind === 'department' || area.members.length <= 1) return null;
  const list = showAll ? area.members : area.members.slice(0, 8);
  return (
    <div className="members">
      <div className="members-head">
        Municipalities used ({area.members.length})
        <span className="muted small"> · share of each municipality inside the shape</span>
      </div>
      <ul>
        {list.map((m) => (
          <li key={m.mpio}>
            <span className="mem-name">{m.name}</span>
            <span className="mem-dpto">{m.dptoName}</span>
            <span className="mem-bar"><i style={{ width: `${m.coverage * 100}%` }} /></span>
            <span className="mem-pct">{Math.round(m.coverage * 100)}%</span>
          </li>
        ))}
      </ul>
      {area.members.length > 8 && (
        <button className="link-btn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${area.members.length}`}</button>
      )}
      {!!area.excluded?.length && (
        <div className="muted small excluded">
          Not used (less than 25% inside): {area.excluded.slice(0, 6).map((m) => `${m.name} ${Math.round(m.coverage * 100)}%`).join(', ')}
          {area.excluded.length > 6 ? ` and ${area.excluded.length - 6} more` : ''}.
        </div>
      )}
    </div>
  );
});
