import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as Game from '../systems/core.mjs';
const root = new URL('../',import.meta.url);
const at = path => new URL(path,root);
const data = name => JSON.parse(readFileSync(at(`systems/data/${name}.json`),'utf8'));

test('No bundled server or frontend app of another project',()=>{
  assert.ok(!existsSync(at('systems/chorokdongsaek-C01/')));
  assert.ok(!existsSync(at('src/')));
  assert.ok(!existsSync(at('server/accounts.js')));
  assert.ok(existsSync(at('server/index.mjs')));
});

test('Gameplay rules refer exclusively to copied local modules',()=>{
  const dir=at('systems/rules/');
  const names=readdirSync(dir).filter(name=>name.endsWith('.js'));
  assert.equal(names.length,29);
  for(const name of names){
    const text=readFileSync(new URL(name,dir),'utf8');
    const matches=[...text.matchAll(/\bfrom\s*["']([^"']+)["']/g)];
    for(const match of matches){
      assert.ok(match[1].startsWith('./'),`nonlocal module in ${name}: ${match[1]}`);
      assert.ok(existsSync(new URL(match[1],new URL(name,dir))),`missing local module ${match[1]}`);
    }
    assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\bprocess\.env\b|\b(?:createClient|supabase)\s*\(/i.test(text),`remote call in ${name}`);
  }
});

test('Snapshot data count, IDs and hashes unchanged',()=>{
  const manifest=data('catalog-manifest');
  const counts={items:312,enemies:57,playerPsychics:13,enemyPsychicDefinitions:69,pioneerSites:23};
  for(const [k,v] of Object.entries(counts)) assert.equal(manifest.counts[k],v);
  for(const [f,key] of [['items','items'],['enemies','enemies'],['psychics','playerPsychics'],['enemy-psychics','enemyPsychicDefinitions']]){
    const arr=data(f);
    assert.equal(arr.length, counts[key]);
    if(f!=='enemy-psychics')assert.equal(new Set(arr.map(v=>v.id)).size,arr.length);
  }
  for(const file of manifest.files){
    const bytes=readFileSync(at(`systems/data/${file.name}`));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`${file.name}: checksum mismatch`);
  }
});

test('Six stats and pure battle/pioneer engine are importable',()=>{
  assert.deepEqual(new Set(Game.STAT_KEYS),new Set(['insight','aggression','endurance','control','agility','comprehension']));
  assert.equal(Game.Data.ITEMS.length,312);
  assert.equal(Game.Data.ALL_ENEMIES.length,57);
  assert.equal(Game.Data.PSYCHICS.length,13);
  assert.equal(typeof Game.SoloBattle.newBattle,'function');
  assert.equal(typeof Game.PartyBattle.createMB,'function');
  assert.equal(typeof Game.Pioneer.enterHuntSite,'function');
  assert.equal(Game.PioneerSites.HUNT_SIZE,10);
  assert.equal(typeof Game.StatCalculator,'object');
});

test('No original server network URLs in frontend or dedicated server',()=>{
  const src=readFileSync(at('site/app.js'),'utf8')+readFileSync(at('server/index.mjs'),'utf8');
  assert.ok(!src.includes('SUPABASE_'));
  assert.ok(!/chorokdongsaek-C01\/server|\.onrender\.com|supabase\.co/.test(src));
  assert.ok(!/\bfetch\s*\(/.test(src));
});
