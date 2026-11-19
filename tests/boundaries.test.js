import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// These modules must keep running under plain Node: the unit tests import them directly.
const SRC=new URL('../src/',import.meta.url);
const PURE=[...['data','world','actions','game'].flatMap(dir=>readdirSync(new URL(`${dir}/`,SRC)).filter(f=>f.endsWith('.js')).map(f=>`${dir}/${f}`)),'animation/clips.js'];
const FORBIDDEN=[
  [/from\s+['"][^'"]+\.(png|webp|jpe?g|css)['"]/,'an image or CSS import'],
  [/import\.meta/,'import.meta'],
  [/\bdocument\b/,'document'],
  [/\bwindow\b/,'window'],
  [/from\s+['"][^'"]*\/(ui|core|render)\//,'a browser-layer import'],
  [/from\s+['"][^'"]*(sheets|preview)\.js['"]/,'a browser animation import'],
];

test('pure modules avoid browser-only imports and globals',()=>{
  assert.ok(PURE.length>=12,`expected at least 12 pure modules, found ${PURE.length}`);
  for(const file of PURE){
    const source=readFileSync(new URL(file,SRC),'utf8');
    for(const [pattern,label] of FORBIDDEN)assert.doesNotMatch(source,pattern,`${file} uses ${label}`);
  }
});
test('pure modules import cleanly in Node',async()=>{
  for(const file of PURE)await import(new URL(file,SRC));
});
