// Reads the field journal against a game in progress: which pages are filled in, and which clue
// to show next. Pages come from the places already found (`state.landmarks`), so the journal
// needs nothing new in the save.

import { JOURNALS } from '../data/journal.js';
import { LANDMARKS, REGION_LIST } from '../data/places.js';

/**
 * Tells whether finding this place adds a journal page.
 *
 * @param {string} landmarkId - A landmark id, such as 'p-hollow'.
 * @returns {boolean} True if some region's journal has a page for it.
 */
export const hasJournalPage = (landmarkId) =>
  Object.values(JOURNALS).some((journal) => landmarkId in journal.pages);

/**
 * Gathers one region's journal as the player sees it right now.
 *
 * Like flipping through a notebook: pages for places already found are filled in, the rest are
 * blank. The trail clue is the hint for the first place on the trail not found yet, so the
 * notebook always points somewhere new until every page is filled.
 *
 * @param {object} state - The game being played. Only `landmarks` (found place ids) is read.
 * @param {string} regionId - Which region's journal to read, such as 'pinefall'.
 * @returns {object|null} `{ regionName, intro, pages, found, total, trail }`, or null if the region
 *   has no journal. Each page is `{ id, name, text, keepsake, sprite, found }`. `trail` is
 *   `{ id, name, hint }` for the next place to look for, or null once every page is found.
 */
export function readJournal(state, regionId) {
  const journal = JOURNALS[regionId];
  if (!journal) return null;

  // Pages follow the trail's order, so the notebook reads in the order the clues lead.
  const nameOf = (id) => LANDMARKS.find((l) => l.id === id).name;
  const pages = journal.trail.map((id) => ({
    id,
    name: nameOf(id),
    ...journal.pages[id],
    found: state.landmarks.includes(id),
  }));

  const next = pages.find((page) => !page.found);
  return {
    regionName: REGION_LIST.find((r) => r.id === regionId).name,
    intro: journal.intro,
    pages,
    found: pages.filter((page) => page.found).length,
    total: pages.length,
    trail: next ? { id: next.id, name: next.name, hint: next.hint } : null,
  };
}
