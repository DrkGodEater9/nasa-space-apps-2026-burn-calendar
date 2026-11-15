// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Data sources, credits and AI disclosure.

import { Icon } from '../components/Icon.tsx';

const REPO = 'https://github.com/DrkGodEater9/nasa-space-apps-2026-burn-calendar';

const SOURCES = [
  {
    tag: 'NASA',
    name: 'FIRMS active fire data',
    what: 'MODIS Collection 6.1 and VIIRS 375 m (S-NPP, NOAA-20, NOAA-21) hot spots for Colombia: archive download, near-real-time files and the FIRMS area API for the newest days.',
    link: 'https://firms.modaps.eosdis.nasa.gov/',
    cite: "We acknowledge the use of data and imagery from LANCE FIRMS operated by NASA's Goddard Space Flight Center Earth Science Data and Information System (ESDIS) with funding provided by NASA Headquarters.",
  },
  {
    tag: 'NASA',
    name: 'GIBS true-color imagery',
    what: 'Daily VIIRS and MODIS corrected-reflectance images shown under the map for the selected day, and the deep links to NASA Worldview.',
    link: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api',
    cite: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).",
  },
  {
    tag: 'DANE',
    name: 'Marco Geoestadístico Nacional 2018',
    what: 'Department and municipality boundaries (1,122 municipality-level areas), used to assign each detection to a municipality and to answer drawn polygons.',
    link: 'https://www.dane.gov.co/files/geoportal-provisional/',
  },
  {
    tag: 'IDEAM',
    name: 'Semester hot spot reports 2023–2024',
    what: 'Used only to validate the data pipeline, never as an input of the dataset.',
    link: 'https://www.ideam.gov.co/sala-de-prensa/informes/Reporte-semestral-de-Incendios-de-la-Cobertura-Vegetal',
  },
  {
    tag: 'MAP',
    name: 'CARTO Dark Matter basemap',
    what: 'Background map tiles. Map data © OpenStreetMap contributors, style © CARTO.',
    link: 'https://carto.com/basemaps',
  },
];

const SOFTWARE = [
  ['React', 'https://react.dev/', 'UI'],
  ['Vite', 'https://vite.dev/', 'build tool'],
  ['TypeScript', 'https://www.typescriptlang.org/', 'language'],
  ['MapLibre GL JS', 'https://maplibre.org/', 'interactive map'],
  ['Turf.js', 'https://turfjs.org/', 'polygon overlap and point lookup'],
  ['Inter, Space Grotesk, JetBrains Mono (Fontsource)', 'https://fontsource.org/', 'typefaces'],
];

export function DataPage() {
  return (
    <article className="doc">
      <header className="doc-hero">
        <div className="eyebrow"><Icon name="layers" size={14} /> Data & credits</div>
        <h1>Where every number comes from</h1>
        <p>
          All data are public. The processing is reproducible from the raw files with the scripts in the repository, and every
          external source, library and use of AI is listed here.
        </p>
      </header>

      <section className="doc-section">
        <h2>Sources</h2>
        <div className="sources">
          {SOURCES.map((s) => (
            <div key={s.name} className="source">
              <span className={`src-tag ${s.tag.toLowerCase()}`}>{s.tag}</span>
              <h3><a href={s.link} target="_blank" rel="noopener noreferrer">{s.name} <Icon name="external" size={12} /></a></h3>
              <p>{s.what}</p>
              {s.cite && <p className="cite">{s.cite}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="doc-section two">
        <div>
          <h2>Regenerate the data</h2>
          <ol className="bullets numbered">
            <li>Download the FIRMS archive for Colombia into <code>data/raw/</code> (see <code>scripts/download_firms.py</code>; the MAP_KEY goes in <code>.env</code>).</li>
            <li><code>python scripts/build_dataset.py</code> builds every table in <code>data/processed/</code>.</li>
            <li><code>python scripts/export_web_json.py</code> writes the files this site reads.</li>
            <li><code>python scripts/check_dataset.py</code> verifies them.</li>
            <li>In <code>web/</code>: <code>npm install</code>, then <code>npm run build</code>.</li>
          </ol>
          <p className="muted">
            The CSV buttons in the explorer download exactly what you selected: the daily series with its level, sensor and gap
            flags, the per-municipality breakdown, and the monthly comparison with history.
          </p>
        </div>
        <div>
          <h2>Software</h2>
          <ul className="soft-list">
            {SOFTWARE.map(([n, l, w]) => (
              <li key={n}><a href={l} target="_blank" rel="noopener noreferrer">{n}</a><span>{w}</span></li>
            ))}
          </ul>
          <p className="muted small">The data pipeline uses pandas, NumPy, PyArrow, DuckDB, GeoPandas, Shapely and pyproj (see REFERENCES.md).</p>
        </div>
      </section>

      <section className="doc-section">
        <h2>Use of AI</h2>
        <div className="ai-box">
          <Icon name="sparkle" size={20} />
          <div>
            <p>
              <b>The harmonization method is the team's.</b> The choices in METHOD.md (filters, the reference sensor, the
              seasonal baseline, the alert levels, and the rule that rescales MODIS to VIIRS units together with the margins
              of its test) were decided by the three members of Horum Labs, as the
              challenge rules require.
            </p>
            <p>
              AI assistants were used to speed up the work: Claude Code (Anthropic) helped write the data scripts, the data
              documentation and this web application; Codex helped with the DANE boundary processing. Every AI-assisted file
              carries a note in its header. No figure was invented or estimated by AI. The project logo is original artwork
              drawn in code and is not an agency insignia.
            </p>
          </div>
        </div>
      </section>

      <section className="doc-section">
        <h2>About</h2>
        <p>
          Built by <b>Horum Labs</b> (Ipiales, Colombia) for the NASA Space Apps Challenge 2026, challenge "Harmonization of
          MODIS and VIIRS Hot Spots". This is an independent project; it is not endorsed by NASA, DANE or IDEAM.
        </p>
        <a className="btn ghost" href={REPO} target="_blank" rel="noopener noreferrer"><Icon name="github" /> Source code and documentation</a>
      </section>
    </article>
  );
}
