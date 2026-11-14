# Git workflow - Horum Labs

Project: NASA Space Apps 2026 - Harmonization of MODIS and VIIRS Hot Spots

This document defines how we use branches so we do not step on each other and `main` always works.

## 1. Starting point

The project skeleton is pushed to `main` first. It is the base every branch comes from.

Before that first commit, check that:

- [ ] `.gitignore` excludes `.env` and `data/raw/`.
- [ ] There are no keys (MAP_KEY), passwords or personal emails in any file.
- [ ] Heavy original data is not being uploaded.

```bash
git add -A && git commit -m "Project structure"
git push origin main
```

## 2. Branches

`main` must always be in a working state, because the web is published from it. Each person works on a long-lived branch according to their role.

| Branch | Role | What it touches |
|---|---|---|
| `main` | Everyone (integration only) | Stable version |
| `data` | Data | `scripts/`, `notebooks/`, `data/sample/`, `data/processed/`, `docs/METHOD.md` and the data docs |
| `web` | Web | The web folder and its files |
| `delivery` | Delivery | `README.md`, `REFERENCES.md`, `docs/`, demo script |

Rule to avoid collisions: each branch touches different folders. Shared files (`README.md`, `requirements.txt`) are edited by one person only, or the others are told first.

Create your branch from `main` (replace `data` with `web` or `delivery`):

```bash
git checkout main && git pull && git checkout -b data
```

## 3. Daily flow

1. Bring the changes from `main` into your branch before starting:

   ```bash
   git pull origin main
   ```

2. Work on your branch with small, frequent commits and clear messages.
3. Push your branch often, so no work is lost:

   ```bash
   git push origin data
   ```

4. Integrate into `main` when something already works, with a pull request on GitHub. Another person on the team reviews and approves it. Do this several times a day, not at the end.

## 4. Integration moments

| Moment | What is integrated |
|---|---|
| Final data file ready | `data` into `main`. Web connects the calendar to real data |
| Saturday night | First end-to-end calendar on `main` |
| Sunday midday | New features are frozen. Only bug fixes are accepted |
| Sunday afternoon | The published version comes from `main` |

When submitting, tag the version to remember what was sent:

```bash
git tag delivery-final
git push origin delivery-final
```

## 5. Team rules

- Nobody runs `git push --force` on `main`.
- After the first commit, nobody works directly on `main`, except minimal agreed changes.
- If there is a conflict, whoever integrates resolves it, with the other person next to them.
- Heavy data and keys are never uploaded. The MAP_KEY goes in an environment variable or in `.env`.
- Everyone records in `REFERENCES.md` which parts they did with AI help.

## 6. Commit messages

Always in English, simple and short. Present tense, with the area first:

```text
data: add FIRMS API fetch script with cache
web: add map with area selection
delivery: draft project summary in English
```

## 7. If something goes wrong

- You uploaded something you should not have (a key or heavy data): tell the team immediately. Change the key and remove it from the history, not just from the last commit.
- A conflict that cannot be resolved: do not force it. Save the work on another branch and ask for help.
- Branch behind `main`: bring `main` in and resolve before continuing.

```bash
git pull origin main
```

## 8. Optional: protect main

On GitHub, under Settings, Branches, you can require a pull request before `main` is modified. With three people and little time this may be too much, so it is optional.
