// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// NASA GIBS true-color imagery for the selected day, and deep links to NASA Worldview and
// FIRMS so the user can inspect the individual detections behind a day.

import type { RefContext } from './analysis.ts';
import { dayToISO, isoToDay } from './dates.ts';

export interface ImageryLayer {
  id: string;
  label: string;
}

const N20_IMAGERY_START = isoToDay('2018-01-01');

/** Same satellite as the reference series that day, so the picture matches the counts. */
export function imageryForDay(day: number, ctx: RefContext): ImageryLayer {
  if (day < ctx.refStart) return { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', label: 'MODIS Terra true color' };
  const st = ctx.status[day - ctx.refStart];
  if (st !== 0 && day >= N20_IMAGERY_START) {
    return { id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', label: 'VIIRS NOAA-20 true color' };
  }
  return { id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', label: 'VIIRS S-NPP true color' };
}

export function gibsTiles(layer: string, day: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${dayToISO(day)}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

export function worldviewUrl(bounds: [number, number, number, number], day: number, layer: string): string {
  const [w, s, e, n] = bounds.map((v) => v.toFixed(3));
  const layers = [
    'Coastlines_15m',
    'VIIRS_NOAA20_Thermal_Anomalies_375m_All',
    'VIIRS_SNPP_Thermal_Anomalies_375m_All',
    'MODIS_Combined_Thermal_Anomalies_All',
    layer,
  ].join(',');
  return `https://worldview.earthdata.nasa.gov/?v=${w},${s},${e},${n}&l=${layers}&t=${dayToISO(day)}-T17:00:00Z`;
}

export function firmsUrl(bounds: [number, number, number, number], day: number): string {
  const lon = ((bounds[0] + bounds[2]) / 2).toFixed(3);
  const lat = ((bounds[1] + bounds[3]) / 2).toFixed(3);
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const zoom = Math.max(5, Math.min(11, Math.round(Math.log2(360 / Math.max(span, 0.05)) - 0.5)));
  const iso = dayToISO(day);
  return `https://firms.modaps.eosdis.nasa.gov/map/#d:${iso}..${iso};@${lon},${lat},${zoom}.0z`;
}
