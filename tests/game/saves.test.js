import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSaveSession,storageKey,readActive,setActive} from '../../src/game/saves.js';
import {createGame,serializeGame,restoreGame} from '../../src/state.js';

function memoryStorage(){const entries=new Map();return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};}

test('a stale tab cannot overwrite another tab’s newer character progress',()=>{
  const storage=memoryStorage(), initial=createGame('scout');
  const raw=serializeGame(initial);storage.setItem(storageKey('scout'),raw);
  const older=createSaveSession(storage,'scout',raw),newer=createSaveSession(storage,'scout',raw);
  const changed=createGame('scout');changed.resources.wood=12;
  assert.deepEqual(newer.write(changed),{ok:true});
  assert.deepEqual(older.write(initial),{ok:false,reason:'conflict'});
  assert.equal(restoreGame(storage.getItem(storageKey('scout'))).resources.wood,12);
});

test('one session can save repeatedly and other characters remain independent',()=>{
  const storage=memoryStorage(),scout=createGame('scout'),builder=createGame('builder');
  const a=createSaveSession(storage,'scout',null),b=createSaveSession(storage,'builder',null);
  assert.equal(a.write(scout).ok,true);scout.resources.wood=4;
  assert.equal(a.write(scout).ok,true);assert.equal(b.write(builder).ok,true);
  assert.equal(restoreGame(storage.getItem(storageKey('scout'))).resources.wood,4);
  assert.deepEqual(a.write(builder),{ok:false,reason:'character'});
});

test('unavailable storage reports failure without throwing',()=>{
  const storage={getItem(){throw new Error('blocked')},setItem(){throw new Error('full')}};
  assert.deepEqual(createSaveSession(storage,'scout',null).write(createGame('scout')),{ok:false,reason:'unavailable'});
});

test('the active character survives a refresh until the player exits',()=>{
  const storage=memoryStorage();
  assert.equal(readActive(storage),null);
  setActive(storage,'builder');assert.equal(readActive(storage),'builder');
  setActive(storage,null);assert.equal(readActive(storage),null);
  storage.setItem('wildhaven.active','wolf');assert.equal(readActive(storage),null);
});

test('active character tracking tolerates missing or blocked storage',()=>{
  const blocked={getItem(){throw new Error('blocked')},setItem(){throw new Error('full')},removeItem(){throw new Error('blocked')}};
  assert.equal(readActive(blocked),null);assert.equal(readActive(null),null);
  assert.doesNotThrow(()=>{setActive(blocked,'scout');setActive(blocked,null);setActive(null,'scout');});
});
