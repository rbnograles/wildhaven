# Normal HUD source art

`normal-hud-components.png` is the no-snow companion to `../winter/winter-hud-components.png`, generated with the built-in image-generation tool using the winter sheet as the edit reference. The exact prompt is saved in the neighboring `.prompt.txt` file.

Both sheets are 1536 × 1024. The eight components retain the same arrangement: goals, region banner, player panel; item box, minimap frame, build popup; toast, key prompt. Snow, ice and frost were removed from the normal variant.

Intended behavior: normal terrain selects the normal HUD skin; a snowy field selects the winter skin so the HUD controls also accumulate snow visually. Share content bounds and hit targets between both skins, leaving room for winter decorations. Use the same crops for paired components and verify their frame registration before switching in the engine.

The seasonal switch is demonstrated in `docs/design/hud-season-preview.html`. Runtime biome switching has not been implemented by this asset generation task.

The generated magenta background has small color variations, as does the winter source. Exact #FF00FF normalization and final cutouts / 9-slice definitions remain export work.
