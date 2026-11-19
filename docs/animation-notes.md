# Character animations

Choose **Preview animations** on the character selection screen or pause menu. Select a character, animation, facing direction and playback speed.

Walking and running follow movement in four directions. Gathering plays when the player interacts with a supply. Building, crafting, fighting and swimming can be inspected in the viewer.

The horizontal walk uses each character's `assets/characters/<id>/<id>-side-walk-v2.png`, cut from the three-character original in `assets/characters/originals/side-walk-v2.png` by `tools/split-character-sheets.py`. The exact production prompt sits beside the original in `side-walk-v2.prompt.txt`. The four poses alternate near-foot contact, far-knee passing, far-foot contact and near-knee passing. The far limbs use darker shading. A common head anchor limits lateral jitter. West mirrors east, including costume details.

The other movement directions and actions use the character-specific locomotion, run and actions sheets in `assets/characters/<id>/` (`scout/`, `builder/`, `survivor/`). Each sheet has a corresponding generation prompt. The action poses face east or mirror to face west.
