# Tiled terrain kits

The user wants terrain art suitable for manually drafting maps in Tiled, with designed edges and corners, and requested both existing-texture and redrawn-texture versions.

Build two separate 64px terrain palettes under `assets/world/tiled`, preserving existing object sheets and runtime map outputs. Each palette has nine material groups, each with the complete 16 corner configurations (including empty), arranged as a recognizable 3×3 rounded patch plus inner corners and diagonal cases. Each material gets an external TSX corner Terrain Set transitioning to transparency. Paint different materials on separate layers so underlying ground remains visible.

The existing version reuses current material sources. The redrawn version uses the new image_gen material atlas in `tiled/source`. A deterministic atlas builder handles exact tile geometry, sampling, edge continuity, metadata and sample maps. Distinct grass/soil/snow/stone/water boundary treatments make the edge readable. PNG/TSX IDs are stable; the game does not load these new files automatically.

Approaches considered: merely reorganizing the runtime atlas retains hundreds of phase-dependent variants and is cumbersome for hand painting; asking image generation for an exact assembled autotile grid cannot guarantee pixel joins. Chosen: generated material art plus deterministic tile assembly, with original-material and redrawn-material variants. This is an implementation choice, not a new gameplay feature.

Deliverables: two PNG/TSX palettes, index JSON, two editable demonstration TMX maps, preview renders, usage README and rebuild script. Verify all compatible tile boundaries, all 16 corner patterns, references and dimensions, and that rebuilding never writes runtime map assets. Terrain brush uses Tiled 1.5+ corner sets. Samples are editor demonstrations, not game-importable maps.
