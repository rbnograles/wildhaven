// Checks that the "pure" game-rule files never reach for browser-only things.
// The other tests load those files straight into Node, which has no web page, no window and
// no images. If a rule file starts using one of those, every test that imports it would break.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// These modules must keep running under plain Node: the unit tests import them directly.

/** The src/ folder, as a URL so file paths can be built from it. */
const SRC = new URL('../src/', import.meta.url);

/**
 * Every pure module, as a path inside src/: all the .js files in data/, world/, actions/ and
 * game/ (including any subfolders), plus animation/clips.js (the one animation file with no drawing code in it) and the world
 * editor's model and lookups (editor/model.js, editor/lookups.js), which its tests load in Node.
 */
const PURE = [
  ...['data', 'world', 'actions', 'game'].flatMap((dir) =>
    readdirSync(new URL(`${dir}/`, SRC), { recursive: true })
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => `${dir}/${f}`),
  ),
  'animation/clips.js',
  'editor/model.js',
  'editor/lookups.js',
  'editor/edits.js',
];

/**
 * How an import can be written: `from '...'`, a bare `import '...'`, or a dynamic `import('...')`.
 * This is put in front of a path pattern so all three forms are caught.
 */
const IMPORT = String.raw`(?:from\s+|import\s*\(?\s*)['"]`;

/**
 * Things a pure module is not allowed to contain. Each entry is a pattern to search for and a
 * short name for it, used in the failure message.
 */
const FORBIDDEN = [
  [new RegExp(String.raw`${IMPORT}[^'"]+\.(png|webp|jpe?g|css)['"]`), 'an image or CSS import'],
  [/import\.meta/, 'import.meta'],
  [/\bdocument\b/, 'document'],
  [/\bwindow\b/, 'window'],
  [new RegExp(String.raw`${IMPORT}[^'"]*\/(ui|core|render)\/`), 'a browser-layer import'],
  [new RegExp(String.raw`${IMPORT}[^'"]*(sheets|preview)\.js['"]`), 'a browser animation import'],
];

/** Removes block comments and double-slash line comments, so a comment that mentions "window" is not a use. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

// Catches a rule file that quietly starts using the page, the window, or an image import.
// The count check also catches the file list going empty, which would make the test pass for nothing.
test('pure modules avoid browser-only imports and globals', () => {
  assert.ok(PURE.length >= 12, `expected at least 12 pure modules, found ${PURE.length}`);

  for (const file of PURE) {
    const source = stripComments(readFileSync(new URL(file, SRC), 'utf8'));
    for (const [pattern, label] of FORBIDDEN)
      assert.doesNotMatch(source, pattern, `${file} uses ${label}`);
  }
});

// The text search above can miss things, so this actually loads each file in Node.
// It fails if any of them crashes on import.
test('pure modules import cleanly in Node', async () => {
  for (const file of PURE) await import(new URL(file, SRC));
});
