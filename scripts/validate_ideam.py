"""Compare raw FIRMS counts with the IDEAM semester reports (2023-2024).

Run from the repository root (needs data/raw and the DANE boundaries):
    python scripts/validate_ideam.py

IDEAM publishes SEMESTER figures only: the national total and the top-10
departments per semester (see docs/IDEAM_REFERENCE.md). It does not state which
sensors or filters it uses. So this script does not assume how IDEAM counts: it
tries several combinations of sensors and quality filters on RAW detections (not
1 km cells) and reports how close each one gets. Nothing is tuned to match; every
combination is listed.

Inputs (in Git):   data/processed/ideam_semester_national.csv
                   data/processed/ideam_semester_departments.csv
Outputs (data/processed/):
    validation_ideam_counts_dept_semester.csv   raw counts per department, semester, sensor, filter
    validation_ideam_national.csv               every combination vs the IDEAM national total
    validation_ideam_departments.csv            every combination vs the 40 IDEAM department values

AI use: written with the help of an AI assistant (Claude Code).
"""

from __future__ import annotations

import itertools
from pathlib import Path

import duckdb
import pandas as pd

import build_dataset as b

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "processed"

SENSOR_SETS = {
    "MODIS": ["MODIS_C61"],
    "SNPP": ["VIIRS_SNPP"],
    "N20": ["VIIRS_N20"],
    "MODIS+SNPP": ["MODIS_C61", "VIIRS_SNPP"],
    "SNPP+N20": ["VIIRS_SNPP", "VIIRS_N20"],
    "MODIS+SNPP+N20": ["MODIS_C61", "VIIRS_SNPP", "VIIRS_N20"],
    "MODIS+SNPP+N20+N21": ["MODIS_C61", "VIIRS_SNPP", "VIIRS_N20", "VIIRS_N21"],
    "SNPP+N20+N21": ["VIIRS_SNPP", "VIIRS_N20", "VIIRS_N21"],
}


def main() -> None:
    nat_ideam = pd.read_csv(OUT / "ideam_semester_national.csv").set_index("semester")["ideam_national_total"]
    dep_ideam = pd.read_csv(OUT / "ideam_semester_departments.csv", dtype={"dane_department_code": str})

    con = duckdb.connect()
    b.load_detections(con)
    mp, lookup = b.load_municipalities()
    pts = con.execute("""
        SELECT sensor, lat, lon, utc_date, conf_class, "type" FROM det
        WHERE utc_date BETWEEN DATE '2023-01-01' AND DATE '2024-12-31'""").df()
    pts["mpio_code"] = b.points_to_municipality(mp, pts["lon"].to_numpy(), pts["lat"].to_numpy())
    outside = int(pts["mpio_code"].isna().sum())
    pts = pts.dropna(subset=["mpio_code"]).copy()
    pts["dpto_code"] = pts["mpio_code"].str[:2]
    d = pd.to_datetime(pts["utc_date"])
    pts["semester"] = d.dt.year.astype(str) + "-S" + ((d.dt.month > 6) + 1).astype(str)
    b.log(f"{len(pts):,} detections inside Colombia polygons; {outside:,} outside (dropped)")

    masks = {
        "raw": pd.Series(True, index=pts.index),
        "type0": pts["type"].fillna(0).eq(0),
        "type0_not_low": pts["type"].fillna(0).eq(0) & pts["conf_class"].ne("low"),
    }
    frames = []
    for fname, m in masks.items():
        g = pts[m].groupby(["dpto_code", "semester", "sensor"]).size().rename("detections").reset_index()
        g.insert(3, "filter", fname)
        frames.append(g)
    counts = pd.concat(frames, ignore_index=True)
    counts.to_csv(OUT / "validation_ideam_counts_dept_semester.csv", index=False)

    # ---- national totals
    nat = []
    for (sname, sensors), fname in itertools.product(SENSOR_SETS.items(), masks):
        c = counts[(counts["filter"] == fname) & counts["sensor"].isin(sensors)]
        tot = c.groupby("semester")["detections"].sum()
        for sem, ideam in nat_ideam.items():
            ours = int(tot.get(sem, 0))
            nat.append({"sensors": sname, "filter": fname, "semester": sem, "ours": ours, "ideam": int(ideam),
                        "ours_over_ideam": round(ours / ideam, 3), "diff_pct": round((ours - ideam) / ideam * 100, 1)})
    nat = pd.DataFrame(nat)
    nat.to_csv(OUT / "validation_ideam_national.csv", index=False)
    nsum = (nat.assign(abs_diff=nat["diff_pct"].abs()).groupby(["sensors", "filter"])
            .agg(mean_abs_diff_pct=("abs_diff", "mean"), worst_abs_diff_pct=("abs_diff", "max")).round(1)
            .sort_values("mean_abs_diff_pct").reset_index())
    print("\nNational totals: mean and worst absolute difference vs IDEAM over the 4 semesters")
    print(nsum.head(8).to_string(index=False))

    # ---- departments (40 values: top 10 per semester)
    dep = []
    for (sname, sensors), fname in itertools.product(SENSOR_SETS.items(), masks):
        c = counts[(counts["filter"] == fname) & counts["sensor"].isin(sensors)]
        ours = c.groupby(["dpto_code", "semester"])["detections"].sum()
        for r in dep_ideam.itertuples():
            o = int(ours.get((r.dane_department_code, r.semester), 0))
            dep.append({"sensors": sname, "filter": fname, "semester": r.semester, "rank": r.rank,
                        "department": r.department, "dpto_code": r.dane_department_code,
                        "ours": o, "ideam": int(r.ideam_hotspots),
                        "diff_pct": round((o - r.ideam_hotspots) / r.ideam_hotspots * 100, 1)})
    dep = pd.DataFrame(dep)
    dep.to_csv(OUT / "validation_ideam_departments.csv", index=False)
    dsum = (dep.assign(abs_diff=dep["diff_pct"].abs()).groupby(["sensors", "filter"])
            .agg(mean_abs_diff_pct=("abs_diff", "mean"), within_5pct=("abs_diff", lambda s: int((s <= 5).sum())),
                 within_10pct=("abs_diff", lambda s: int((s <= 10).sum())), n=("abs_diff", "size"))
            .round(1).sort_values("mean_abs_diff_pct").reset_index())
    print("\nDepartments (40 values): mean absolute difference and values within 5% / 10%")
    print(dsum.head(8).to_string(index=False))

    best = nsum.iloc[0]
    sensors = SENSOR_SETS[best["sensors"]]
    print(f"\nBest national combination: {best['sensors']} / {best['filter']}")
    worst = dep[(dep["sensors"] == best["sensors"]) & (dep["filter"] == best["filter"])]
    worst = worst.assign(abs_diff=worst["diff_pct"].abs()).sort_values("abs_diff", ascending=False).head(6)
    print("Largest department differences for that combination:")
    print(worst[["semester", "department", "ours", "ideam", "diff_pct"]].to_string(index=False))
    # per-sensor breakdown for those, to help explain them
    c = counts[counts["filter"] == best["filter"]]
    for r in worst.head(3).itertuples():
        x = c[(c["dpto_code"] == r.dpto_code) & (c["semester"] == r.semester)].set_index("sensor")["detections"]
        print(f"  {r.department} {r.semester} by sensor:", x.to_dict())


if __name__ == "__main__":
    main()
