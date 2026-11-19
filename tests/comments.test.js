// Checks the repo's commenting rule: every named function, method and class in src/ and tests/
// has a comment directly above it (see "Code style" in CLAUDE.md). If someone adds a function
// without one, this test names the file and line, so the rule can't quietly slip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);

// Shapes of a named function in Prettier-formatted code. Each pattern captures the name.
// Anonymous callbacks, like `.map((c) => ...)` or `button.onclick = () => ...`, are left out.
const NAMED_FUNCTIONS = [
  // function load() {   export async function start(   function* steps(
  /^[ \t]*(?:export\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/gm,
  // const field = (name) =>   export const icon = (name) =>   const inReach = async (a, b) =>
  /^[ \t]*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^()]*\)|\w+)\s*=>/gm,
  // write(state) {   async draw(ctx, x, y) {   (a method in a class or object)
  /^[ \t]*(?:async\s+)?(\w+)\([^()]*\)\s*\{[ \t]*$/gm,
  // resetCamera: () => {   drawMap: (canvas, state) =>   (an arrow function stored on an object)
  /^[ \t]*(\w+):\s*(?:async\s+)?(?:\([^()]*\)|\w+)\s*=>/gm,
  // class WorldScene extends Phaser.Scene {
  /^[ \t]*(?:export\s+)?class\s+(\w+)/gm,
];

/**
 * Lists every .js file inside a folder and its subfolders.
 *
 * @param {string} dir - A folder relative to the repo root, such as 'src'.
 * @returns {string[]} Each file's path relative to the repo root, with forward slashes.
 */
function jsFiles(dir) {
  return readdirSync(new URL(`${dir}/`, ROOT), { recursive: true })
    .map((path) => `${dir}/${String(path).replaceAll('\\', '/')}`)
    .filter((path) => path.endsWith('.js'));
}

/**
 * Finds the named functions in one file that have no comment right above them.
 *
 * A comment counts when the line just before the function ends a block comment (`*\/`) or is a
 * `//` line. A blank line in between doesn't count, so the comment stays attached to its function.
 *
 * @param {string} path - The file's path relative to the repo root.
 * @returns {string[]} One "path:line name" entry per function that is missing its comment.
 */
function uncommented(path) {
  const source = readFileSync(new URL(path, ROOT), 'utf8');
  const lines = source.split(/\r?\n/);
  const missing = [];

  for (const pattern of NAMED_FUNCTIONS) {
    for (const match of source.matchAll(pattern)) {
      // Turn the match's character offset into a 0-based line number, then look one line up.
      const line = source.slice(0, match.index).split('\n').length - 1;
      const above = (lines[line - 1] ?? '').trim();
      if (!above.endsWith('*/') && !above.startsWith('//'))
        missing.push(`${path}:${line + 1} ${match[1]}`);
    }
  }
  return missing;
}

// Guards the rule itself: a new function without its plain-language comment fails the test suite.
test('every named function has a comment directly above it', () => {
  const files = [...jsFiles('src'), ...jsFiles('tests')];
  assert.ok(files.length >= 30, `expected at least 30 JS files, found ${files.length}`);

  const missing = files.flatMap(uncommented);
  assert.deepEqual(missing, [], `Add a comment above each of these:\n${missing.join('\n')}`);
});
