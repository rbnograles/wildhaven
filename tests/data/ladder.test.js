// Checks the tool ladder: from each character's start, every tool can be reached using only what
// bare hands can gather plus the tools made along the way. A broken ladder would strand a player
// with no way to their first axe, or make a tool that needs itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_RECIPES, CAMPFIRE_COST } from '../../src/data/balance.js';
import { TOOL_IDS, TIERS } from '../../src/data/tools.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { NODES } from '../../src/world/nodes.js';
import { startingTools } from '../../src/world/tools.js';

// Guards the whole recipe graph, climbing it like a ladder rung by rung: stone tools need what
// hands (or tools already made) can gather; iron needs the stone tool, a hammer and a campfire.
test('every tool is reachable from each character start', () => {
  for (const character of CHARACTERS) {
    const made = new Set(Object.keys(startingTools(character.id)).map((t) => `stone ${t}`));

    /** The resource types the player can gather now: by hand, or with a tool already made. */
    const gatherable = () =>
      new Set(
        NODES.filter(
          (n) => !n.tool || made.has(`stone ${n.tool}`) || made.has(`iron ${n.tool}`),
        ).map((n) => n.type),
      );

    for (let grew = true; grew;) {
      grew = false;
      const can = gatherable();
      const fire = Object.keys(CAMPFIRE_COST).every((type) => can.has(type));
      const hammer = made.has('stone hammer') || made.has('iron hammer');
      for (const tool of TOOL_IDS)
        for (const tier of TIERS) {
          const key = `${tier} ${tool}`;
          const materials = Object.keys(TOOL_RECIPES[tool][tier]).every((t) => can.has(t));
          const extras = tier === 'stone' || (made.has(`stone ${tool}`) && hammer && fire);
          if (!made.has(key) && materials && extras) {
            made.add(key);
            grew = true;
          }
        }
    }

    for (const tool of TOOL_IDS)
      for (const tier of TIERS)
        assert.ok(made.has(`${tier} ${tool}`), `${character.id} can't reach the ${tier} ${tool}`);
  }
});
