# Tiled Terrain Kits Implementation Plan

> Execute inline using superpowers:executing-plans.

**Goal:** Deliver original and redrawn terrain palettes that can be painted manually in Tiled with connecting edges.
**Architecture:** Dedicated offline builder reads existing textures and generated material atlas, assembles 64px corner tiles, writes two TSX corner sets and sample TMX maps under the Tiled folder.
**Tech Stack:** Existing Python, NumPy, Pillow; XML standard library.
**Spec:** `docs/superpowers/specs/2026-11-20-tiled-terrain-kits-design.md`.

## Constraints and review focus
- Preserve runtime map and current Tiled object sheets.
- Transparent empty cells must not become opaque squares.
- Every horizontal/vertical pair with matching corner assignments must have identical shared boundary pixels.
- PNG dimensions, margin, spacing, tile IDs and Wang corner ordering must agree.
- Both material variants need complete terrain sets and resolvable sample-map references.

## Task 1: Tile assembly and metadata
- [x] Write `tests/tools/test_tiled_terrain.py`: assert 16 unique masks, correct Wang ordering, transparent empty/opaque full tiles, every compatible boundary equality, and output XML references.
- [x] Run test and observe missing builder failure.
- [x] Implement `tools/build-tiled-terrain.py`: material loading, seamless sampling, rounded corner masks, edge finish, 12×12 packed palette, TSX/index/sample-map outputs.
- [x] Run tests and build both variants.

## Task 2: Delivery review
- [x] Inspect sample renders and palette at actual tile scale; correct visual issues.
- [x] Verify sample maps with available Tiled tooling or XML/reference checks, document exact verification limits.
- [x] Write `assets/world/tiled/README.md` with which files to open, layer setup, Terrain Brush use and regeneration command.

## Verification result
Three automated tests pass. Both kits and sample renders were built and visually inspected. The redrawn sample opened and rendered in native Tiled without an error dialog; manual Terrain Brush strokes were not verified. Runtime map and existing object-sheet hashes were unchanged by generation.

