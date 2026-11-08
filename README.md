# Checksheet Plant · PPA Site Berau

A public web app for picking and downloading maintenance checksheets as A4 PDFs (one sheet per page) or as the original Excel file. It has no server and no database. It works offline for any template that has been opened before.

## Structure
- `template-checksheet/`: source xlsx files (one file per unit type)
- `config.json`: text to remove or replace (e.g. site codes), template IDs, categories
- `build.py`: xlsx → A4 page setup + text replacement → PDF (via MS Excel) → thumbnails → `site/data.json`
- `tools/pages.swift`: renders thumbnails and validates the PDF (A4, page count, forbidden text)
- `site/`: the static web app (vanilla JS, service worker, pdf-lib for merging pages)

## Build (macOS with Microsoft Excel + Xcode CLT)
```sh
python3 build.py test   # self-check
python3 build.py        # rebuild only the templates that changed
python3 build.py --all  # rebuild everything (after editing config.json)
```
The build fails if a page isn't A4, if the page count doesn't match the sheet count, or if text from `config.json → forbidden` is still present.

## Add or revise a template
1. Put the xlsx in `template-checksheet/`.
2. `python3 build.py`
3. Deploy the `site/` folder.

## Change the site code
Edit `config.json → replace`, then run `python3 build.py --all`.

## Run locally
```sh
cd site && python3 -m http.server 8765
```
