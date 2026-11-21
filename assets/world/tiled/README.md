# Wildhaven terrain for Tiled

## Snow and sand paths

Open [path-snow-sand-demo.tmx](path-snow-sand-demo.tmx) or add [path-snow-sand.tsx](path-snow-sand.tsx) as an existing tileset. The [rendered demo](path-snow-sand-demo.png) shows both materials. This separate palette preserves all existing tileset IDs and does not change the Spring country terrain.

The 64 tiles use a 64px grid, 1px margin and 2px spacing. The upper two 4x4 blocks contain narrow snow/sand paths with matching 32px openings, straights, turns, T junctions, crossings and end caps. Choose **Snow path - narrow** or **Sand path - narrow** in Terrain Sets and paint on a layer above ground. The lower blocks contain wider corner-terrain pieces; choose **Snow path - wide / diagonal** or **Sand path - wide / diagonal** for diagonal trails, wider roads and plazas. Use each set on its own layer; there are no automatic transitions between narrow/wide styles or different materials.

Rebuild with `python tools/build-seasonal-paths.py`. Narrow art uses the built-in image generator; the exact prompt is [source/path-snow-sand.prompt.txt](source/path-snow-sand.prompt.txt), with original and slicing-sized sources alongside it. Wide pieces reuse the existing redrawn snow/sand terrain textures and their deterministic connecting contours. Verify with `python -m unittest discover -s tests/tools -p test_seasonal_paths.py`. The check compares every compatible exported boundary in all four Terrain Sets. These are editor assets; runtime collision and movement behavior are not assigned.

## Connecting paths (corrected)

Open [path-connectors-demo.tmx](path-connectors-demo.tmx) to see continuous dirt, cobblestone, boardwalk and stepping-stone paths, or inspect the [assembled preview](path-connectors-demo.png).

Use **[path-connectors.tsx](path-connectors.tsx)** for paths. It contains 64 single-cell tiles: four materials with straight pieces, all four corners, all four T junctions, crossroads, four end caps and an empty tile. Each tile is 64 by 64 pixels; every opening has a matching centered 32px cross-section. Paint above the ground on a separate tile layer. Choose the matching **Path - ...** edge Terrain Set and Terrain Brush to connect automatically, or stamp the needed directional tiles manually. Each tile's `connections` property lists N/E/S/W exits. Different path materials do not have transition pieces; use one material per connected route.

The corrected connectors are also appended at the **bottom of `wildhaven-sheet.tsx`**, with the same four Terrain Sets. Reload that external tileset if it is already open. Original tile IDs and object positions are preserved.

The earlier `path-dirt-a/b` and `path-...-straight/bend/tee/cross` pieces higher in the old sheet are loose sprite stamps, **not grid connectors**. They contain padding and independently positioned openings; nearly invisible alpha also inflated their trim bounds. Already-painted old stamps will not change automatically. Replace those stamps using the corrected connector tiles. They remain at their original IDs to avoid corrupting existing maps.

Rebuild with `python tools/tiled_path_connectors.py`. The existing `python tools/build-tiled-sheet.py` command also appends this connector set after rebuilding its original contents. Source art was generated/edited with the built-in image generator; exact prompts are beside `source/path-connectors.png` and the selected `source/path-connectors-clean.png`. The packer aligns the openings, removes faint background alpha and normalizes shared edge samples.

Connector checks cover every compatible shared boundary in all four materials, open/closed exits, edge Terrain Set metadata, and preservation of legacy pixels/tile IDs when appending. The assembled preview includes turns, loops, junctions and end caps.

## Ground terrain

Two editable terrain kits use the same tile layout:

| Kit | Open this sample in Tiled | Tileset |
| --- | --- | --- |
| Existing ground textures with connecting edges | [terrain-current-demo.tmx](terrain-current-demo.tmx) | [terrain-current.tsx](terrain-current.tsx) |
| Newly generated ground textures with connecting edges | [terrain-redrawn-demo.tmx](terrain-redrawn-demo.tmx) | [terrain-redrawn.tsx](terrain-redrawn.tsx) |

Each kit contains 144 tiles: nine materials with all 16 corner configurations, including the empty configuration. Materials are grass, dirt, soil, jungle, rock, snow, sand, shallow water (`water`) and deep water (`deep`). Exposed edges have a thin material-colored rim; center tiles have no border. These are static terrain tiles, not water animation frames.

## Start drafting

1. Open one of the sample TMX files, then **Save As** a new map before editing. The samples are 32 by 24 tiles and already reference the matching external TSX.
2. Keep the PNG and TSX together. For a different map, add the existing TSX rather than importing the PNG as a new tileset; the TSX contains the Terrain Sets.
3. Use an orthogonal map with **64 by 64 pixel tiles**. The palette has **1 pixel margin** and **2 pixel spacing**, already configured in the TSX.
4. Fill the bottom layer with a solid material. Add a separate tile layer for each material painted above it, as in the sample. For example, put grass above sand, or snow above rock.
5. Select the matching material in Tiled's **Terrain Sets** view and paint with **Terrain Brush**. The corner assignments let Tiled choose connecting sides, outer corners and inner corners. The unset terrain is transparent, showing the layer below.
6. For manual stamping, use the Tilesets palette. Each material occupies a 4 by 4 block. Its upper-left 3 by 3 cells form a complete rounded patch; the bottom row contains inner corners and the final column contains the empty and diagonal cases.

These are material-to-transparent sets. Paint separate materials on separate layers; they are not a single-layer, every-material-to-every-material transition set. The four-corner scheme makes rounded outlines at half-tile positions. It does not include cliffs, bank props or elevation collision.

The existing `wildhaven-sheet.tsx` and `wildhaven-objects.tsx` remain available for the other art. Keep objects on their own layers. Adding this terrain kit does not assign collision, spawn points, biome rules or gameplay behavior.

## Preview and rebuild

- [Current material sample render](terrain-current-demo.png)
- [Redrawn material sample render](terrain-redrawn-demo.png)
- [Generated material source](source/terrain-materials-redrawn.png) and its adjacent generation prompt
- `terrain-current.json` and `terrain-redrawn.json` map material/corner masks to local tile IDs; these are indexes, not Tiled maps.

From the repository root, with NumPy and Pillow available:

```powershell
python tools/build-tiled-terrain.py
python -m unittest discover -s tests/tools -p test_tiled_terrain.py
```

Rebuilding overwrites the two palettes, their TSX/index files, and their demo TMX/PNG files. Save custom maps under another name. The builder reads existing ground sources for the current version and the generated atlas for the redrawn version. It does not rebuild the live game map or the existing object sheet.

## Verification and integration status

Automated checks cover all compatible horizontal and vertical joins for both versions, transparent empty tiles, opaque center tiles, corner ordering, image dimensions and sample map references. The redrawn TMX opened and rendered in the installed Tiled editor. A manual Terrain Brush painting stroke has not been verified in the editor.

These files are ready for map authoring. They have not replaced `assets/world/map/tileset.png` or been wired into the game's map loading pipeline. A finished map still needs export and integration with the game's layer, collision and object conventions.

See the [official Tiled terrain documentation](https://doc.mapeditor.org/en/stable/manual/terrain/) for the Terrain Sets view and Terrain Brush workflow.
