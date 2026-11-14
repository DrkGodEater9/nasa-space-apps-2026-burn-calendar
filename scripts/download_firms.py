"""Download FIRMS hotspot data by area, in chunks of up to 5 days, with a local cache.

The MAP_KEY is read from the FIRMS_MAP_KEY environment variable (never from a
file in the repo and never passed on the command line).

Each chunk is cached as its own CSV under data/raw/firms_cache/<SOURCE>/, so a
re-run only requests the chunks that are missing. data/raw is git-ignored.

Usage (PowerShell):
    $env:FIRMS_MAP_KEY = "your_key"
    python scripts/download_firms.py --source VIIRS_SNPP_SP --start 2024-01-01 --end 2024-01-31

Usage (bash):
    export FIRMS_MAP_KEY=your_key
    python scripts/download_firms.py --source MODIS_SP --start 2024-01-01 --end 2024-01-31

AI note: this script was written with the help of an AI assistant (Claude Code).
It only downloads data; it makes no harmonization decisions.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import requests

API_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{bbox}/{days}/{start}"
MAX_DAYS = 5  # the API accepts 1-5 days per request
ENV_VAR = "FIRMS_MAP_KEY"

# Colombia, approximate box: west, south, east, north (from PLAN.md)
COLOMBIA_BBOX = (-79.5, -4.5, -66.5, 12.8)

# First day each archive source has data (from PLAN.md)
SOURCE_START = {
    "MODIS_SP": date(2000, 11, 1),
    "VIIRS_SNPP_SP": date(2012, 1, 20),
    "VIIRS_NOAA20_SP": date(2018, 4, 1),
    "VIIRS_NOAA21_SP": date(2023, 3, 1),
    # Near-real-time sources: use these for the most recent days that the archive does not cover yet.
    # The API only serves recent days for them; older requests return nothing or an error.
    "MODIS_NRT": date(2000, 11, 1),
    "VIIRS_SNPP_NRT": date(2012, 1, 20),
    "VIIRS_NOAA20_NRT": date(2018, 4, 1),
    "VIIRS_NOAA21_NRT": date(2023, 3, 1),
}

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CACHE = REPO_ROOT / "data" / "raw" / "firms_cache"
DEFAULT_OUT = REPO_ROOT / "data" / "raw"


def parse_date(text: str) -> date:
    return datetime.strptime(text, "%Y-%m-%d").date()


def chunks(start: date, end: date):
    """Yield (chunk_start, n_days) covering start..end inclusive, 5 days at a time."""
    cur = start
    while cur <= end:
        n = min(MAX_DAYS, (end - cur).days + 1)
        yield cur, n
        cur += timedelta(days=n)


def fetch_chunk(session: requests.Session, key: str, source: str, bbox, start: date, n_days: int,
                retries: int = 4) -> str:
    """Return the CSV text for one chunk. Raises RuntimeError (with the key scrubbed) on failure."""
    url = API_URL.format(
        key=key,
        source=source,
        bbox=",".join(str(v) for v in bbox),
        days=n_days,
        start=start.isoformat(),
    )
    last_err = "unknown error"
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=60)
        except requests.RequestException as exc:
            # exception text can contain the URL (and the key), so do not echo it
            last_err = f"network error ({type(exc).__name__})"
        else:
            text = resp.text
            if resp.status_code == 200 and text.lstrip().lower().startswith("latitude"):
                return text
            if resp.status_code == 200 and not text.strip():
                return ""  # valid but empty answer
            last_err = f"HTTP {resp.status_code}: {text.strip()[:120].replace(key, '***')}"
            if resp.status_code in (400, 401, 403):
                break  # bad key / bad request: retrying will not help
        time.sleep(2 ** attempt)
    raise RuntimeError(last_err)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", required=True, choices=sorted(SOURCE_START))
    ap.add_argument("--start", required=True, type=parse_date, help="YYYY-MM-DD")
    ap.add_argument("--end", required=True, type=parse_date, help="YYYY-MM-DD (inclusive)")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("W", "S", "E", "N"), default=COLOMBIA_BBOX,
                    help="area as west south east north (default: Colombia)")
    ap.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--no-combine", action="store_true", help="only fill the cache, skip the combined CSV")
    ap.add_argument("--pause", type=float, default=0.2, help="seconds between requests (default 0.2)")
    args = ap.parse_args()

    key = os.environ.get(ENV_VAR, "").strip()
    if not key:
        print(f"Set the {ENV_VAR} environment variable first (the key is never read from a file).", file=sys.stderr)
        return 2

    start, end = args.start, args.end
    if start < SOURCE_START[args.source]:
        print(f"Note: {args.source} starts on {SOURCE_START[args.source]}; clamping --start.")
        start = SOURCE_START[args.source]
    if end < start:
        print("Nothing to do: end is before start.", file=sys.stderr)
        return 2

    cache = args.cache_dir / args.source
    cache.mkdir(parents=True, exist_ok=True)
    plan = list(chunks(start, end))
    fetched = cached = failed = 0
    session = requests.Session()

    for i, (cstart, n) in enumerate(plan, 1):
        f = cache / f"{cstart.isoformat()}_{n}d.csv"
        if f.exists():
            cached += 1
            continue
        try:
            text = fetch_chunk(session, key, args.source, args.bbox, cstart, n)
        except RuntimeError as exc:
            failed += 1
            print(f"[{i}/{len(plan)}] {cstart} +{n}d FAILED: {exc}", file=sys.stderr)
            continue
        # write atomically so an interrupted run never leaves a half-written cache file
        tmp = f.with_suffix(".tmp")
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(f)
        fetched += 1
        print(f"[{i}/{len(plan)}] {cstart} +{n}d ok ({max(text.count(chr(10)) - 1, 0)} rows)")
        time.sleep(args.pause)

    print(f"Done. chunks: {len(plan)} | downloaded: {fetched} | from cache: {cached} | failed: {failed}")

    if not args.no_combine and failed == 0:
        frames = []
        for cstart, n in plan:
            f = cache / f"{cstart.isoformat()}_{n}d.csv"
            if f.stat().st_size > 0:
                frames.append(pd.read_csv(f, dtype=str))
        args.out_dir.mkdir(parents=True, exist_ok=True)
        out = args.out_dir / f"firms_{args.source}_{start.isoformat()}_{end.isoformat()}.csv"
        if frames:
            pd.concat(frames, ignore_index=True).to_csv(out, index=False)
            print(f"Combined file: {out}")
        else:
            print("No detections in that period; no combined file written.")
    elif failed:
        print("Some chunks failed; fix the cause and re-run (cached chunks are skipped).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
