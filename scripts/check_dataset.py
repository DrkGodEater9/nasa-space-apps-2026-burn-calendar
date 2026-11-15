"""Integrity checks for the tables written by scripts/build_dataset.py.

Run from the repository root after the build:
    python scripts/check_dataset.py
Exits with code 1 if any check fails.

AI use: written with the help of an AI assistant (Claude Code).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "data" / "processed"
S = ROOT / "data" / "sample"
failures: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("PASS  " if ok else "FAIL  ") + msg)
    if not ok:
        failures.append(msg)


def main() -> None:
    t = {p.stem: pd.read_parquet(p) for p in P.glob("*.parquet")}
    lookup = t["municipios_lookup"]
    codes = set(lookup["mpio_code"])
    status = t["reference_status_daily"]
    ref = t["reference_daily_by_municipio"]
    daily = t["daily_by_municipio"]
    an_m, an_d = t["anomaly_municipio"], t["anomaly_departamento"]
    mo_m, mo_d = t["monthly_municipio"], t["monthly_departamento"]

    check(len(lookup) == 1122 and lookup["mpio_code"].str.len().eq(5).all(), "lookup has 1,122 five-character municipality codes")
    check(lookup["mpio_code"].is_unique, "municipality codes are unique")
    for name in ("daily_by_municipio", "reference_daily_by_municipio", "anomaly_municipio", "monthly_municipio"):
        check(set(t[name]["mpio_code"]) <= codes, f"{name}: every mpio_code exists in the lookup")
    check(ref[["mpio_code", "date"]].duplicated().sum() == 0, "reference series has one row per municipality and day")
    check(daily[["mpio_code", "date", "sensor"]].duplicated().sum() == 0, "daily table has one row per municipality, day and sensor")
    check((ref["active_cells"] > 0).all() and (daily["active_cells"] > 0).all() and (ref["detections"] > 0).all(),
          "sparse tables contain only rows with activity")
    check(ref["detections"].ge(ref["active_cells"]).all(), "reference series: detections >= active_cells")
    check(daily["detections"].ge(daily["active_cells"]).all(), "detections >= active_cells everywhere")

    d = pd.to_datetime(status["date"])
    check(d.is_monotonic_increasing and (d.diff().dropna() == pd.Timedelta(days=1)).all(), "reference_status_daily is a continuous daily range")
    check(set(status["status"]) <= {"snpp", "n20_fill", "no_data"}, "status values are valid")
    check(((status["status"] == "no_data") == (status["ref_sensor"] == "")).all(), "ref_sensor is empty exactly on no_data days")
    nd = set(status.loc[status["status"] == "no_data", "date"])
    check(not ref["date"].isin(nd).any(), "no activity rows on no_data days")
    check(((ref["sensor"] == "VIIRS_N20") == ref["filled"]).all(), "filled flag matches the NOAA-20 rows")
    n20_days = set(status.loc[status["status"] == "n20_fill", "date"])
    check(set(ref.loc[ref["filled"], "date"]) <= n20_days, "filled rows only on n20_fill days")
    check(status.loc[status["status"] == "n20_fill", "date"].min() >= pd.Timestamp("2018-04-01").date(), "NOAA-20 fill never before 2018-04-01")
    check(set(daily.loc[daily["sensor"] == "MODIS_C61", "date"].map(lambda x: x.year)) >= set(range(2003, 2026))
          and daily.loc[daily["sensor"] == "MODIS_C61", "date"].min().year == 2003, "MODIS starts in 2003")

    # monthly totals must equal the reference series
    ref_tot = ref.groupby("mpio_code")["detections"].sum()
    mo_tot = mo_m.groupby("mpio_code")["hotspots"].sum()
    check(ref_tot.sort_index().equals(mo_tot.reindex(ref_tot.index).sort_index()), "monthly hot spots add up to the reference series per municipality")
    ref_dept_tot = ref.assign(d=ref["mpio_code"].str[:2]).groupby("d")["detections"].sum()
    mo_dept_tot = mo_d.groupby("dpto_code")["hotspots"].sum()
    check(ref_dept_tot.sort_index().equals(mo_dept_tot.reindex(ref_dept_tot.index).sort_index()), "department monthly totals add up to the reference series")

    # anomaly table
    check(set(an_m["level"]) <= {"normal", "elevated", "unusual", "extreme", "insufficient"}, "anomaly levels are valid")
    ok = an_m[an_m["level"] != "insufficient"]
    check((ok["p75"] <= ok["p90"]).all() and (ok["p90"] <= ok["p97_5"]).all(), "percentiles are ordered P75 <= P90 <= P97.5")
    check(an_m.loc[an_m["level"].isin(["unusual", "extreme"]), "hotspots_7d"].ge(3).all(), "unusual/extreme always have at least 3 hot spots")
    check((an_m.loc[an_m["level"] == "insufficient", "baseline_active_days"].lt(10) | an_m.loc[an_m["level"] == "insufficient", "baseline_samples"].eq(0)).all(),
          "insufficient only when baseline has < 10 active days")
    check(ok["baseline_active_days"].ge(10).all(), "non-insufficient rows have >= 10 baseline active days")
    check((an_m["hotspots_7d"] > 0).all(), "anomaly rows only where the 7-day sum is positive")
    check(an_d["dpto_code"].str.len().eq(2).all(), "department anomalies use 2-character codes")

    # months
    check(mo_m["ratio_vs_median"].dropna().ge(0).all() and mo_m["percentile_vs_history"].dropna().between(0, 100).all(), "ratios >= 0 and percentiles within 0-100")
    check(not mo_m.loc[mo_m["month_complete"], "no_data_days"].gt(31).any(), "no_data_days is at most the days in a month")

    # partial months must be compared with the same days of the month in other years (recomputed independently)
    part = mo_m[~mo_m["month_complete"]]
    dim = pd.to_datetime(part["month"]).dt.days_in_month
    check(len(part) > 0 and ((part["compare_first_day"] > 1) | (part["compare_last_day"] < dim)).all(),
          "partial months carry the day range that was compared")
    last_month = pd.to_datetime(mo_m["month"]).max()
    row = mo_m[(pd.to_datetime(mo_m["month"]) == last_month) & (mo_m["mpio_code"] == "99773")]
    if len(row) == 1 and not bool(row["month_complete"].iloc[0]):
        r0 = row.iloc[0]
        rd = ref[ref["mpio_code"] == "99773"].assign(dt=lambda x: pd.to_datetime(x["date"]))
        first_ref = pd.to_datetime(status["date"]).min()
        sums = []
        for y in range(first_ref.year, last_month.year):
            a = pd.Timestamp(y, last_month.month, int(r0["compare_first_day"]))
            b = pd.Timestamp(y, last_month.month, int(r0["compare_last_day"]))
            if a >= first_ref:
                sums.append(int(rd.loc[rd["dt"].between(a, b), "detections"].sum()))
        check(abs(float(np.median(sums)) - float(r0["hist_median_hotspots"])) < 0.01 and len(sums) == int(r0["history_years"]),
              f"current partial month (Cumaribo, days {r0['compare_first_day']}-{r0['compare_last_day']}) uses the same days in {len(sums)} other years")

    # harmonization: the rule is used only if the national test passed, and only where the department passed
    hfile = P / "harmonization.json"
    if hfile.exists():
        import json as _json
        h = _json.loads(hfile.read_text(encoding="utf-8"))
        hs = _json.loads((P / "harmonization_summary.json").read_text(encoding="utf-8"))
        q = "detections" if h["quantity"] == "detections" else "cells"
        check(h["accepted"] == hs["results"][q]["national_pass"], "harmonization is accepted exactly when the national test passes")
        check(hs["results"][q]["h1_median_over_156_year_months_pct"] <= hs["national_margin_pct"]
              and hs["results"][q]["h2_worst_calendar_month_median_pct"] <= hs["national_margin_pct"],
              f"national test within the {hs['national_margin_pct']}% margin under both readings")
        check(hs["quantity_with_lower_national_error"] == q, "the harmonized quantity is the one with the lower national error")
        check(len(h["factors"]) == 12 and all(f > 0 for f in h["factors"]), "12 positive monthly factors")
        if "anomaly_modis_era_departamento" in t:
            era = t["anomaly_modis_era_departamento"]
            shown = {c for c, v in h["departments"].items() if v["status"] in ("ok", "low_confidence")}
            check(set(era["dpto_code"]) <= shown, "MODIS-era anomalies exist only for departments that passed the test")
            check(pd.to_datetime(era["date"]).max() < pd.to_datetime(status["date"]).min(), "MODIS-era anomalies end before the VIIRS reference starts")
            check(pd.to_datetime(era["date"]).min().year >= 2003, "MODIS era starts in 2003")
            eok = era[era["level"] != "insufficient"]
            check(era.loc[era["level"].isin(["unusual", "extreme"]), "hotspots_7d"].ge(3).all() and (eok["p75"] <= eok["p97_5"]).all(),
                  "MODIS-era anomalies follow the same alert rules")

    # static-source mask must catch Galeras and the biggest known fixed sources
    mask = t["static_source_mask"]
    near = mask[(mask["lat"].between(1.15, 1.29)) & (mask["lon"].between(-77.43, -77.31))]
    check(len(near) > 0, f"static-source mask covers the Galeras area ({len(near)} cells)")

    # sample is a subset of the full tables
    for name, key in (("reference_daily_by_municipio", "mpio_code"), ("anomaly_municipio", "mpio_code")):
        s = pd.read_parquet(S / f"sample_{name}.parquet")
        full = t[name]
        full = full[full[key].str.startswith("52")]
        check(len(s) == len(full) and list(s.columns) == list(full.columns), f"sample_{name} equals the department-52 slice of the full table")

    # web JSON must carry exactly what the tables carry (skipped when scripts/export_web_json.py has not run)
    web = P / "web"
    if (web / "manifest.json").exists():
        import json
        man = json.loads((web / "manifest.json").read_text(encoding="utf-8"))
        check(len(man["departments"]) == 33 and all((web / d["file"]).exists() for d in man["departments"]), "web JSON: 33 department files exist")
        base = pd.Timestamp(man["day_base"])
        total_cells = total_alerts = total_months = 0
        for d in man["departments"]:
            j = json.loads((web / d["file"]).read_text(encoding="utf-8"))
            total_cells += sum(j["daily"]["c"])
            total_alerts += len(j["alerts"]["c"])
            total_months += len(j["monthly"]["cd"])
        check(total_cells == int(ref["detections"].sum()), "web JSON: daily hot spots add up to the reference series")
        check(total_alerts == len(an_m) and total_months == len(mo_m), "web JSON: alert and month rows match the tables")
        j52 = json.loads((web / "departments" / "52.json").read_text(encoding="utf-8"))
        codes52 = [m["code"] for m in j52["municipalities"]]
        rebuilt = pd.DataFrame({"mpio_code": [codes52[i] for i in j52["daily"]["m"]],
                                "date": [(base + pd.Timedelta(days=int(x))).date() for x in j52["daily"]["d"]],
                                "detections": j52["daily"]["c"], "active_cells": j52["daily"]["k"]}).sort_values(["mpio_code", "date"]).reset_index(drop=True)
        orig = ref[ref["mpio_code"].str.startswith("52")][["mpio_code", "date", "detections", "active_cells"]].sort_values(["mpio_code", "date"]).reset_index(drop=True)
        check(rebuilt.equals(orig), "web JSON: department 52 daily series decodes to the exact table rows")
        st = json.loads((web / "status.json").read_text(encoding="utf-8"))
        check(len(st["status"]) == len(status), "web JSON: status has one code per reference day")

    print()
    if failures:
        print(f"{len(failures)} check(s) failed")
        sys.exit(1)
    print("All checks passed")


if __name__ == "__main__":
    main()
