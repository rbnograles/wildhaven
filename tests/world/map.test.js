import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, isWalkable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';

test('every character spawn is walkable ground',()=>{
  for(const c of CHARACTERS)assert.ok(isWalkable(c.spawn.x,c.spawn.y),c.id);
});
test('points past the world margin or not finite are never walkable',()=>{
  for(const [x,y] of [[WORLD.margin-1,500],[500,WORLD.margin-1],[WORLD.width-WORLD.margin+1,500],[500,WORLD.height-WORLD.margin+1],[NaN,500],[500,Infinity]])
    assert.equal(isWalkable(x,y),false,`${x},${y}`);
});
