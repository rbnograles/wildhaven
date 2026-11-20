// The field journal dialog: one page per named place in a region, with the keepsake found there
// and a clue to the next place on the trail. Pages are read from the places already found, so
// this file only shows them. A second tab lists what every key and button does. It also keeps
// the "new page" dot on the HUD's journal button.
import { JOURNALS } from '../data/journal.js';
import { CONTROLS } from '../data/controls.js';
import { readJournal } from '../world/journal.js';
import { regionOf } from '../world/regions.js';
import { objectUrls } from '../render/renderer.js';
import { logJournalOpen } from '../core/playtest.js';
import { $ } from './layout.js';

/**
 * Wires up the journal dialog, its HUD button and the "new page" dot.
 *
 * @param {object} session - The shared session (screen, held keys, game state).
 * @param {object} ui - The other UI parts; the dialogs are asked whether the game is paused.
 * @returns {{toggleJournal: Function, refreshDot: Function}} Opens or closes the journal, and
 *   updates the dot that says a page was added since the journal was last opened.
 */
export function setupJournal(session, ui) {
  // How many pages there were when the journal was last opened, like a bookmark, kept per game.
  // Keyed by the game state object, which is new each time a game starts or loads, so a fresh
  // adventure (or a refresh) starts without a bookmark and the dot shows until the journal is read.
  const seen = new WeakMap();

  /**
   * Picks which region's journal to show: the one the player stands in if it has a journal,
   * otherwise the first journal there is (only Pinefall Woods has one in this prototype).
   *
   * @returns {string} A region id with a journal.
   */
  function journalRegion() {
    const here = regionOf(session.state.player.x, session.state.player.y).id;
    return JOURNALS[here] ? here : Object.keys(JOURNALS)[0];
  }

  /** Counts every journal page this character has filled in, across all regions. */
  const pagesFound = () =>
    Object.keys(JOURNALS).reduce((sum, id) => sum + readJournal(session.state, id).found, 0);

  /**
   * Builds one page of the journal: the keepsake's picture, the place's name and its words, or a
   * blank page if the place hasn't been found yet.
   *
   * @param {object} page - A page from `readJournal`: `{ name, text, keepsake, sprite, found }`.
   * @returns {HTMLLIElement} The finished page, ready to add to the list.
   */
  function pageElement(page) {
    const item = document.createElement('li');
    item.className = `journal-page${page.found ? '' : ' blank'}`;

    const frame = document.createElement('span');
    frame.className = 'keepsake-frame';
    if (page.found) {
      const picture = document.createElement('img');
      picture.src = objectUrls[page.sprite];
      picture.alt = '';
      frame.append(picture);
    } else frame.textContent = '?';

    const words = document.createElement('div');
    const title = document.createElement('h3');
    const text = document.createElement('p');
    title.textContent = page.found ? page.name : 'An empty page';
    text.textContent = page.found ? page.text : 'Not found yet. Follow the trail to fill it in.';
    words.append(title, text);
    if (page.found) {
      const keepsake = document.createElement('p');
      keepsake.className = 'keepsake-name';
      keepsake.textContent = `Keepsake: ${page.keepsake}`;
      words.append(keepsake);
    }

    item.append(frame, words);
    return item;
  }

  /**
   * Fills the dialog with the chosen region's pages and its trail clue.
   *
   * @param {object} journal - What `readJournal` returned for that region.
   */
  function render(journal) {
    $('journal-title').textContent = journal.regionName;
    $('journal-intro').textContent = journal.intro;
    $('journal-count').textContent = `${journal.found} of ${journal.total} pages filled`;
    $('journal-trail-text').textContent = journal.trail
      ? journal.trail.hint
      : `Every page of ${journal.regionName} is filled. Well walked.`;
    $('journal-trail').classList.toggle('complete', !journal.trail);
    $('journal-pages').replaceChildren(...journal.pages.map(pageElement));
  }

  /**
   * Builds one group of the controls list: a title, an optional line of small print, and a row
   * per key with what it does.
   *
   * @param {object} group - A group from `CONTROLS`: `{ title, note, rows }`.
   * @returns {HTMLElement} The finished group, ready to add to the Controls tab.
   */
  function controlGroup(group) {
    const section = document.createElement('section');
    section.className = 'control-group';

    const title = document.createElement('h3');
    title.textContent = group.title;
    section.append(title);

    if (group.note) {
      const note = document.createElement('p');
      note.className = 'control-note';
      note.textContent = group.note;
      section.append(note);
    }

    const list = document.createElement('dl');
    for (const row of group.rows) {
      const keys = document.createElement('dt');
      const does = document.createElement('dd');
      for (const name of row.keys) {
        const cap = document.createElement('kbd');
        cap.textContent = name;
        keys.append(cap);
      }
      does.textContent = row.does;
      list.append(keys, does);
    }
    section.append(list);

    return section;
  }

  /**
   * Shows one of the journal's two tabs and hides the other.
   *
   * @param {'places' | 'controls'} tab - Which tab to show.
   */
  function showTab(tab) {
    for (const name of ['places', 'controls']) {
      $(`journal-${name}`).hidden = name !== tab;
      $(`journal-tab-${name}`).setAttribute('aria-selected', String(name === tab));
    }
  }

  /**
   * Shows or hides the dot on the journal button. It shows while this character has pages they
   * haven't opened the journal to read yet.
   */
  function refreshDot() {
    if (!session.state) return;
    $('journal-dot').hidden = pagesFound() <= (seen.get(session.state) ?? 0);
  }

  /**
   * Opens the journal, or closes it if it is already open.
   *
   * Like the map, it won't open on top of another dialog, and it pauses the game while open.
   * Opening it counts as reading every page so far, so the dot goes away.
   */
  function toggleJournal() {
    if (session.screen !== 'game') return;
    if ($('journal-dialog').open) {
      $('journal-dialog').close();
      return;
    }
    if (ui.dialogs.isPaused()) return;

    session.keys.clear();
    const journal = readJournal(session.state, journalRegion());
    render(journal);
    showTab('places');
    $('journal-dialog').showModal();
    seen.set(session.state, pagesFound());
    refreshDot();
    logJournalOpen(session, journal);
  }

  // The controls never change while the game runs, so their list is built once.
  $('journal-controls').replaceChildren(...CONTROLS.map(controlGroup));
  $('journal-tab-places').addEventListener('click', () => showTab('places'));
  $('journal-tab-controls').addEventListener('click', () => showTab('controls'));

  $('open-journal').addEventListener('click', toggleJournal);
  $('close-journal').addEventListener('click', toggleJournal);

  return { toggleJournal, refreshDot };
}
