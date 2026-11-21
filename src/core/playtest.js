// A playtest log for the Pinefall journal prototype. It writes one line to the browser console
// for each find and each time the journal is opened, stamped with game time, so whoever runs a
// playtest can read afterwards what happened and when instead of relying on memory.
// Type `wildhavenPlaytest()` in the console to get the whole log as text to copy.

// Every line written so far this page load.
const lines = [];

// The trail clues the player has read, by the place each one points to → game time first shown.
const cluesRead = new Map();

window.wildhavenPlaytest = () => lines.join('\n');

/**
 * Writes one line to the log, stamped with the game clock as minutes and seconds.
 *
 * The game clock stops while paused or while a dialog is open, so times are play time.
 *
 * @param {object} session - The shared session; its game state's `elapsed` gives the time.
 * @param {string} message - What happened.
 */
function write(session, message) {
  const seconds = Math.floor(session.state?.elapsed ?? 0);
  const stamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const line = `[playtest ${stamp}] ${message}`;
  lines.push(line);
  console.info(line);
}

/**
 * Logs the start of a play session: which character, and whether it is a new adventure.
 *
 * @param {object} session - The shared session.
 * @param {boolean} fresh - True for a new adventure, false for a loaded save.
 */
export function logStart(session, fresh) {
  write(session, `start ${session.state.character} (${fresh ? 'new adventure' : 'loaded save'})`);
}

/**
 * Logs things the player just found, and notes when a find is the place a trail clue they read
 * pointed to. That second line is the number the prototype is testing: do players follow clues?
 *
 * @param {object} session - The shared session.
 * @param {{kind: string, id: string, name: string}[]} finds - What `discover` returned.
 */
export function logFinds(session, finds) {
  for (const find of finds) {
    write(session, `found ${find.kind}: ${find.name}`);
    if (cluesRead.has(find.id)) {
      const after = Math.round((session.state.elapsed ?? 0) - cluesRead.get(find.id));
      write(session, `followed the trail clue to ${find.name}, ${after} s after first reading it`);
      cluesRead.delete(find.id);
    }
  }
}

/**
 * Logs that the journal was opened, how full it is, and the clue it showed.
 *
 * @param {object} session - The shared session.
 * @param {object|null} journal - What `readJournal` returned, or null when no region has a journal.
 */
export function logJournalOpen(session, journal) {
  // No journal content on this map (Spring Country): log the bare open and nothing about a trail.
  if (!journal) {
    write(session, 'opened journal: no pages on this map');
    return;
  }

  const clue = journal.trail ? `, trail points to ${journal.trail.name}` : ', every page filled';
  write(session, `opened journal: ${journal.found}/${journal.total} ${journal.regionName}${clue}`);
  if (journal.trail && !cluesRead.has(journal.trail.id))
    cluesRead.set(journal.trail.id, session.state.elapsed ?? 0);
}
