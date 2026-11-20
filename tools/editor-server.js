// The world editor's back end: a Vite plugin that exists only in `npm run dev`. It lets the
// editor page read and save places.json and edits.json (in assets/world/source/) and run the map build and its tests.
// The file path and the commands are fixed here; nothing a request sends reaches either.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { shapeErrors as placesShape, writePlaces } from '../src/editor/model.js';
import { shapeErrors as editsShape, writeEdits } from '../src/editor/edits.js';

/**
 * The files the editor may read and save, by the name used in the URL. `path` is inside the
 * project folder, `shape` lists what is wrong with a request's data, `write` turns the data into
 * the file's text, and `empty` is the text used when the file does not exist yet.
 */
const FILES = {
  places: { path: 'assets/world/source/places.json', shape: placesShape, write: writePlaces },
  edits: {
    path: 'assets/world/source/edits.json',
    shape: editsShape,
    write: writeEdits,
    empty: '{\n  "removed": [],\n  "added": []\n}\n',
  },
};

/**
 * Where the fingerprint of the places the map was last built from is kept. It sits in
 * node_modules so git never sees it; file dates can't be used, because a fresh checkout resets them.
 */
const BUILT = 'node_modules/.cache/wildhaven-editor/built-hash';

/** The biggest request body accepted, in bytes. The places file is about 10 KB. */
const MAX_BODY = 1_000_000;

/** How long after a save or rebuild the page is kept from reloading itself, in milliseconds. */
const QUIET = 3000;

/** The commands a rebuild runs, in order. The second runs only if the first succeeds. */
const STEPS = [
  { label: 'python tools/build-map.py', cmd: 'python', args: ['tools/build-map.py'] },
  {
    label: 'node --test (places, sea, map, edits)',
    cmd: process.execPath,
    args: [
      '--test',
      'tests/world/places.test.js',
      'tests/world/sea.test.js',
      'tests/world/map.test.js',
      'tests/world/edits.test.js',
    ],
  },
];

/** Makes a short fingerprint of a text, so two versions of the file can be told apart. */
const hashOf = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Reads one of the editor's files from disk.
 *
 * @param {string} root - The project folder.
 * @param {string} name - 'places' or 'edits'.
 * @returns {{text: string, hash: string, crlf: boolean}} The text with plain newlines, its
 *   fingerprint, and whether the file on disk uses Windows line endings.
 */
function readFile(root, name) {
  const file = FILES[name];
  let raw;
  try {
    raw = readFileSync(join(root, file.path), 'utf8');
  } catch (error) {
    if (file.empty === undefined) throw error;
    raw = file.empty;
  }
  const text = raw.replaceAll('\r\n', '\n');
  return { text, hash: hashOf(text), crlf: raw.includes('\r\n') };
}

/** One fingerprint for everything the map is built from: the places and the edits together. */
const sourceHash = (root) => hashOf(readFile(root, 'places').hash + readFile(root, 'edits').hash);

/**
 * Says whether the places or the edits have changed since the editor last rebuilt the map.
 *
 * @param {string} root - The project folder.
 * @returns {boolean} True when the map was built from other places, so the editor's position
 *   warnings may be out of date. The first time it is asked, the checked-out map is taken to
 *   match its places, and that is recorded.
 */
function isStale(root) {
  try {
    return readFileSync(join(root, BUILT), 'utf8') !== sourceHash(root);
  } catch {
    // Nothing recorded yet: take today's places as what the map was built from.
    markBuilt(root);
    return false;
  }
}

/**
 * Notes that the map has just been built from the places and the edits as they are on disk now.
 *
 * @param {string} root - The project folder.
 */
function markBuilt(root) {
  try {
    mkdirSync(join(root, BUILT, '..'), { recursive: true });
    writeFileSync(join(root, BUILT), sourceHash(root));
  } catch {
    // Only the "out of date" note depends on this, so a failed write is not worth stopping for.
  }
}

/**
 * Sends a JSON answer.
 *
 * @param {object} res - The response to write to.
 * @param {number} status - The HTTP status code.
 * @param {object} body - What to send.
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Collects a request's body and parses it as JSON.
 *
 * @param {object} req - The incoming request.
 * @returns {Promise<*>} The parsed body. Rejects if it is too big or not JSON.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) reject(new Error('The request is too big'));
      else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('The request is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Runs one command and copies everything it prints into the response as it arrives.
 *
 * @param {string} root - The project folder, used as the working folder.
 * @param {{label: string, cmd: string, args: string[]}} step - What to run.
 * @param {object} res - The response the output is streamed to.
 * @returns {Promise<boolean>} True if the command ran and finished with exit code 0.
 */
function runStep(root, step, res) {
  return new Promise((resolve) => {
    res.write(`\n$ ${step.label}\n`);
    // The log is shown as plain text, so the commands are asked not to print colour codes.
    const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
    const child = spawn(step.cmd, step.args, { cwd: root, env });

    child.stdout.on('data', (text) => res.write(text));
    child.stderr.on('data', (text) => res.write(text));
    child.on('error', (error) => {
      res.write(`Could not start ${step.cmd}: ${error.message}\n`);
      resolve(false);
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Makes the Vite plugin that serves the editor's three endpoints.
 *
 * `apply: 'serve'` means Vite uses it for the dev server only, never for `npm run build`.
 *
 * @returns {object} A Vite plugin.
 */
export function editorServer() {
  let root = process.cwd();
  let running = false;
  let quietUntil = 0;

  /**
   * Saves the data a request sent, unless the file changed on disk since the page loaded it.
   *
   * @param {object} req - The request, whose body is `{data, hash}`.
   * @param {object} res - The response.
   * @param {string} name - 'places' or 'edits'.
   */
  async function save(req, res, name) {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      return send(res, 400, { error: error.message });
    }

    const file = FILES[name];
    const errors = file.shape(body?.data);
    if (errors.length) return send(res, 400, { error: errors.join('; ') });

    const current = readFile(root, name);
    if (current.hash !== body.hash) return send(res, 409, { error: 'conflict' });

    // Keep the line endings the file already has, so git sees only the changed lines.
    const text = file.write(body.data);
    quietUntil = Date.now() + QUIET;
    writeFileSync(join(root, file.path), current.crlf ? text.replaceAll('\n', '\r\n') : text);
    send(res, 200, { hash: hashOf(text), stale: isStale(root) });
  }

  /**
   * Runs the map build and then the world tests, streaming what they print.
   *
   * @param {object} res - The response the output is streamed to.
   */
  async function rebuild(res) {
    if (running) return send(res, 409, { error: 'busy' });
    running = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    let pass = true;
    try {
      for (const step of STEPS) {
        pass = await runStep(root, step, res);
        if (!pass) break;
        if (step === STEPS[0]) markBuilt(root);
      }
    } finally {
      running = false;
      quietUntil = Date.now() + QUIET;
    }
    res.end(`\nRESULT: ${pass ? 'pass' : 'fail'}\n`);
  }

  return {
    name: 'wildhaven-editor',
    apply: 'serve',

    // Vite calls this once the dev server exists: remember the project folder and add the routes.
    configureServer(server) {
      root = server.config.root;

      server.middlewares.use('/__editor', (req, res, next) => {
        const path = req.url.split('?')[0];
        const name = path.slice(1);

        if (Object.hasOwn(FILES, name) && req.method === 'GET') {
          const { text, hash } = readFile(root, name);
          return send(res, 200, { text, hash, stale: isStale(root) });
        }
        if (Object.hasOwn(FILES, name) && req.method === 'POST') return save(req, res, name);
        if (path === '/rebuild' && req.method === 'POST') return rebuild(res);
        next();
      });
    },

    // Vite reloads every open page when a file under assets/world changes. During the editor's own
    // save or rebuild that would wipe the undo history or cut the rebuild log short, so those
    // reloads are skipped. The editor page reloads itself once a rebuild has finished.
    handleHotUpdate({ file }) {
      const ours = file.replaceAll('\\', '/').includes('/assets/world/');
      if (ours && (running || Date.now() < quietUntil)) return [];
    },
  };
}
