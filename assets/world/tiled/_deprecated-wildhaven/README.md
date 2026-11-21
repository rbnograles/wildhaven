# Deprecated — old Wildhaven authoring sheets

These are the original **seven-region Wildhaven** Tiled authoring files. They are **deprecated** and kept only for history and for the legacy importer. **Do not author new maps from them.**

The active starting map for all players is **Spring Country**, in `assets/world/spring-country/` (`spring-country.tmj`). See `assets/world/spring-country/SPRING-COUNTRY.md`.

## What is here

| File | Was |
| --- | --- |
| `wildhaven-world.tmj` | the hand-edited seven-region world |
| `wildhaven-world-arranged.tmj` | the arranged world (villages, paths, caves); Spring Country's geography base |
| `wildhaven-sheet.png` / `.json` / `.tsx` | the one Wildhaven sprite sheet and its index/palette |
| `wildhaven-objects.tsx` | the same sheet as one tile per whole object |

The shared terrain and path kits (`terrain-redrawn.*`, `path-connectors.*`) are **not** here — they stay in `assets/world/tiled/` because Spring Country still uses them.

## Which tool does what now

- **Spring Country (active):** author/regenerate with `tools/build-spring-country.py`; bring it into the game with `tools/import-spring-country.py`.
- **Old Wildhaven (frozen):** `tools/import-tiled-world.py` still reads these files from this folder. The other Wildhaven-pipeline tools (`build-tiled-sheet.py`, `tiled_path_connectors.py`, `export-tiled-world.py`, `tidy-tiled-world.py`, `arrange-tiled-world.py`, `add-tiled-herbs.py`, `build-snow-banks.py`) are deprecated; their default paths were not rewired to this folder.
