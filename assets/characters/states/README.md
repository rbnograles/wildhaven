# Survival character sprites

Seven transparent animation sheets generated with the built-in image-generation tool on 2026-11-19, using `../originals/starting-characters-idle-v1.png` as the character and style reference. Each PNG has its exact production prompt beside it.

The original seven sheets have **four chronological frames across and three characters down**: Scout, Builder, Survivor. The art faces right in the existing elevated three-quarter view. Read each row from left to right. All equipment remains on the character.

| Sheet | Poses | Suggested playback |
| --- | --- | --- |
| `dying.png` | Slump, knees buckle, collapse, lying still | 4 fps; hold last frame |
| `sleeping.png` | Four gentle breathing phases while lying on side | 2 fps; loop |
| `waking-up.png` | Lying, pushing upright, kneeling, standing | 4 fps; play once |
| `hungry.png` | Hand on belly, glance down, rub stomach, recover | 3 fps; loop |
| `damage-hunger.png` | Weak stance, stomach cramp, doubled over, partial recovery | 6 fps; play once |
| `damage-cold.png` | Self-hug, raised shoulders, strong shiver, ease | 6 fps; play once per damage event |
| `damage-attack.png` | Brace, recoil, stagger, regain balance | 8 fps; play once |

The adjacent `manifest.json` records measured image dimensions and nominal cell rectangles. Keep the original pixels and transparency when extracting frames. Generated poses may need individual pivot and scale adjustments for smooth in-game playback, especially when transitioning between separate sheets. The timings above are starting values, not playtested timings.

`python tools/split-character-sheets.py` cuts every sheet except `dying.png` into one row per character (`<id>/<id>-sleeping.png` and so on), which is what the game loads. They are registered in `src/animation/clips.js` as `sleep`, `wake`, `hungry`, `hurtHunger`, `hurtCold` and `hurtAttack`:

- `sleep` and `wake`: closing the pass-out screen moves the character to a fire, where they get up (`wake`); resting at a camp shows a 2 s nap (`sleep`), then getting up.
- `hungry`: the standing pose while hunger is below 25.
- `hurtCold`: a shiver every 3 s while freezing drains health.
- `hurtHunger`: a cramp every 10 s while starving, which slowly drains health down to a floor of 25.
- `hurtAttack`: preview dialog only. Nothing attacks the player yet.

`dying.png` is not used; the game plays `dying-v2` (below).

## Dying v2 — six-frame collapse

`dying-v2.png` is a new six-column, three-character master atlas generated with the built-in image tool. It progresses from weak standing, buckling knees, kneeling, falling onto the side, rolling onto the back, to a limp motionless pose. Unlike the sleeping pose, the last frame lies on the back with loose extended legs and relaxed arms. The original four-frame `dying.png` is preserved.

Prepared character sheets are `../scout/scout-dying-v2.png`, `../builder/builder-dying-v2.png` and `../survivor/survivor-dying-v2.png`. Each is **2016×320**, containing **six 336×320 cells**. Source pixels were copied without resizing, centered horizontally and aligned to a shared ground baseline at y=304. Suggested playback: **6 fps, once, hold the last frame**. Use a nominal origin of `(0.5, 0.95)` for the prepared cells and check the transition against other animations in-engine.

`dying-v2.manifest.json` records exact master source rectangles, packed cell rectangles and offsets. The generated master's spacing is not uniform, so use those rectangles or the prepared character sheets rather than dividing the master into six equal columns. Exact generation prompts sit next to the master and each prepared sheet. All 18 prepared frames were checked for visible artwork, transparency and clear margins. The game loads the prepared character sheets as the `dying` sheet in `src/animation/sheets.js` and plays them as the `collapse` clip (6 fps, once, last frame held): when health reaches 0 the character falls where they stand for 1.8 s, then the pass-out screen comes up over them; only its "Get up" button moves them to a fire, where `wake` plays.
