"""Test whether another DANE department layer closes the Meta/Caqueta gap with IDEAM.

Background: docs/VALIDATION.md shows that Meta and Caqueta each differ from IDEAM by about
+-1,000 detections per semester in opposite directions, while their sum matches. The
hypothesis (docs/VALIDATION.md) is that IDEAM uses a department layer that
includes the provisional IGAC limit of September 2020, while the MGN 2018 layer predates it.

Usage (from the repository root):
    python scripts/compare_boundary_versions.py <department_layer> [<department_layer> ...]

Each argument is a department layer readable by GeoPandas (shapefile, GeoJSON, GeoPackage) with the
two-character DANE code in a column named DPTO_CCDGO (the same name as the 2018 layer). Example, once
the MGN 2023 department shapefile is downloaded and unzipped under data/raw/dane_2023/:
    python scripts/compare_boundary_versions.py data/processed/dane_mgn2018_departamentos.geojson data/raw/dane_2023/MGN_ANM_DPTOS.shp

For every layer it assigns the same raw detections (MODIS + VIIRS S-NPP + VIIRS NOAA-20, archive
type 0, 2023-2024) directly to departments and prints Meta and Caqueta against the IDEAM
figures, plus the area each department gained or lost compared with the first layer. It does not
change any dataset file; it only writes data/processed/validation_ideam_boundary_test.csv.

AI use: written with the help of an AI assistant (Claude Code).
"""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import geopandas as gpd
import pandas as pd

import build_dataset as b

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "processed"
CODE_COL = "DPTO_CCDGO"
FOCUS = {"50": "Meta", "18": "Caqueta"}


def load_layer(path: str) -> gpd.GeoDataFrame:
    g = gpd.read_file(path, encoding="utf-8")
    if CODE_COL not in g.columns:
        raise SystemExit(f"{path}: no column {CODE_COL}. Columns: {list(g.columns)}")
    g[CODE_COL] = g[CODE_COL].astype(str).str.zfill(2)
    if g.crs is None:
        raise SystemExit(f"{path}: the layer has no CRS")
    return g[[CODE_COL, "geometry"]].to_crs(4326).dissolve(by=CODE_COL).reset_index()


def main() -> None:
    layers = sys.argv[1:]
    if not layers:
        raise SystemExit(__doc__)
    ideam = pd.read_csv(OUT / "ideam_semester_departments.csv", dtype={"dane_department_code": str})
    ideam = ideam[ideam["dane_department_code"].isin(FOCUS)].set_index(["semester", "dane_department_code"])["ideam_hotspots"]

    con = duckdb.connect()
    b.load_detections(con)
    pts = con.execute("""
        SELECT lat, lon, utc_date FROM det
        WHERE utc_date BETWEEN DATE '2023-01-01' AND DATE '2024-12-31'
          AND sensor IN ('MODIS_C61', 'VIIRS_SNPP', 'VIIRS_N20') AND COALESCE("type", 0) = 0""").df()
    d = pd.to_datetime(pts["utc_date"])
    pts["semester"] = d.dt.year.astype(str) + "-S" + ((d.dt.month > 6) + 1).astype(str)
    points = gpd.GeoDataFrame(pts, geometry=gpd.points_from_xy(pts["lon"], pts["lat"]), crs=4326)

    rows, first_area = [], None
    for path in layers:
        g = load_layer(path)
        j = gpd.sjoin(points, g, predicate="within", how="inner").drop_duplicates(subset=["lat", "lon", "utc_date"])
        counts = j.groupby(["semester", CODE_COL]).size()
        area = g.to_crs(3116).set_index(CODE_COL).geometry.area / 1e4  # hectares
        first_area = area if first_area is None else first_area
        print(f"\n== {path}")
        for (sem, code), real in ideam.items():
            ours = int(counts.get((sem, code), 0))
            rows.append({"layer": Path(path).name, "semester": sem, "department": FOCUS[code], "ours": ours,
                         "ideam": int(real), "diff": ours - int(real), "diff_pct": round((ours - real) / real * 100, 1)})
        t = pd.DataFrame([r for r in rows if r["layer"] == Path(path).name])
        print(t.pivot(index="semester", columns="department", values="diff").assign(
            total=lambda x: x.sum(axis=1)).to_string())
        change = (area - first_area).dropna()
        if path != layers[0]:
            print("Area change versus the first layer (hectares), departments that moved more than 1,000 ha:")
            print(change[change.abs() > 1000].round(0).to_string())
    pd.DataFrame(rows).to_csv(OUT / "validation_ideam_boundary_test.csv", index=False)
    print("\nwrote data/processed/validation_ideam_boundary_test.csv")


if __name__ == "__main__":
    main()
