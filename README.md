# Mandarin Flashcards

A lightweight, mobile-friendly Mandarin study app hosted as a static website (GitHub Pages). The app contains 335 cards, including extended HSK 1 terms and vocabulary from prior lessons.

## Adding vocabulary

1. Copy the structure from one of the files in `data/packs/`.
2. Assign **new, unique, permanent card IDs** such as `custom-kitchen-001`. Never change an existing `id`; its review history and stars are keyed to that ID.
3. Include the Chinese term (`zh`), tone-marked pinyin (`py`), English meaning (`en`), topic (`topic`), and **two examples** in `examples`: `[Chinese, pinyin, English]`.
4. Save the new pack under `data/packs/` and add a path to `data/manifest.json`. The app loads every listed pack and detects duplicates or malformed entries.
5. Bump the cache version in `sw.js` when changing content or app code, to make offline installations update promptly.

Example:

```json
{"id":"custom-kitchen-001","zh":"勺子","py":"sháozi","en":"spoon","topic":"Kitchen","examples":[["这是勺子。","Zhè shì sháozi.","This is a spoon."],["我用勺子喝汤。","Wǒ yòng sháozi hē tāng.","I use a spoon to drink soup."]]}
```

## Personal learning history

Reviews, scheduling, stars and preferences are saved in the viewer's **own browser localStorage**, using the same history/stars/settings keys as earlier versions. A review event log stores each answer with a timestamp. In Settings, use **Export progress** regularly and **Import progress** to restore or move it to another browser/device. Do not commit backup JSON files to this public repository. Browsers do not automatically synchronize data across devices, and browser storage may be cleared by the user or browser.

Historical downloads opened as `file://` do not share storage with the GitHub Pages origin and cannot be migrated automatically. Export/import is available in this hosted version for future backups.

## Files

- `data/manifest.json`: vocabulary pack registry
- `data/packs/*.json`: expandable card sets
- `js/app.js`: interface and card loading
- `js/scheduler.js`: adaptive card selection and intervals
- `js/storage.js`: local persistence, history, export/import
- `sw.js`: offline asset caching

## Hosting

On GitHub: **Settings → Pages → Build and deployment: Deploy from a branch → `main` / root**.
The site will be available at `https://ulylab.github.io/mandarin-flashcards/` once Pages has been enabled.
