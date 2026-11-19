// Checks that the world art folders and objects.json agree. Ground textures sit in
// assets/world/source/ground/, and each object sprite sits in the kind folder its objects.json
// entry names (objects/trees/, objects/rocks/, ...). The map builder and the game find sprites that way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import OBJECT_SPECS from '../../assets/world/source/objects.json' with { type: 'json' };

/** The folder that holds the world's source art. */
const SOURCE = new URL('../../assets/world/source/', import.meta.url);

/** The kind folders under objects/, one per sort of thing. */
const KINDS = ['trees', 'plants', 'rocks', 'buildings', 'props'];

/** Every sprite entry in objects.json, leaving out the `_comment` note. */
const specs = Object.entries(OBJECT_SPECS).filter(([name]) => !name.startsWith('_'));

/**
 * Lists the PNG files in one folder of the source art, by name without `.png`.
 *
 * @param {string} folder - A folder under assets/world/source/, such as `objects/trees`.
 * @returns {string[]} The sprite or texture names found there.
 */
const pngsIn = (folder) =>
  readdirSync(new URL(folder + '/', SOURCE))
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.slice(0, -4));

// Guards against a sprite listed in objects.json with no kind, a made-up kind, or no file in its
// folder: the map builder would crash and the game would draw nothing there.
test('every objects.json sprite names a kind folder that holds its picture and prompt', () => {
  for (const [name, spec] of specs) {
    assert.ok(KINDS.includes(spec.kind), `${name} has kind ${spec.kind}`);
    for (const ending of ['.png', '.prompt.txt'])
      assert.ok(
        existsSync(new URL(`objects/${spec.kind}/${name}${ending}`, SOURCE)),
        name + ending,
      );
  }
});

// Guards against a sprite file in the wrong folder, a file objects.json doesn't know about, or the
// same name in two folders. The renderer keys sprites by file name alone, so a second copy would
// silently replace the first.
test('every sprite file sits in the folder its objects.json entry names, once', () => {
  assert.deepEqual(readdirSync(new URL('objects/', SOURCE)).sort(), [...KINDS].sort());

  const seen = new Set();
  for (const kind of KINDS)
    for (const name of pngsIn(`objects/${kind}`)) {
      assert.ok(!seen.has(name), `${name} is in more than one folder`);
      seen.add(name);
      assert.equal(OBJECT_SPECS[name]?.kind, kind, `${name}.png is in objects/${kind}/`);
    }
  assert.equal(seen.size, specs.length);
});

// Guards against a ground texture the map builder needs going missing from ground/, or arriving
// without the prompt that made it.
test('every ground texture is in ground/ with its prompt', () => {
  const textures = ['grass', 'dirt', 'jungle', 'rock', 'snow', 'sand', 'water'];
  assert.deepEqual(pngsIn('ground').sort(), [...textures].sort());
  for (const name of textures)
    assert.ok(existsSync(new URL(`ground/${name}.prompt.txt`, SOURCE)), name);
});
