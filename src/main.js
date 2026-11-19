import './style.css';
import { mountLayout } from './ui/layout.js';
import { createHud } from './ui/hud.js';
import { setupDialogs } from './ui/dialogs.js';
import { setupSelection } from './ui/selection.js';
import { createSession, start, tabStorage } from './core/session.js';
import { setupInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { readActive, setActive } from './game/saves.js';
import { setupPreview } from './animation/preview.js';

mountLayout(document.querySelector('#app'));
const session=createSession();
// Modules reach each other through this object instead of importing one another.
const ui={};
ui.hud=createHud(session);
ui.dialogs=setupDialogs(session,ui);
ui.selection=setupSelection(session,ui);
ui.input=setupInput(session,ui);
setupPreview(()=>session.state?.character??session.selected);
// A refresh mid-game resumes that character; only leaving via the menu buttons clears it.
const resumeId=readActive(tabStorage);ui.selection.select(resumeId??session.selected);
if(resumeId&&ui.selection.readSlot(resumeId).value)start(session,ui);else setActive(tabStorage,null);
startLoop(session,ui);
