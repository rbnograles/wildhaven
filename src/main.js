// The starting point of the game in the browser.
// It builds the page, creates the shared session, connects the UI pieces to each other,
// and starts the frame loop. It holds no game rules of its own; it only wires things together.

import './style.css';
import { mountLayout } from './ui/layout.js';
import { createHud } from './ui/hud.js';
import { setupDialogs } from './ui/dialogs.js';
import { setupJournal } from './ui/journal.js';
import { setupSelection } from './ui/selection.js';
import { createSession, start, tabStorage } from './core/session.js';
import { setupInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { readActive, setActive } from './game/saves.js';
import { setupPreview } from './animation/preview.js';

// Build every screen and dialog, then the shared session that all modules read and change.
mountLayout(document.querySelector('#app'));
const session = createSession();

// Modules reach each other through this object instead of importing one another.
// Think of it as a phone book: each module looks the others up here instead of calling them directly.
const ui = {};
ui.hud = createHud(session);
ui.dialogs = setupDialogs(session, ui);
ui.journal = setupJournal(session, ui);
ui.selection = setupSelection(session, ui);
ui.input = setupInput(session, ui);

// The animation preview shows whoever is being played, or else whoever is picked on the selection screen.
setupPreview(() => session.state?.character ?? session.selected);

// A refresh mid-game resumes that character; only leaving via the menu buttons clears it.
const resumeId = readActive(tabStorage);
ui.selection.select(resumeId ?? session.selected);
if (resumeId && ui.selection.readSlot(resumeId).value) start(session, ui);
else setActive(tabStorage, null);

startLoop(session, ui);
