"""Build compact 2018 DANE MGN boundaries for the web and FIRMS filtering.

Run from the repository root after extracting the three DANE archives:
    python scripts/process_dane_boundaries.py

AI use: Codex assisted with this script (file inspection, reprojection,
simplification, and validation). Claude did not write this script.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import geopandas as gpd


ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "dane"
OUT = ROOT / "data" / "processed"
SIMPLIFY_CRS = "EPSG:3116"  # metre units; suitable for Colombia
WEB_CRS = "EPSG:4326"


def read_layer(path: Path, fields: list[str]) -> gpd.GeoDataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Extract the DANE archive first.")
    # The DBF contains UTF-8 accented names. GDAL's default decoding corrupts them.
    source = gpd.read_file(path, encoding="utf-8-sig")
    print(f"{path.name}: {len(source)} rows; CRS {source.crs}; columns {list(source.columns)}")
    if source.crs is None or source.crs.to_epsg() != 4686:
        raise ValueError(f"Unexpected CRS in {path}: {source.crs}")
    missing = set(fields) - set(source.columns)
    if missing:
        raise ValueError(f"Missing expected columns in {path}: {sorted(missing)}")
    if source.geometry.isna().any() or not source.geometry.is_valid.all():
        raise ValueError(f"Missing or invalid geometry in {path}")
    if (source["VERSION"] != 2018).any():
        raise ValueError(f"Unexpected MGN version in {path}")
    if any(source[field].isna().any() for field in fields if field != "geometry"):
        raise ValueError(f"Null key or name in {path}")
    if any("\ufffd" in value for field in fields if field.endswith("CNMBR") for value in source[field]):
        raise ValueError(f"Damaged text encoding in {path}")
    return source[fields].copy()


def simplify(layer: gpd.GeoDataFrame, tolerance_m: float) -> gpd.GeoDataFrame:
    projected = layer.to_crs(SIMPLIFY_CRS)
    projected.geometry = projected.geometry.simplify(tolerance_m, preserve_topology=True)
    if not projected.geometry.is_valid.all() or projected.geometry.is_empty.any():
        raise ValueError("Simplification produced an invalid or empty geometry")
    return projected.to_crs(WEB_CRS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tolerance-m", type=float, default=300.0)
    args = parser.parse_args()
    if args.tolerance_m <= 0:
        parser.error("--tolerance-m must be positive")

    departments = read_layer(
        RAW / "depto" / "MGN_ANM_DPTOS.shp",
        ["DPTO_CCDGO", "DPTO_CNMBR", "VERSION", "geometry"],
    )
    municipalities = read_layer(
        RAW / "mpio" / "MGN_ANM_MPIOS.shp",
        ["DPTO_CCDGO", "MPIO_CCDGO", "MPIO_CDPMP", "MPIO_CNMBR", "VERSION", "geometry"],
    )
    if len(departments) != 33 or departments.DPTO_CCDGO.nunique() != 33:
        raise ValueError("Expected 33 unique department codes")
    if len(municipalities) != 1122 or municipalities.MPIO_CDPMP.nunique() != 1122:
        raise ValueError("Expected 1122 unique five-digit municipality-area codes")
    if not municipalities.MPIO_CDPMP.eq(
        municipalities.DPTO_CCDGO + municipalities.MPIO_CCDGO
    ).all():
        raise ValueError("Municipality code does not match department + local code")

    municipalities = municipalities.merge(
        departments[["DPTO_CCDGO", "DPTO_CNMBR"]],
        on="DPTO_CCDGO",
        validate="many_to_one",
    )
    municipalities = municipalities[
        ["DPTO_CCDGO", "DPTO_CNMBR", "MPIO_CCDGO", "MPIO_CDPMP", "MPIO_CNMBR", "VERSION", "geometry"]
    ]

    OUT.mkdir(parents=True, exist_ok=True)
    for name, layer in (("departamentos", departments), ("municipios", municipalities)):
        result = simplify(layer, args.tolerance_m)
        target = OUT / f"dane_mgn2018_{name}.geojson"
        target.write_text(
            result.to_json(drop_id=True, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"Wrote {target} ({len(result)} features, {target.stat().st_size:,} bytes, {result.crs})")


if __name__ == "__main__":
    main()
