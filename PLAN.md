# Work plan - NASA Space Apps 2026

Challenge: Harmonization of MODIS and VIIRS Hot Spots
Team: Horum Labs | Site: Ipiales (virtual) | Hackathon: November 14 and 15, 2026

This is the single plan for the three of us. Follow it step by step, in order. Each step says what to do, who leads it, and when it counts as done.

*Translated to English from the original Spanish plan. Checkmarks for the data work were added on November 14, 2026 (see the notes after each step).*

## 0. Rules we cannot forget

- Submission: opens Saturday the 14th at 9:00 a.m. and closes Sunday the 15th at 11:59 p.m. (Ipiales time). Internal goal: submit before 6:00 p.m. on Sunday.
- Demo is mandatory: a video of at most 30 seconds or at most 7 slides, on a public link with no login. If the video is in Spanish, it must have English subtitles.
- The project page and everything linked from it must be in English.
- At least one NASA dataset must be used, and EVERYTHING external (code, libraries, texts, images) must be listed in the references.
- AI: it may be used to speed up the work (code, debugging, writing), but NOT to come up with how to solve the challenge. The approach and the harmonization method are decided by the three of us. AI use must be declared, with notes in the code, the data and the images (a watermark on generated images).
- No NASA logos or symbols in generated content.
- All three must be on the same site (Ipiales), not on the waiting list, and appear in the Members tab of the team.
- Never upload to the repository: keys (MAP_KEY), passwords, personal emails, or heavy original data.

## 1. Roles and agreements (20-minute meeting)

Roles, which rotate as needed:
- Data: download, cleaning, harmonization and validation.
- Web: map, calendar, CSV download and publishing.
- Delivery: project page, demo, references, AI declaration and final review.

Agree on:
- [ ] Who takes each role.
- [ ] Communication channel and sync times (15 minutes every 3 or 4 hours).
- [ ] One Git branch per role: data, web, delivery. Frequent commits.
- [ ] Work region: all of Colombia, with one test department (for example Meta or Vichada). *Chosen for the sample: Nariño (code 52).*
- [x] Data contract: columns and format of the file that Data gives to Web, with an example file in the data/sample folder. *See [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) and `data/sample/`.*

Done when: all three know their role and the example file exists.

## 2. Access and tools

- [ ] Each person has a NASA Earthdata Login account (optional for the others, mandatory for whoever requests the archive).
- [x] FIRMS MAP_KEY requested. It is kept outside the repository (`.env`, ignored by Git). Limit: 5000 requests every 10 minutes.
- [x] Python with a virtual environment and data libraries (pandas, duckdb, pyarrow, geopandas, requests).
- [ ] Web project created on the web branch.
- [ ] All three are collaborators on the repository.
- [ ] Everyone joined the Ipiales WhatsApp group.
- [x] REFERENCES.md created, with FIRMS, MODIS, VIIRS, DANE and IDEAM.

Done when: Data can make a test query to the API and receive rows. *Done.*

## 3. Getting the FIRMS data

Sources (API names): MODIS_SP, VIIRS_SNPP_SP, VIIRS_NOAA20_SP, VIIRS_NOAA21_SP. The _NRT versions are more recent and get replaced later.

Coverage of the historical archive:
- MODIS Collection 6.1: from November 1, 2000.
- VIIRS S-NPP (375 m): from January 20, 2012.
- VIIRS NOAA-20: from April 1, 2018.
- VIIRS NOAA-21: from March 1, 2023.

Steps:
- [x] Request the historical archive on the FIRMS Archive Download page: Colombia area (approximate box west -79.5, south -4.5, east -66.5, north 12.8), all sensors, all dates, CSV format. It arrives by email.
- [x] While it arrives, test the API by area with 5 days (the API only allows 1 to 5 days per request).
- [x] Complete the most recent days through the API when the archive does not cover them. *The `*_NRT` sources were added to `scripts/download_firms.py`; the pipeline reads those chunks.*
- [x] Keep the originals in data/raw (this folder is NOT uploaded to GitHub) and work on copies.
- [x] Download the department and municipality boundaries from DANE (Marco Geoestadístico Nacional) to clip to Colombia.

Done when: there are MODIS and VIIRS files for Colombia in data/raw and the DANE boundaries are downloaded. *Done.*

## 4. Getting to know the data

Answer with numbers and simple charts:
- [x] Which columns each sensor has and how the confidence of each detection is expressed.
- [x] How many hot spots per year and per sensor.
- [x] Whether there are date gaps or periods without data.
- [x] How many points fall outside Colombia.
- [x] What visible differences there are between MODIS and VIIRS in the years where both exist.

Done when: there is a notebook or script with these answers, to discuss with the team. *Done: `notebooks/01_explore_firms.ipynb`.*

## 5. Deciding the harmonization method (the three of us together)

This decision belongs to the team. It is made with what was learned in step 4 and written in docs/METHOD.md in our own words, with the reason for each choice.

Questions to settle:
- [x] Which quality filters are applied.
- [x] At what spatial and temporal scale the points are grouped.
- [x] How the count is made comparable between sensors.
- [x] How the period when only MODIS exists is treated.
- [x] How uncertainty is communicated.

Done when: docs/METHOD.md exists, all three read it and agree. *The document exists. Still open: the three of you read it and confirm the defaults listed at its end.*

## 6. Implement and validate the harmonization

- [x] Reproducible script that regenerates everything from data/raw. *`scripts/build_dataset.py`, checked by `scripts/check_dataset.py`.*
- [x] Clipping with the official DANE boundaries.
- [x] Compact final file (Parquet or JSON) following the contract from step 1.
- [x] Validation: compare totals by department against the IDEAM semester reports and note where they differ and why. Note: IDEAM clarifies that hot spots are not comparable with field records. *Done at semester level, because IDEAM publishes no monthly figures: see [docs/VALIDATION.md](docs/VALIDATION.md).*
- [x] Note in the code and the data about which parts were done with AI help.

Done when: Web can read the final file and the figures make sense against IDEAM. *The data side is done.*

## 7. Web - minimum version (MVP)

This is built in parallel from step 2 with sample data.
- [ ] Map with a tool to draw the area of interest.
- [ ] Latitude and longitude fields as an alternative.
- [ ] Date range selector.
- [ ] Activity calendar with an accessible color scale.
- [ ] CSV download of what was queried.
- [ ] Short text on the web explaining the method.

Done when: a new user can pick an area and dates and see the calendar without help.

## 8. Web - challenge features

- [ ] Compare the current month against the history (median) of the chosen area.
- [ ] Show which months and years had the most activity.
- [ ] Mark days with unusual activity for that zone and season.
- [ ] Warn where there is little data or there are gaps.
- [ ] Check color contrast, mobile use and loading speed.

Done when: all of the above works with the real data.

## 9. Publish

- [ ] Deploy the web on a free service, with a public link and no login.
- [ ] Test the link in a private window.
- [ ] Request the FortiGuard classification of the site (recommended by the guide) so the judges can open it.
- [ ] README in English with: what it does, how to run it, where the data comes from and how to regenerate it.

Done when: anyone can open the link without an account.

## 10. Submission (Delivery leads, everyone reviews)

On Space Apps: profile picture, My Team, Project tab. Save often with Save Progress and use the edit lock so you do not overwrite each other.

Fields:
- [ ] Project Name.
- [ ] High-Level Summary (in English).
- [ ] Link to Project Demo: 30-second video or 7 slides, public link.
- [ ] Link to Final Project: the published web.
- [ ] Detailed Description (in English): what it does, how it works, benefits, tools.
- [ ] Use of Super Intelligence (SI): how AI was used.
- [ ] NASA Data: FIRMS (MODIS and VIIRS), with detail.
- [ ] Space Agency Partner Data and Other References: everything external, including open source code and the DANE and IDEAM data.
- [ ] Tick the two acceptance boxes.
- [ ] Press Submit (Save Progress is not enough).

## 11. Final review before sending

- [ ] The demo and project links open in a private window.
- [ ] All text is in English.
- [ ] The video has English subtitles if it is in Spanish.
- [ ] The references are complete.
- [ ] The AI declaration is complete and there are marks on images, code and data.
- [ ] All three appear in Members and none is on the waiting list.
- [ ] Sent before 6:00 p.m. on Sunday.

## 12. Plan B if something fails

- The email with the data does not arrive: move forward with the API over a short period and extend later.
- The harmonization gets complicated: deliver a simple version, well explained and with clear limits.
- Time runs short: the minimum is map, calendar and CSV. Everything else is extra.
- The web link fails: leave the repository with run instructions and a video of it working.

## 13. Timeline

Saturday 14:
- Morning: steps 1, 2 and 3. Request the FIRMS archive. Web starts with sample data.
- Afternoon: steps 4 and 5. Web advances the calendar.
- Night: first calendar with real data, end to end.

Sunday 15:
- Morning: steps 6 and 8. Validation, comparison with the history, CSV.
- Midday: freeze new features. Only fix errors. Step 9.
- Afternoon: steps 10 and 11. Demo, texts and submission before 6:00 p.m.
