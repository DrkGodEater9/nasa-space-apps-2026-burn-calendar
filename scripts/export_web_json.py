"""Export the processed tables as compact JSON files that a static web app can load.

Run from the repository root after scripts/build_dataset.py:
    python scripts/export_web_json.py

Output (data/processed/web/):
    manifest.json            index: departments, municipalities, date bases, level names, notice text
    status.json              one status code per day of the reference series
    departments.json         department-level alerts and monthly summaries (all departments)
    departments/<code>.json  everything for one department: its municipalities, daily activity,
                             alerts, monthly summaries and the other sensors

All arrays are columnar (one array per column) and dates are integers, so the files stay small:
    day index   = days since manifest.day_base (2003-01-01)
    month index = months since manifest.month_base (2012-01)
Missing numbers are null. See docs/DATA_CONTRACT.md for the meaning of each column.

AI use: written with the help of an AI assistant (Claude Code).
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "data" / "processed"
OUT = P / "web"

DAY_BASE = date(2003, 1, 1)
MONTH_BASE = (2012, 1)
LEVELS = ["normal", "elevated", "unusual", "extreme", "insufficient"]
STATUS = ["snpp", "n20_fill", "no_data"]
SENSORS_EXTRA = ["MODIS_C61", "VIIRS_N21"]
NOTICE = ("Hot spot = thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide fires: "
          "a zero does not guarantee absence of fire. Data from different satellites are not summed.")


def day_index(s: pd.Series) -> list[int]:
    return (pd.to_datetime(s) - pd.Timestamp(DAY_BASE)).dt.days.astype(int).tolist()


def month_index(s: pd.Series) -> list[int]:
    d = pd.to_datetime(s)
    return ((d.dt.year - MONTH_BASE[0]) * 12 + d.dt.month - MONTH_BASE[1]).astype(int).tolist()


def nums(s: pd.Series, digits: int | None = None) -> list:
    if digits is not None:
        s = s.astype("float64").round(digits)
    return [None if pd.isna(x) else x for x in s.tolist()]


def dump(obj: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def alert_columns(df: pd.DataFrame, idx: pd.Series) -> dict:
    return {
        "m": idx.tolist(), "d": day_index(df["date"]), "c": df["cells_7d"].astype(int).tolist(),
        "p75": nums(df["p75"], 1), "p90": nums(df["p90"], 1), "p975": nums(df["p97_5"], 1),
        "act": df["baseline_active_days"].astype(int).tolist(),
        "l": df["level"].map({n: i for i, n in enumerate(LEVELS)}).astype(int).tolist(),
    }


def monthly_columns(df: pd.DataFrame, idx: pd.Series) -> dict:
    return {
        "m": idx.tolist(), "mo": month_index(df["month"]), "cd": df["cell_days"].astype(int).tolist(),
        "ad": df["active_days"].astype(int).tolist(), "nd": df["no_data_days"].astype(int).tolist(),
        "ok": df["month_complete"].astype(int).tolist(), "med": nums(df["hist_median_cell_days"], 1),
        "ratio": nums(df["ratio_vs_median"], 2), "pct": nums(df["percentile_vs_history"], 1),
    }


def main() -> None:
    lookup = pd.read_parquet(P / "municipios_lookup.parquet")
    status = pd.read_parquet(P / "reference_status_daily.parquet")
    ref = pd.read_parquet(P / "reference_daily_by_municipio.parquet")
    daily = pd.read_parquet(P / "daily_by_municipio.parquet")
    an_m = pd.read_parquet(P / "anomaly_municipio.parquet")
    an_d = pd.read_parquet(P / "anomaly_departamento.parquet")
    mo_m = pd.read_parquet(P / "monthly_municipio.parquet")
    mo_d = pd.read_parquet(P / "monthly_departamento.parquet")

    depts = (lookup[["dpto_code", "dpto_name"]].drop_duplicates().sort_values("dpto_code").reset_index(drop=True))
    dept_idx = {c: i for i, c in enumerate(depts["dpto_code"])}
    info = json.loads((P / "build_info.json").read_text(encoding="utf-8"))

    # ---- status.json: one code per day of the continuous reference range
    s = status.sort_values("date")
    dump({"start": str(s["date"].iloc[0]), "end": str(s["date"].iloc[-1]),
          "legend": STATUS, "status": s["status"].map({n: i for i, n in enumerate(STATUS)}).astype(int).tolist()},
         OUT / "status.json")

    # ---- departments.json: department-level alerts and monthly (fallback for municipalities with little history)
    an_d = an_d.assign(i=an_d["dpto_code"].map(dept_idx))
    mo_d = mo_d.assign(i=mo_d["dpto_code"].map(dept_idx))
    dump({"departments": depts.rename(columns={"dpto_code": "code", "dpto_name": "name"}).to_dict("records"),
          "alerts": alert_columns(an_d, an_d["i"]), "monthly": monthly_columns(mo_d, mo_d["i"])},
         OUT / "departments.json")

    # ---- one file per department
    totals = {"ref_cells": 0, "alert_rows": 0, "month_rows": 0}
    sizes = {}
    for code in depts["dpto_code"]:
        mp = lookup[lookup["dpto_code"] == code].sort_values("mpio_code").reset_index(drop=True)
        midx = {c: i for i, c in enumerate(mp["mpio_code"])}
        r = ref[ref["mpio_code"].isin(midx)].sort_values(["mpio_code", "date"])
        ex = daily[daily["mpio_code"].isin(midx) & daily["sensor"].isin(SENSORS_EXTRA)].sort_values(["sensor", "mpio_code", "date"])
        a = an_m[an_m["mpio_code"].isin(midx)].sort_values(["mpio_code", "date"])
        mo = mo_m[mo_m["mpio_code"].isin(midx)].sort_values(["mpio_code", "month"])
        dump({
            "code": code, "name": depts.loc[depts["dpto_code"] == code, "dpto_name"].iloc[0],
            "municipalities": mp[["mpio_code", "mpio_name"]].rename(columns={"mpio_code": "code", "mpio_name": "name"}).to_dict("records"),
            "daily": {"m": r["mpio_code"].map(midx).tolist(), "d": day_index(r["date"]), "c": r["active_cells"].astype(int).tolist()},
            "other_sensors": {"legend": SENSORS_EXTRA, "s": ex["sensor"].map({n: i for i, n in enumerate(SENSORS_EXTRA)}).tolist(),
                              "m": ex["mpio_code"].map(midx).tolist(), "d": day_index(ex["date"]), "c": ex["active_cells"].astype(int).tolist()},
            "alerts": alert_columns(a, a["mpio_code"].map(midx)),
            "monthly": monthly_columns(mo, mo["mpio_code"].map(midx)),
        }, OUT / "departments" / f"{code}.json")
        totals["ref_cells"] += int(r["active_cells"].sum())
        totals["alert_rows"] += len(a)
        totals["month_rows"] += len(mo)
        sizes[code] = (OUT / "departments" / f"{code}.json").stat().st_size

    # ---- manifest.json
    dump({
        "notice": NOTICE, "day_base": DAY_BASE.isoformat(), "month_base": f"{MONTH_BASE[0]}-{MONTH_BASE[1]:02d}",
        "reference_range": info["reference_range"], "levels": LEVELS, "status_legend": STATUS,
        "other_sensors": SENSORS_EXTRA, "windows": {"cells_window_days": 7, "season_half_width_days": 15},
        "alert_floor_cells": 3, "min_baseline_active_days": 10,
        "departments": [{"code": c, "name": n, "file": f"departments/{c}.json", "bytes": sizes[c]}
                        for c, n in zip(depts["dpto_code"], depts["dpto_name"])],
        "files": {"status": "status.json", "departments": "departments.json",
                  "municipality_boundaries": "../dane_mgn2018_municipios.geojson"},
        "ai_note": "Exported by scripts/export_web_json.py, written with the help of an AI assistant (Claude Code).",
    }, OUT / "manifest.json")

    # ---- sanity: the JSON must carry exactly what the tables carry
    assert totals["ref_cells"] == int(ref["active_cells"].sum()), "reference cells differ from the table"
    assert totals["alert_rows"] == len(an_m) and totals["month_rows"] == len(mo_m), "row counts differ from the tables"
    biggest = sorted(sizes.items(), key=lambda kv: -kv[1])[:5]
    print(f"{len(sizes)} department files, total {sum(sizes.values()) / 1e6:.1f} MB; "
          f"largest: " + ", ".join(f"{c}={v / 1e6:.1f} MB" for c, v in biggest))
    print(f"departments.json {(OUT / 'departments.json').stat().st_size / 1e6:.1f} MB, "
          f"status.json {(OUT / 'status.json').stat().st_size / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
