import { serializeGame, CHARACTERS } from './state.js';

export const storageKey = id => `wildhaven.adventure.v1.${id}`;

// The character this tab is playing. Kept in sessionStorage so a refresh resumes play,
// while a new tab or an explicit exit goes back to the selection screen.
const activeKey = 'wildhaven.active';
export function readActive(storage) {
  try { const id=storage.getItem(activeKey);return CHARACTERS.some(c=>c.id===id)?id:null; } catch { return null; }
}
export function setActive(storage, id) {
  try { if(id)storage.setItem(activeKey,id);else storage.removeItem(activeKey); } catch {}
}

export function createSaveSession(storage, character, initialRaw) {
  let expected=initialRaw;
  return {
    write(state) {
      if(state.character!==character)return {ok:false,reason:'character'};
      try {
        const key=storageKey(character), next=serializeGame(state);
        if(storage.getItem(key)!==expected)return {ok:false,reason:'conflict'};
        storage.setItem(key,next);expected=next;
        return {ok:true};
      } catch { return {ok:false,reason:'unavailable'}; }
    }
  };
}
