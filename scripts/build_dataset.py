"""Build the harmonized burn-calendar dataset from the raw FIRMS archive files.

Implements docs/METHOD.md. Run from the repository root:
    python scripts/build_dataset.py            # full build + Narino sample
    python scripts/build_dataset.py --sample-dept 52

Inputs (not in Git):  data/raw/archive/DL_FIRE_*/fire_{archive,nrt}_*.csv
                      data/raw/firms_cache/*_NRT/*.csv  (optional, newest days from the FIRMS API)
Inputs (in Git):      data/processed/dane_mgn2018_municipios.geojson
Outputs:              data/processed/*.parquet, *.csv, build_info.json, harmonization.json
                      data/sample/*  (small subset for the web team)

AI use: this script was written with the help of an AI assistant (Claude Code),
implementing the method decided by the team in docs/METHOD.md.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import duckdb
import geopandas as gpd
import numpy as np
import pandas as pd

import harmonization_test as ht

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "archive"
OUT = ROOT / "data" / "processed"
SAMPLE = ROOT / "data" / "sample"
MPIO_FILE = OUT / "dane_mgn2018_municipios.geojson"

SENSORS = {"MODIS_C61": "M-C61", "VIIRS_SNPP": "SV-C2", "VIIRS_N20": "J1V-C2", "VIIRS_N21": "J2V-C2"}
API_CACHE = ROOT / "data" / "raw" / "firms_cache"   # filled by scripts/download_firms.py
API_NRT_SOURCE = {"MODIS_C61": "MODIS_NRT", "VIIRS_SNPP": "VIIRS_SNPP_NRT",
                  "VIIRS_N20": "VIIRS_NOAA20_NRT", "VIIRS_N21": "VIIRS_NOAA21_NRT"}
CELL_DEG = 0.01
TZ_HOURS = 5                # Colombia = UTC-5
MODIS_FIRST_DATE = "2003-01-01"
MASK_MIN_MONTHS = 7          # more than 50% of 12 months
WINDOW_DAYS = 7
SEASON_HALF_WIDTH = 15
MIN_BASELINE_ACTIVE_DAYS = 10
MIN_CELLS_FOR_ALERT = 3
MAX_MISSING_IN_WINDOW = 3    # a 7-day window with 4+ no-data days is not computed
VALIDATION_RANGE = ("2023-01-01", "2024-12-31")
# Harmonized quantity. Chosen by the team's leave-one-year-out test (docs/HARMONIZATION_RESULTS.md):
# "detections" = accepted FIRMS detections ("hot spots"); "active_cells" = active 1 km cells.
QUANTITY = "detections"
# Department statuses of the test that show MODIS rescaled to VIIRS units in the single calendar.
SHOW_RESCALED = {"ok", "low_confidence"}
T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def as_date(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s).dt.date


# ---------------------------------------------------------------- loading
def load_detections(con: duckdb.DuckDBPyConnection) -> None:
    def select(sensor: str, kind: str, f: Path) -> str:
        type_expr = 'TRY_CAST("type" AS INTEGER)' if kind == "archive" else "CAST(NULL AS INTEGER)"
        return f"""
            SELECT '{sensor}' AS sensor, '{kind}' AS kind,
                   CAST(latitude AS DOUBLE) AS lat, CAST(longitude AS DOUBLE) AS lon,
                   CAST(acq_date AS DATE) AS utc_date, CAST(acq_time AS INTEGER) AS acq_time,
                   confidence AS conf, {type_expr} AS "type"
            FROM read_csv('{f.as_posix()}', all_varchar=true)"""

    archive_parts, nrt_parts = [], []
    api_files = 0
    for sensor, prefix in SENSORS.items():
        folder = next(RAW.glob(f"DL_FIRE_{prefix}_*"))
        archive_parts.append(select(sensor, "archive", next(folder.glob("fire_archive_*.csv"))))
        nrt_parts.append(select(sensor, "nrt", next(folder.glob("fire_nrt_*.csv"))))
        # Most recent days downloaded with scripts/download_firms.py from the *_NRT sources.
        for f in sorted((API_CACHE / API_NRT_SOURCE[sensor]).glob("*.csv")):
            if f.stat().st_size > 0:
                nrt_parts.append(select(sensor, "nrt", f))
                api_files += 1
    # NRT files and API chunks can overlap by a few days: keep each detection once.
    nrt_sql = "SELECT DISTINCT * FROM (" + " UNION ALL ".join(nrt_parts) + ")"
    con.execute("CREATE TABLE raw AS " + " UNION ALL ".join(archive_parts) + " UNION ALL " + nrt_sql)
    log(f"API cache chunks read: {api_files}")
    con.execute(f"""
        CREATE TABLE det0 AS
        SELECT sensor, kind, lat, lon, utc_date, "type",
          CAST(utc_date AS TIMESTAMP) + to_hours(acq_time // 100) + to_minutes(acq_time % 100)
            - to_hours({TZ_HOURS}) AS lts,
          CASE WHEN sensor = 'MODIS_C61' THEN
                 CASE WHEN TRY_CAST(conf AS INTEGER) < 30 THEN 'low'
                      WHEN TRY_CAST(conf AS INTEGER) < 80 THEN 'nominal'
                      WHEN TRY_CAST(conf AS INTEGER) IS NOT NULL THEN 'high' END
               ELSE CASE conf WHEN 'l' THEN 'low' WHEN 'n' THEN 'nominal' WHEN 'h' THEN 'high' END
          END AS conf_class,
          (CAST(floor(lat / {CELL_DEG}) AS BIGINT) + 1000) * 100000
            + (CAST(floor(lon / {CELL_DEG}) AS BIGINT) + 10000) AS cell_id
        FROM raw""")
    con.execute("ALTER TABLE det0 ADD COLUMN local_date DATE")
    con.execute("UPDATE det0 SET local_date = CAST(lts AS DATE)")
    # Local day D needs UTC data for D and D+1: drop the partly covered first/last local day per sensor.
    con.execute(f"""
        CREATE TABLE rng AS
        SELECT sensor, min(utc_date) AS lo, max(utc_date) - INTERVAL 1 DAY AS hi FROM det0 GROUP BY sensor""")
    con.execute(f"""
        CREATE TABLE det AS
        SELECT d.* FROM det0 d JOIN rng r USING (sensor)
        WHERE d.local_date BETWEEN r.lo AND r.hi
          AND NOT (d.sensor = 'MODIS_C61' AND d.local_date < DATE '{MODIS_FIRST_DATE}')""")
    bad = con.execute("SELECT count(*) FROM det WHERE conf_class IS NULL").fetchone()[0]
    log(f"loaded {con.execute('SELECT count(*) FROM det').fetchone()[0]:,} detections; unknown confidence: {bad}")


def apply_filters(con: duckdb.DuckDBPyConnection) -> tuple[pd.DataFrame, dict]:
    con.execute(f"""
        CREATE TABLE mask AS
        -- type 1 = active volcano (e.g. Galeras), 2 = other static land source, 3 = offshore
        SELECT cell_id FROM det WHERE kind = 'archive' AND "type" IN (1, 2, 3)
        UNION
        SELECT cell_id FROM (
            SELECT cell_id, year(local_date) AS y, count(DISTINCT month(local_date)) AS m
            FROM det WHERE kind = 'archive' AND "type" = 0 AND conf_class <> 'low' GROUP BY 1, 2)
        WHERE m >= {MASK_MIN_MONTHS}""")
    n_mask = con.execute("SELECT count(*) FROM mask").fetchone()[0]
    report = con.execute("""
        SELECT sensor,
          count(*) AS total,
          count(*) FILTER (WHERE conf_class = 'low') AS dropped_low_confidence,
          count(*) FILTER (WHERE conf_class <> 'low' AND kind = 'archive' AND "type" <> 0) AS dropped_type_not_0,
          count(*) FILTER (WHERE conf_class <> 'low' AND kind = 'nrt' AND cell_id IN (SELECT cell_id FROM mask)) AS dropped_static_mask
        FROM det GROUP BY sensor ORDER BY sensor""").df()
    con.execute("""
        CREATE TABLE good AS
        SELECT sensor, cell_id, local_date FROM det
        WHERE conf_class IN ('nominal', 'high')
          AND ((kind = 'archive' AND "type" = 0)
               OR (kind = 'nrt' AND cell_id NOT IN (SELECT cell_id FROM mask)))""")
    cells = con.execute(
        "SELECT sensor, cell_id, local_date, count(*) AS n_det FROM good GROUP BY ALL").df()
    cells["local_date"] = pd.to_datetime(cells["local_date"])
    report["kept_detections"] = cells.groupby("sensor")["n_det"].sum().reindex(report["sensor"]).to_numpy()
    log(f"static-source mask: {n_mask:,} cells; active sensor-cell-days: {len(cells):,}")
    return cells, {"mask_cells": int(n_mask), "filter_report": report.to_dict("records")}


# ---------------------------------------------------------------- geography
def load_municipalities() -> tuple[gpd.GeoDataFrame, pd.DataFrame]:
    mp = gpd.read_file(MPIO_FILE, encoding="utf-8")
    lookup = mp[["MPIO_CDPMP", "MPIO_CNMBR", "DPTO_CCDGO", "DPTO_CNMBR"]].rename(columns={
        "MPIO_CDPMP": "mpio_code", "MPIO_CNMBR": "mpio_name",
        "DPTO_CCDGO": "dpto_code", "DPTO_CNMBR": "dpto_name"})
    return mp, lookup


def points_to_municipality(mp: gpd.GeoDataFrame, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    pts = gpd.GeoDataFrame({"i": np.arange(len(lon))}, geometry=gpd.points_from_xy(lon, lat), crs="EPSG:4326")
    j = gpd.sjoin(pts, mp[["MPIO_CDPMP", "geometry"]], predicate="within", how="left").drop_duplicates("i")
    return j.sort_values("i")["MPIO_CDPMP"].to_numpy()


def assign_municipality(cells: pd.DataFrame, mp: gpd.GeoDataFrame) -> tuple[pd.DataFrame, int]:
    u = cells[["cell_id"]].drop_duplicates().reset_index(drop=True)
    ix = (u["cell_id"] % 100000 - 10000).to_numpy()
    iy = (u["cell_id"] // 100000 - 1000).to_numpy()
    u["mpio_code"] = points_to_municipality(mp, (ix + 0.5) * CELL_DEG, (iy + 0.5) * CELL_DEG)
    outside = int(u["mpio_code"].isna().sum())
    out = cells.merge(u, on="cell_id").dropna(subset=["mpio_code"])
    log(f"cells assigned to municipalities; unique cells outside polygons: {outside:,} of {len(u):,}")
    return out, outside


# ---------------------------------------------------------------- series
def daily_by_municipality(cells: pd.DataFrame) -> pd.DataFrame:
    d = (cells.groupby(["mpio_code", "local_date", "sensor"])
         .agg(active_cells=("cell_id", "size"), detections=("n_det", "sum")).reset_index()
         .rename(columns={"local_date": "date"}))
    return d


def reference_series(con: duckdb.DuckDBPyConnection, daily: pd.DataFrame):
    cov = con.execute("SELECT sensor, local_date, count(*) AS n FROM det GROUP BY ALL").df()
    cov["local_date"] = pd.to_datetime(cov["local_date"])
    has = {s: set(g["local_date"]) for s, g in cov.groupby("sensor")}
    lo = min(has["VIIRS_SNPP"])
    hi = max(max(has["VIIRS_SNPP"]), max(has["VIIRS_N20"]))
    dates = pd.date_range(lo, hi, freq="D")
    status = np.where([d in has["VIIRS_SNPP"] for d in dates], "snpp",
                      np.where([d in has["VIIRS_N20"] for d in dates], "n20_fill", "no_data"))
    ref_sensor = np.where(status == "snpp", "VIIRS_SNPP", np.where(status == "n20_fill", "VIIRS_N20", ""))
    status_df = pd.DataFrame({"date": dates, "status": status, "ref_sensor": ref_sensor})
    chosen = status_df.set_index("date")["ref_sensor"]
    ref = daily.copy()
    ref["chosen"] = ref["date"].map(chosen)
    ref = ref[ref["sensor"] == ref["chosen"]].drop(columns="chosen")
    ref["filled"] = ref["sensor"] == "VIIRS_N20"
    cover = (cov.pivot(index="local_date", columns="sensor", values="n").reindex(
        pd.date_range(cov["local_date"].min(), cov["local_date"].max(), freq="D")).notna())
    cover.index.name = "date"
    cover = cover.reset_index().melt(id_vars="date", var_name="sensor", value_name="has_data")
    log(f"reference series {dates[0].date()} -> {dates[-1].date()}; "
        f"filled days {int((status == 'n20_fill').sum())}, no-data days {int((status == 'no_data').sum())}")
    return ref, status_df, cover, dates


def build_matrix(df: pd.DataFrame, key: str, dates: pd.DatetimeIndex, nodata: np.ndarray, value_col: str = QUANTITY):
    keys = sorted(df[key].unique())
    ki = {k: i for i, k in enumerate(keys)}
    di = pd.Series(np.arange(len(dates)), index=dates)
    X = np.zeros((len(keys), len(dates)), np.float32)
    X[df[key].map(ki).to_numpy(), di.reindex(df["date"]).to_numpy()] = df[value_col].to_numpy()
    X[:, nodata] = np.nan
    return keys, X


def rolling_sum(X: np.ndarray, nodata: np.ndarray) -> np.ndarray:
    z = np.nan_to_num(X).astype(np.float64)
    c = np.concatenate([np.zeros((z.shape[0], 1)), np.cumsum(z, axis=1)], axis=1)
    s = np.full(X.shape, np.nan)
    s[:, WINDOW_DAYS - 1:] = c[:, WINDOW_DAYS:] - c[:, :-WINDOW_DAYS]
    miss = np.concatenate([[0], np.cumsum(nodata.astype(int))])
    missing = np.full(X.shape[1], 99)
    missing[WINDOW_DAYS - 1:] = miss[WINDOW_DAYS:] - miss[:-WINDOW_DAYS]
    s[:, missing > MAX_MISSING_IN_WINDOW] = np.nan
    return s


def percentiles(sub: np.ndarray, qs):
    srt = np.sort(sub, axis=1)                      # NaN sorts last
    n = (~np.isnan(sub)).sum(axis=1)
    out = []
    for q in qs:
        pos = q * np.clip(n - 1, 0, None)
        lo, hi = np.floor(pos).astype(int), np.ceil(pos).astype(int)
        a = np.take_along_axis(srt, lo[:, None], 1)[:, 0]
        b = np.take_along_axis(srt, hi[:, None], 1)[:, 0]
        r = a + (b - a) * (pos - lo)
        r[n == 0] = np.nan
        out.append(r)
    return out, n


def anomalies(keys, X: np.ndarray, S: np.ndarray, dates: pd.DatetimeIndex, id_col: str, as_int: bool = True) -> pd.DataFrame:
    T = len(dates)
    years = range(dates[0].year, dates[-1].year + 1)
    date_index = {d: i for i, d in enumerate(dates)}
    active = np.nan_to_num(X) > 0
    active_nan = np.where(np.isnan(X), np.nan, active.astype(np.float32))
    offs = np.arange(-SEASON_HALF_WIDTH, SEASON_HALF_WIDTH + 1)
    keys = np.array(keys)
    pieces = []
    for ti in range(WINDOW_DAYS - 1, T):
        v_all = S[:, ti]
        sel = np.where(np.nan_to_num(v_all) > 0)[0]
        if sel.size == 0:
            continue
        t = dates[ti]
        month, day = t.month, (28 if (t.month == 2 and t.day == 29) else t.day)
        idx = []
        for y in years:
            if y == t.year:
                continue
            c = date_index.get(pd.Timestamp(y, month, day))
            if c is not None:
                idx.extend(c + offs)
        idx = np.array(idx)
        idx = idx[(idx >= 0) & (idx < T)]
        sub = S[np.ix_(sel, idx)]
        (p75, p90, p975), n = percentiles(sub, (0.75, 0.90, 0.975))
        act_days = np.nansum(active_nan[np.ix_(sel, idx)], axis=1)
        v = v_all[sel]
        level = np.where(v > p975, "extreme", np.where(v > p90, "unusual", np.where(v > p75, "elevated", "normal")))
        level = np.where((v < MIN_CELLS_FOR_ALERT) & np.isin(level, ["unusual", "extreme"]), "elevated", level)
        level = np.where((act_days < MIN_BASELINE_ACTIVE_DAYS) | (n == 0), "insufficient", level)
        pieces.append(pd.DataFrame({
            id_col: keys[sel], "date": t,
            "hotspots_7d": v.astype(np.int32) if as_int else np.round(v, 1).astype(np.float32),
            "p75": np.round(p75, 2).astype(np.float32), "p90": np.round(p90, 2).astype(np.float32),
            "p97_5": np.round(p975, 2).astype(np.float32),
            "baseline_samples": n.astype(np.int32), "baseline_active_days": act_days.astype(np.int32),
            "level": level}))
    return pd.concat(pieces, ignore_index=True) if pieces else pd.DataFrame()


def monthly(keys, X: np.ndarray, dates: pd.DatetimeIndex, nodata: np.ndarray, id_col: str) -> pd.DataFrame:
    z = pd.DataFrame(np.nan_to_num(X).T, index=dates, columns=keys)
    per = z.index.to_period("M")
    cell_days = z.groupby(per).sum()
    active_days = (z > 0).groupby(per).sum()
    nodata_days = pd.Series(nodata, index=dates).groupby(per).sum()
    covered = pd.Series(1, index=dates).groupby(per).sum()
    complete = covered == covered.index.days_in_month
    periods = cell_days.index
    ratio = pd.DataFrame(np.nan, index=periods, columns=keys)
    median = ratio.copy()
    pct = ratio.copy()
    hist_n = pd.Series(0, index=periods)
    first_day = pd.Series(1, index=periods)
    last_day = pd.Series(periods.days_in_month, index=periods)
    for p in periods:
        if complete[p]:
            others = [q for q in periods if q.month == p.month and q.year != p.year and complete[q]]
            base = cell_days.loc[others].to_numpy() if others else None
        else:
            # Partial month (the current month, or the first month of the series): compare the same days of the
            # month in the other years, never a partial month against whole months.
            days = dates[per == p]
            d1, d2 = int(days.min().day), int(days.max().day)
            first_day[p], last_day[p] = d1, d2
            rows, others = [], []
            for q in periods:
                if q.month != p.month or q.year == p.year:
                    continue
                start = pd.Timestamp(q.year, q.month, d1)
                end = pd.Timestamp(q.year, q.month, min(d2, q.days_in_month))
                if start < dates[0] or end > dates[-1]:
                    continue  # those days are not fully inside the reference range in that year
                rows.append(z.loc[start:end].sum().to_numpy())
                others.append(q)
            base = np.vstack(rows) if rows else None
        hist_n[p] = len(others)
        if base is None:
            continue
        med = np.median(base, axis=0)
        val = cell_days.loc[p].to_numpy()
        median.loc[p] = med
        ratio.loc[p] = np.where(med > 0, val / np.where(med > 0, med, 1), np.nan)
        pct.loc[p] = (base <= val).mean(axis=0) * 100
    def long(df, name):
        s = df.stack(future_stack=True) if hasattr(df, "stack") else df
        s.index.names = ["period", id_col]
        return s.rename(name)
    out = pd.concat([long(cell_days, "hotspots"), long(active_days, "active_days"),
                     long(median, "hist_median_hotspots"), long(ratio, "ratio_vs_median"),
                     long(pct, "percentile_vs_history")], axis=1).reset_index()
    out["month"] = out["period"].dt.to_timestamp().dt.date
    out["no_data_days"] = out["period"].map(nodata_days).astype(int)
    out["month_complete"] = out["period"].map(complete)
    out["history_years"] = out["period"].map(hist_n).astype(int)
    out["compare_first_day"] = out["period"].map(first_day).astype(int)
    out["compare_last_day"] = out["period"].map(last_day).astype(int)
    for c in ("hotspots", "active_days"):
        out[c] = out[c].astype(int)
    for c in ("hist_median_hotspots", "ratio_vs_median", "percentile_vs_history"):
        out[c] = out[c].round(2).astype("float32")
    return out[[id_col, "month", "hotspots", "active_days", "no_data_days", "month_complete",
                "compare_first_day", "compare_last_day",
                "history_years", "hist_median_hotspots", "ratio_vs_median", "percentile_vs_history"]]


# ---------------------------------------------------------------- validation
def validation_table(con: duckdb.DuckDBPyConnection, mp: gpd.GeoDataFrame) -> pd.DataFrame:
    lo, hi = VALIDATION_RANGE
    pts = con.execute(f"""
        SELECT lat, lon, conf_class, utc_date, local_date FROM det
        WHERE sensor = 'VIIRS_SNPP' AND kind = 'archive' AND "type" = 0
          AND utc_date BETWEEN DATE '{lo}' AND DATE '{hi}'""").df()
    pts["mpio_code"] = points_to_municipality(mp, pts["lon"].to_numpy(), pts["lat"].to_numpy())
    pts = pts.dropna(subset=["mpio_code"])
    pts["dpto_code"] = pts["mpio_code"].str[:2]
    pts["not_low"] = pts["conf_class"] != "low"
    frames = []
    for basis, col in (("utc", "utc_date"), ("local", "local_date")):
        m = pd.to_datetime(pts[col]).dt.to_period("M").dt.to_timestamp().dt.date
        g = pts.assign(month=m).groupby(["dpto_code", "month"]).agg(
            raw_detections=("lat", "size"), raw_not_low_confidence=("not_low", "sum")).reset_index()
        g.insert(2, "date_basis", basis)
        frames.append(g)
    return pd.concat(frames, ignore_index=True)


# ---------------------------------------------------------------- output
def write(df: pd.DataFrame, name: str, folder: Path = OUT, csv: bool = False) -> None:
    df.to_parquet(folder / f"{name}.parquet", index=False, compression="zstd")
    if csv:
        df.to_csv(folder / f"{name}.csv", index=False)
    log(f"wrote {folder.name}/{name}.parquet ({len(df):,} rows, "
        f"{(folder / (name + '.parquet')).stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample-dept", default="52", help="department code for data/sample (default 52 = Narino)")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    SAMPLE.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect()
    load_detections(con)
    cells, info = apply_filters(con)
    mask_df = con.execute(f"""
        SELECT cell_id, ((cell_id % 100000 - 10000) + 0.5) * {CELL_DEG} AS lon,
               ((cell_id // 100000 - 1000) + 0.5) * {CELL_DEG} AS lat FROM mask ORDER BY cell_id""").df()
    mask_df[["lon", "lat"]] = mask_df[["lon", "lat"]].round(4)
    write(mask_df, "static_source_mask")
    mp, lookup = load_municipalities()
    cells, outside = assign_municipality(cells, mp)
    info["cells_outside_polygons"] = outside

    daily = daily_by_municipality(cells)
    ref, status_df, cover, dates = reference_series(con, daily)
    nodata = (status_df["status"] == "no_data").to_numpy()

    # --- reference series per municipality and per department
    ref_dept = (ref.assign(dpto_code=ref["mpio_code"].str[:2])
                .groupby(["dpto_code", "date", "sensor"], as_index=False)[["active_cells", "detections"]].sum())
    ref_m = ref[["mpio_code", "date", "detections", "active_cells", "sensor", "filled"]]
    mkeys, MX = build_matrix(ref, "mpio_code", dates, nodata)
    dkeys, DX = build_matrix(ref_dept, "dpto_code", dates, nodata)
    log(f"matrices: {MX.shape[0]} municipalities, {DX.shape[0]} departments, {MX.shape[1]} days")

    an_m = anomalies(mkeys, MX, rolling_sum(MX, nodata), dates, "mpio_code")
    log(f"municipality anomalies: {len(an_m):,} rows")
    an_d = anomalies(dkeys, DX, rolling_sum(DX, nodata), dates, "dpto_code")
    log(f"department anomalies: {len(an_d):,} rows")
    mo_m = monthly(mkeys, MX, dates, nodata, "mpio_code")
    mo_d = monthly(dkeys, DX, dates, nodata, "dpto_code")
    val = validation_table(con, mp)

    # --- harmonization of the MODIS era (team rule and test: docs/HARMONIZATION_TEST_PLAN.md)
    ht_key = "detections" if QUANTITY == "detections" else "cells"
    res = ht.evaluate(daily)
    hsum = res[ht_key]["summary"]
    fac = res[ht_key]["factors"].set_index("month")
    factor = fac["factor"]
    dept_status = res[ht_key]["departments"].set_index("dpto_code")["status"]
    accepted = bool(hsum["national_pass"])           # if the national test fails, the sensors stay separate
    era_end = dates[0] - pd.Timedelta(days=1)        # the day before the VIIRS reference series starts
    era_dates = pd.date_range(MODIS_FIRST_DATE, era_end, freq="D")
    modis_has = (cover[cover["sensor"] == "MODIS_C61"].set_index("date")["has_data"]
                 .reindex(era_dates, fill_value=False).to_numpy())
    modis_nodata = ~modis_has
    an_modis = pd.DataFrame()
    if accepted:
        modis = daily[(daily["sensor"] == "MODIS_C61") & (daily["date"] <= era_end)].copy()
        modis["estimated"] = modis[QUANTITY] * modis["date"].dt.month.map(factor)
        modis["dpto_code"] = modis["mpio_code"].str[:2]
        shown = (modis[modis["dpto_code"].map(dept_status).isin(SHOW_RESCALED)]
                 .groupby(["dpto_code", "date"], as_index=False)["estimated"].sum())
        ekeys, EX = build_matrix(shown, "dpto_code", era_dates, modis_nodata, "estimated")
        # "Internal anomaly of the MODIS era": the same windows and percentiles, against 2003-2011 only.
        an_modis = anomalies(ekeys, EX, rolling_sum(EX, modis_nodata), era_dates, "dpto_code", as_int=False)
    band = res[ht_key]["band"]

    def month_errors(code: str) -> list:
        b = band[band["dpto_code"] == code].set_index("month")["median_abs_error_pct"]
        return [float(b[m]) if m in b.index else None for m in range(1, 13)]

    harmonization = {
        "ai_note": "The rule and its margins were written by the Horum Labs team; the AI implemented and ran the test. "
                   "See docs/HARMONIZATION_TEST_PLAN.md and docs/HARMONIZATION_RESULTS.md.",
        "accepted": accepted, "quantity": QUANTITY, "overlap_years": [ht.YEARS[0], ht.YEARS[-1]],
        "modis_era": [MODIS_FIRST_DATE, str(era_end.date())],
        "factors": [round(float(factor[m]), 4) for m in range(1, 13)],
        "national_error_pct": [float(fac.loc[m, "test_median_abs_error_pct"]) for m in range(1, 13)],
        "national_error_all_months_pct": hsum["h1_median_over_156_year_months_pct"],
        "modis_no_data_days": [str(d.date()) for d in era_dates[modis_nodata]],
        "departments": {code: {"status": st, "error_pct": month_errors(code)} for code, st in dept_status.items()},
    }
    (OUT / "harmonization.json").write_text(json.dumps(harmonization, indent=2), encoding="utf-8")
    log(f"harmonization: accepted={accepted}, quantity={QUANTITY}, departments shown rescaled: "
        f"{int(dept_status.isin(SHOW_RESCALED).sum())}, MODIS-era anomaly rows: {len(an_modis):,}, "
        f"MODIS no-data days in the era: {int(modis_nodata.sum())}")

    # --- write full tables
    tables = {
        "municipios_lookup": lookup,
        "daily_by_municipio": daily.assign(date=as_date(daily["date"])),
        "reference_daily_by_municipio": ref_m.assign(date=as_date(ref_m["date"])),
        "reference_status_daily": status_df.assign(date=as_date(status_df["date"])),
        "sensor_coverage_daily": cover.assign(date=as_date(cover["date"])),
        "anomaly_municipio": an_m.assign(date=as_date(an_m["date"])),
        "anomaly_departamento": an_d.assign(date=as_date(an_d["date"])),
        "monthly_municipio": mo_m,
        "monthly_departamento": mo_d,
    }
    if len(an_modis):
        tables["anomaly_modis_era_departamento"] = an_modis.assign(date=as_date(an_modis["date"]))
    for name, df in tables.items():
        write(df, name)
    val.to_csv(OUT / "validation_snpp_dept_month_2023_2024.csv", index=False)
    pd.concat([pd.DataFrame(info["filter_report"])]).to_csv(OUT / "filter_report.csv", index=False)

    # --- sample for the web team (one department)
    dp = args.sample_dept
    sample_names = {
        "municipios_lookup": ("dpto_code", dp),
        "daily_by_municipio": ("mpio_code", dp),
        "reference_daily_by_municipio": ("mpio_code", dp),
        "anomaly_municipio": ("mpio_code", dp),
        "monthly_municipio": ("mpio_code", dp),
        "anomaly_departamento": ("dpto_code", dp),
        "monthly_departamento": ("dpto_code", dp),
        "reference_status_daily": (None, None),
    }
    for name, (col, val_) in sample_names.items():
        df = tables[name]
        if col == "dpto_code" or col == "mpio_code":
            df = df[df[col].str.startswith(dp)] if col == "mpio_code" else df[df[col] == dp]
        write(df, f"sample_{name}", SAMPLE, csv=True)

    info.update({
        "ai_note": "Built by scripts/build_dataset.py, written with the help of an AI assistant (Claude Code), "
                   "implementing the method decided by the Horum Labs team in docs/METHOD.md.",
        "built_utc": pd.Timestamp.now("UTC").isoformat(),
        "parameters": {
            "cell_degrees": CELL_DEG, "timezone": "UTC-5", "modis_first_date": MODIS_FIRST_DATE,
            "mask_min_months": MASK_MIN_MONTHS, "window_days": WINDOW_DAYS,
            "season_half_width_days": SEASON_HALF_WIDTH, "min_baseline_active_days": MIN_BASELINE_ACTIVE_DAYS,
            "quantity": QUANTITY, "min_count_for_alert": MIN_CELLS_FOR_ALERT, "max_missing_days_in_window": MAX_MISSING_IN_WINDOW,
            "boundaries": "DANE MGN 2018 (data/processed/dane_mgn2018_municipios.geojson)"},
        "reference_range": [str(dates[0].date()), str(dates[-1].date())],
        "reference_days": {k: int(v) for k, v in status_df["status"].value_counts().items()},
    })
    (OUT / "build_info.json").write_text(json.dumps(info, indent=2, default=str), encoding="utf-8")
    log("done")


if __name__ == "__main__":
    main()
