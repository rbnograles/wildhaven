# Status and inventory HUD component atlases

[Normal PNG](../../assets/ui/normal/status-inventory-components.png) · [Winter PNG](../../assets/ui/winter/status-inventory-components.png) · [Theme comparison preview](status-inventory-preview.html)

Character correction: both atlases now use the approved scout instead of the screenshot's red-hat character. The [six-portrait sheet](../../assets/ui/character-portraits-normal-winter.png) supplies all three playable characters: columns scout, builder, survivor; top row normal, bottom row winter. This 1536 × 1024 sheet has a 3 × 2 layout. All identities reference `assets/characters/originals/starting-characters-idle-v1.png`; winter changes the frame decoration, not the characters' outfits. Select the portrait matching the player during integration.

Two 1536 × 1024 RGBA source sheets generated using the built-in image-generation tool. The normal sheet references the user's cropped Wildhaven HUD; the winter sheet references both that image and the generated normal sheet. Exact prompts are saved beside each PNG in `.prompt.txt` files.

Each theme includes these eighteen separate components, in reading order:

1. Empty player-status outer frame
2. Empty inventory outer frame
3. Character portrait medallion
4. Day/night dial
5. Empty status-bar trough
6. Red health fill
7. Ochre hunger fill
8. Blue/orange temperature fill
9. Heart icon
10. Fork-and-spoon icon
11. Flame icon
12. Logs icon
13. Stone cluster icon
14. Berries icon
15. Herb icon
16. Empty inventory slot
17. Empty quantity badge
18. Build button with hammer icon centered horizontally and vertically

The winter variant adds snow caps, frost and icicles to the frames while retaining the same overall component arrangement. Labels and quantities are left out for runtime rendering. Both files were checked for PNG integrity and alpha transparency. Their original generated pixels are preserved.

These are component atlases rather than assembled HUD screenshots. Individual cutouts, final paired crop/pivot alignment, nine-slice definitions, interactive bars and automatic biome switching still need game integration. The day/night dial is a single painted sprite; a separately rotating pointer is not included.
