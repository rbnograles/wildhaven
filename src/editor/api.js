// The world editor's calls to the dev server (see tools/editor-server.js): read the places file,
// save it, and run a rebuild while passing on what the build prints.

/**
 * Reads the places file from disk.
 *
 * @returns {Promise<{text: string, hash: string, stale: boolean}>} The file's text, a fingerprint
 *   to send back when saving, and whether the map is older than the file.
 */
export async function loadPlaces() {
  const res = await fetch('/__editor/places');
  if (!res.ok) throw new Error(`Could not read the places file (${res.status})`);
  return res.json();
}

/**
 * Saves the places.
 *
 * @param {object} places - The places to write.
 * @param {string} hash - The fingerprint of the file as this page loaded or last saved it.
 * @returns {Promise<object>} `{ok: true, hash, stale}` when saved, or `{ok: false, conflict: true}`
 *   when the file changed on disk in the meantime. Any other failure throws with the reason.
 */
export async function savePlaces(places, hash) {
  const res = await fetch('/__editor/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ places, hash }),
  });

  if (res.status === 409) return { ok: false, conflict: true };
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
  return { ok: true, ...body };
}

/**
 * Runs the map build and the world tests, handing over their output as it is printed.
 *
 * @param {(text: string) => void} onText - Called with each new piece of output.
 * @returns {Promise<boolean>} True if the build and the tests both passed.
 */
export async function rebuild(onText) {
  const res = await fetch('/__editor/rebuild', { method: 'POST' });
  if (res.status === 409) {
    onText('A rebuild is already running.\n');
    return false;
  }
  if (!res.ok || !res.body) {
    onText(`The rebuild could not start (${res.status}).\n`);
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let all = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    all += text;
    onText(text);
  }
  return all.trimEnd().endsWith('RESULT: pass');
}
