# Project AI Coding Skill & Guidelines - Horum Labs

**Project:** NASA Space Apps 2026 - Harmonization of MODIS and VIIRS Hot Spots (Colombia)
**Team:** Horum Labs (Ipiales)

You are an expert AI software engineering assistant working on this repository. Before writing code, creating files, or executing terminal commands, read `README.md`, `docs/METHOD.md`, and these guidelines. `PLAN.md` and `docs/GIT_WORKFLOW.md` were removed during the team's documentation consolidation; the branch rules below remain applicable. Integration changes explicitly requested by the user are authorized exceptions to role boundaries.

---

## 1. Language & Naming Conventions (STRICT ENGLISH ONLY)

Even if the developer prompts you in Spanish, **100% of your technical output in the repository must be in English**:

*   **Source Code:** All variables, functions, classes, types, constants, and SQL/DuckDB queries must be named in English.
*   **Comments & Docstrings:** All inline comments, docstrings, and technical explanations inside code files must be written in English.
*   **UI & Copy:** Every label, tooltip, button, error message, and explanation in the web interface must be in English.
*   **Documentation:** Any updates to `README.md`, `REFERENCES.md`, or `docs/METHOD.md` must be in English.
*   **File & Directory Naming:** All newly created files and folders must use clear, descriptive English names:
    *   **Python scripts & notebooks (`scripts/`, `notebooks/`):** Use `snake_case` (e.g., `fetch_firms_api.py`, `harmonize_hotspots.py`, `validate_ideam.py`).
    *   **Data files (`data/sample/`):** Use `snake_case` (e.g., `colombia_hotspots_sample.parquet`, `dane_boundaries.geojson`).
    *   **Web components (`web/`):** Use `PascalCase` for UI components (e.g., `ActivityCalendar.tsx`, `MapSelector.tsx`) and `camelCase` or `kebab-case` for utilities/hooks (e.g., `useHotspotData.ts`, `csv-exporter.ts`).
    *   **Documentation (`docs/`):** Use `UPPER_SNAKE_CASE.md` for root/core docs (e.g., `METHOD.md`, `REFERENCES.md`) or `kebab-case.md` for sub-guides.

---

## 2. NASA Space Apps Compliance & AI Attribution (CRITICAL)

Follow the project's recorded hackathon requirements and the supplied submission guide:
*   **Human-Led Scientific Method:** You may assist with coding, statistical implementation, debugging, and writing, **NEVER** invent or unilaterally replace the core scientific harmonization method defined by the team in `docs/METHOD.md`.
*   **Mandatory AI Disclosure in Code:** Whenever you generate or significantly refactor a script, module, or data transformation pipeline, include a brief header or docstring attribution note:
    ```python
    # Note: Implementation assisted by AI (Claude/Codex) following Horum Labs' methodology.
    ```
*   **Track External Dependencies:** Whenever you introduce a new library, dataset, or external snippet, remind the developer to log it in `REFERENCES.md` (along with FIRMS, MODIS, VIIRS, DANE, and IDEAM).
*   **No NASA Logos:** Never add NASA logos, insignias, or official emblems to the web UI or generated assets.

---

## 3. Security & Data Hygiene

*   **Secrets Protection:** NEVER hardcode `MAP_KEY` (FIRMS API key), credentials, or personal emails in any file. Always read `MAP_KEY` from environment variables (`os.getenv("MAP_KEY")` or `.env`).
*   **Heavy Data Protection:** Raw satellite archives belong strictly in `data/raw/` (which is git-ignored). Never write scripts that commit or move raw multi-gigabyte CSVs into tracked folders. Only output compact, aggregated files (Parquet, JSON, or sample CSVs) to tracked directories like `data/sample/`.

---

## 4. Architecture & Role Separation (Git Workflow)

Respect these branch boundaries to prevent merge conflicts:

1.  **`data` branch scope:** Only touch `scripts/`, `notebooks/`, `data/sample/`, and `docs/METHOD.md`.
    *   *Tech stack:* Python (`pandas`, `duckdb`, `pyarrow`, `geopandas`, `requests`).
    *   *Focus:* FIRMS API fetching (`MODIS_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_SP`, `VIIRS_NOAA21_SP`), clipping to Colombia (`[-79.5, -4.5, -66.5, 12.8]` + DANE official boundaries), quality filtering, statistical normalization/harmonization, and IDEAM validation.
2.  **`web` branch scope:** Only touch the web application directory.
    *   *Focus:* Interactive map with bounding-box/area drawing, lat/lon inputs, date range picker, accessible color-scale activity calendar, historical median comparison, anomaly flagging, and CSV export.
3.  **`delivery` branch scope:** Only touch `README.md`, `REFERENCES.md`, `docs/`, and presentation scripts.

*Rule:* Before editing shared files like `README.md` or `requirements.txt`, ask the user for confirmation.

---

## 5. Statistical & Data Processing Standards

When asked to write statistical or data harmonization code:
1.  **Exploratory Checks First:** Verify schema, date gaps, confidence levels (categorical in VIIRS vs. numeric $0-100$ in MODIS), and out-of-bounds coordinates before applying transformations.
2.  **Reproducibility:** All scripts must be deterministic and reproducible from `data/raw/` inputs.
3.  **Data Contract:** Ensure any output file generated for the frontend strictly matches the column names and data types agreed upon in `data/sample/`.

---

## 6. Git Commit Message Format

Whenever you suggest or create a Git commit, it **MUST** be in English, present tense, concise, and prefixed with the role area:
*   `data: add FIRMS API fetch script with cache`
*   `web: add map with area selection and lat/lon inputs`
*   `delivery: update AI usage disclosure in REFERENCES.md`
