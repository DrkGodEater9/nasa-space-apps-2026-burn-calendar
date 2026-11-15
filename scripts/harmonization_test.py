"""Leave-one-year-out test of the team's MODIS -> VIIRS harmonization rule.

Implements docs/HARMONIZATION_TEST_PLAN.md exactly: one factor per calendar month at national
scale, from the MODIS / VIIRS S-NPP overlap of 2013-2025. Nothing is tuned: the margins are
the ones the team wrote before the test ran.

Run from the repository root after scripts/build_dataset.py:
    python scripts/harmonization_test.py

Outputs (data/processed/):
    harmonization_test_national.csv      every withheld year-month: MODIS, S-NPP, factor, prediction, error
    harmonization_test_departments.csv   per department: evaluable months, median error, status
    harmonization_factors.csv            the 12 final factors (all 13 years) and their test error
    harmonization_department_month_error.csv   median test error per department and calendar month (the band shown)
    harmonization_summary.json           pass/fail of each criterion and the quantity that won

AI use: written with the help of an AI assistant (Claude Code). The rule and the margins are the team's.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "data" / "processed"

YEARS = list(range(2013, 2026))          # overlap used by the team
NATIONAL_MARGIN = 15.0                   # percent, median absolute error, national monthly total
DEPARTMENT_MARGIN = 30.0                 # percent, per department and month
MIN_OBSERVED = 30                        # VIIRS cells needed for a department-month to be evaluated
QUANTITIES = {"cells": "active_cells", "detections": "detections"}


def monthly_table(daily: pd.DataFrame, column: str) -> pd.DataFrame:
    """Sum per department, year, month and sensor (MODIS and S-NPP only)."""
    d = daily[daily["sensor"].isin(["MODIS_C61", "VIIRS_SNPP"])].copy()
    dt = pd.to_datetime(d["date"])
    d["year"], d["month"], d["dpto_code"] = dt.dt.year, dt.dt.month, d["mpio_code"].str[:2]
    d = d[d["year"].isin(YEARS)]
    t = d.pivot_table(index=["dpto_code", "year", "month"], columns="sensor", values=column, aggfunc="sum", fill_value=0)
    return t.rename(columns={"MODIS_C61": "modis", "VIIRS_SNPP": "snpp"}).reset_index()


def factors(nat: pd.DataFrame, exclude_year: int | None = None) -> pd.Series:
    t = nat if exclude_year is None else nat[nat["year"] != exclude_year]
    g = t.groupby("month")[["modis", "snpp"]].sum()
    return g["snpp"] / g["modis"]


def run(quantity: str, column: str, daily: pd.DataFrame):
    dep = monthly_table(daily, column)
    nat = dep.groupby(["year", "month"], as_index=False)[["modis", "snpp"]].sum()

    # ---- leave one year out, national
    rows = []
    loyo = {}
    for y in YEARS:
        f = factors(nat, exclude_year=y)
        loyo[y] = f
        for r in nat[nat["year"] == y].itertuples():
            pred = f[r.month] * r.modis
            rows.append({"quantity": quantity, "year": y, "month": r.month, "modis": int(r.modis), "snpp": int(r.snpp),
                         "factor_without_this_year": round(float(f[r.month]), 4), "predicted": round(float(pred), 1),
                         "abs_error_pct": round(abs(pred - r.snpp) / r.snpp * 100, 2) if r.snpp > 0 else np.nan})
    national = pd.DataFrame(rows)
    h1 = float(national["abs_error_pct"].median())
    by_month = national.groupby("month")["abs_error_pct"].median()
    by_year = national.groupby("year")["abs_error_pct"].median()
    h2 = float(by_month.max())

    # ---- leave one year out, department-month (national factor applied to the department)
    d = dep.copy()
    d["factor"] = [loyo[y][m] for y, m in zip(d["year"], d["month"])]
    d["predicted"] = d["factor"] * d["modis"]
    d["evaluable"] = d["snpp"] >= MIN_OBSERVED
    d["abs_error_pct"] = np.where(d["evaluable"], (d["predicted"] - d["snpp"]).abs() / d["snpp"].where(d["snpp"] > 0, 1) * 100, np.nan)
    ev = d[d["evaluable"]]
    dept_rows = []
    for code in sorted(dep["dpto_code"].unique()):
        e = ev[ev["dpto_code"] == code]
        if e.empty:
            dept_rows.append({"quantity": quantity, "dpto_code": code, "evaluable_department_months": 0,
                              "median_abs_error_pct": np.nan, "calendar_months_evaluated": 0,
                              "calendar_months_above_margin": 0, "status": "insufficient"})
            continue
        per_month = e.groupby("month")["abs_error_pct"].median()
        med = float(e["abs_error_pct"].median())
        failing = int((per_month > DEPARTMENT_MARGIN).sum())
        if med <= DEPARTMENT_MARGIN:
            status = "ok"
        elif failing > len(per_month) / 2:
            status = "viirs_only"         # fails in most months: VIIRS from 2012 only
        else:
            status = "low_confidence"     # shown, marked "estimated error above 30%"
        dept_rows.append({"quantity": quantity, "dpto_code": code, "evaluable_department_months": int(len(e)),
                          "median_abs_error_pct": round(med, 2), "calendar_months_evaluated": int(len(per_month)),
                          "calendar_months_above_margin": failing, "status": status})
    departments = pd.DataFrame(dept_rows)
    band = (ev.groupby(["dpto_code", "month"])["abs_error_pct"].agg(median_abs_error_pct="median", evaluable_years="size")
            .round(2).reset_index())
    band.insert(0, "quantity", quantity)

    final = factors(nat)
    g = nat.groupby("month")[["modis", "snpp"]].sum()
    fac = pd.DataFrame({"quantity": quantity, "month": final.index, "factor": final.round(4).to_numpy(),
                        "modis_total_2013_2025": g["modis"].to_numpy(), "snpp_total_2013_2025": g["snpp"].to_numpy(),
                        "test_median_abs_error_pct": by_month.round(2).to_numpy(),
                        "test_max_abs_error_pct": national.groupby("month")["abs_error_pct"].max().round(2).to_numpy()})
    summary = {
        "h1_median_over_156_year_months_pct": round(h1, 2),
        "h2_worst_calendar_month_median_pct": round(h2, 2),
        "h1_pass": h1 <= NATIONAL_MARGIN, "h2_pass": h2 <= NATIONAL_MARGIN,
        "national_pass": h1 <= NATIONAL_MARGIN and h2 <= NATIONAL_MARGIN,
        "median_error_by_withheld_year_pct": {int(k): round(float(v), 2) for k, v in by_year.items()},
        "median_error_by_calendar_month_pct": {int(k): round(float(v), 2) for k, v in by_month.items()},
        "evaluable_department_months": int(len(ev)),
        "department_months_within_margin_pct": round(float((ev["abs_error_pct"] <= DEPARTMENT_MARGIN).mean() * 100), 1),
        "department_month_median_error_pct": round(float(ev["abs_error_pct"].median()), 2),
        "departments_by_status": departments["status"].value_counts().to_dict(),
    }
    return national, departments, fac, summary, band


def evaluate(daily: pd.DataFrame, write: bool = True) -> dict:
    """Run the test for both quantities. Returns, per quantity, the tables and the summary."""
    res, summary = {}, {}
    for quantity, column in QUANTITIES.items():
        national, departments, fac, s, band = run(quantity, column, daily)
        res[quantity] = {"national": national, "departments": departments, "factors": fac, "summary": s, "band": band}
        summary[quantity] = s
    winner = min(QUANTITIES, key=lambda q: summary[q]["h1_median_over_156_year_months_pct"])
    res["winner"] = winner
    if write:
        out = {
            "ai_note": "Computed by scripts/harmonization_test.py (written with AI help). The rule and margins are the team's; "
                       "see docs/HARMONIZATION_TEST_PLAN.md.",
            "years": [YEARS[0], YEARS[-1]], "national_margin_pct": NATIONAL_MARGIN,
            "department_margin_pct": DEPARTMENT_MARGIN, "min_observed_for_department_month": MIN_OBSERVED,
            "quantity_with_lower_national_error": winner, "results": summary,
        }
        pd.concat([res[q]["national"] for q in QUANTITIES]).to_csv(P / "harmonization_test_national.csv", index=False)
        pd.concat([res[q]["departments"] for q in QUANTITIES]).to_csv(P / "harmonization_test_departments.csv", index=False)
        pd.concat([res[q]["factors"] for q in QUANTITIES]).to_csv(P / "harmonization_factors.csv", index=False)
        pd.concat([res[q]["band"] for q in QUANTITIES]).to_csv(P / "harmonization_department_month_error.csv", index=False)
        (P / "harmonization_summary.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    return res


def main() -> None:
    daily = pd.read_parquet(P / "daily_by_municipio.parquet")
    res = evaluate(daily)
    pd.set_option("display.width", 200)
    for q in QUANTITIES:
        s = res[q]["summary"]
        print(f"=== {q}")
        print(f"h1 median over 156 year-months: {s['h1_median_over_156_year_months_pct']}%  (margin {NATIONAL_MARGIN}%)  pass={s['h1_pass']}")
        print(f"h2 worst calendar-month median: {s['h2_worst_calendar_month_median_pct']}%  pass={s['h2_pass']}")
        print("by calendar month:", s["median_error_by_calendar_month_pct"])
        print("by withheld year:", s["median_error_by_withheld_year_pct"])
        print(f"department-months evaluable: {s['evaluable_department_months']}, within {DEPARTMENT_MARGIN}%: "
              f"{s['department_months_within_margin_pct']}%, median error {s['department_month_median_error_pct']}%")
        print("departments by status:", s["departments_by_status"])
    print("quantity with the lower national error:", res["winner"])


if __name__ == "__main__":
    main()
