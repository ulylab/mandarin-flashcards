# Mandarin Flashcards

A lightweight, mobile-friendly Mandarin study app hosted as a static website (GitHub Pages). The app contains **794 cards**: 504 vocabulary, 250 sentence cards, and 40 original HSK 1 test-preparation questions.

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

## Studying multiple question banks

In Settings, select any combination of **Question banks** (the topics formerly shown in the single-choice Topic menu). Use **Select all** to include every bank or **Clear** to start a new selection. Cards from selected banks are mixed by the existing scheduler; review history and stars remain attached to their original card IDs. Your choice is stored in browser settings and included in progress backups. Earlier backups with a single `topic` preference are supported.

## Personal learning history

Reviews, scheduling, stars and preferences are saved in the viewer's **own browser localStorage**, using the same history/stars/settings keys as earlier versions. A review event log stores each answer with a timestamp. In Settings, use **Export progress** regularly and **Import progress** to restore or move it to another browser/device. Do not commit backup JSON files to this public repository. Browsers do not automatically synchronize data across devices, and browser storage may be cleared by the user or browser.

Historical downloads opened as `file://` do not share storage with the GitHub Pages origin and cannot be migrated automatically. Export/import is available in this hosted version for future backups.

## Files

- `data/manifest.json`: vocabulary pack registry
- `data/packs/*.json`: expandable card sets
- `js/app.js`: interface and card loading
- `js/scheduler.js`: adaptive card selection and intervals
- `js/banks.js`: multi-bank filtering and legacy settings migration
- `js/storage.js`: local persistence, history, export/import
- `sw.js`: offline asset caching

## Hosting

On GitHub: **Settings → Pages → Build and deployment: Deploy from a branch → `main` / root**.
The site will be available at `https://ulylab.github.io/mandarin-flashcards/` once Pages has been enabled.


## Sentence cards (HSK 1)

The app includes 100 optional contextual **sentence cards** in twelve independent
vocabulary packs under `data/packs/sentences-*.json` (10 easy/medium or 5 hard cards per pack; 40 easy, 40 medium, 20 hard). They are enabled
by default and can be toggled under **Settings → Include sentence cards**.
The card background and upper-right difficulty label distinguish levels.
The reverse includes a natural English translation and a segmented,
word-by-word Mandarin / pinyin / English breakdown.

Sentence IDs follow `sentence-<difficulty>-###` and are independent of the
original 335 word card IDs. Grading, favorites, and history are tracked by ID.
To extend, add a JSON pack conforming to the sentence schema and register
it in `data/manifest.json`. Run `python tools/validate.py` before publishing.
Hard means **longer construction**, not substantially harder vocabulary.

## HSK Standard Course 1: all 15 chapters

The existing **169 HSK Book 1 word cards** have permanent IDs and lesson metadata.
Words from all 15 lessons can be studied through the corresponding **HSK 1 · Chapter 1–15** banks,
or together in the original **HSK Book 1 vocabulary** bank. These are *additional bank
memberships*, not duplicate cards: selecting both banks does not duplicate a question or
reset progress. The six book words without a chapter assignment remain in the general bank.

Chapters **11–15** add 50 new sentence cards (10 per chapter) with word-by-word breakdowns,
pinyin and English. The topics are time, weather, ongoing actions, shopping and transport.
They respect the existing sentence-card toggle and scheduling history.

## HSK Test Prep (Book 1 / older HSK 1)

Select **HSK Test Prep** under Settings → Question banks to review 40 original practice
questions: **20 listening** and **20 reading**, each with three choices, the correct answer
and an explanation on the reverse. Listening questions hide the Chinese text on the
front and use the browser's Chinese text-to-speech engine for playback (speech quality
and voice availability vary by browser). Reading questions display Chinese text and
optional pinyin. Use **Study again** / **Got it** to self-grade after flipping.

This is **supplementary practice**, not an official mock exam or a replacement for
authentic recorded listening tests. It follows **HSK Standard Course 1**, based on the
older 150-word HSK 1 syllabus (HSK 2.0). **HSK 3.0 officially launches on 13 December 2026**
and has a different, larger vocabulary syllabus. Consult the exam centre and its
current syllabus before choosing exam preparation materials.
