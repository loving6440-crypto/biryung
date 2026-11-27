import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

function harness({ now = '2026-11-26T15:15:00Z', failFirst = false } = {}) {
  const tracks = [];
  let audioAttempts = 0;
  let prompt = null;
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; this.volume = 0; tracks.push(this); }
    pause() { this.paused = true; }
    load() { this.currentTime = 0; }
    play() {
      audioAttempts++;
      if (failFirst && audioAttempts === 1) return Promise.reject({ name: 'NotAllowedError' });
      this.paused = false; return Promise.resolve();
    }
  }
  class Clock extends Date {
    constructor(...a) { super(...(a.length ? a : [now])); }
  }
  const doc = {
    body: {
      classList: { contains: () => false },
      append(el) { prompt = el; },
    },
    documentElement: { dataset: {} },
    getElementById: (id) => id === 'bgmResumePrompt' ? prompt : null,
    createElement: () => ({
      style: {}, setAttribute() {}, addEventListener(_event, fn) { this.click = fn; },
      remove() { prompt = null; },
    }),
    addEventListener() {},
    hidden: false,
  };
  const events = {};
  const win = {
    BiryeongApp: { profile: () => null },
    addEventListener(name, fn) { events[name] = fn; },
    removeEventListener(name) { delete events[name]; },
  };
  class MutationObserver { observe() {} }
  const ctx = createContext({ window: win, document: doc, Audio: FakeAudio, Date: Clock,
    Intl, Number, MutationObserver, localStorage: { getItem: () => null, setItem() {} },
    setInterval() {}, setTimeout() {} });
  runInContext(readFileSync(new URL('../bgm.js', import.meta.url), 'utf8'), ctx);
  return { win, tracks, doc, events, prompt: () => prompt, attempts: () => audioAttempts, setTime(v) { now = v; } };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('D.06.11 guest / unregistered user hears night track when story is not open', async () => {
  const h = harness();
  h.win.BiryeongBgm.sync(); await flush();
  assert.equal(h.win.BiryeongBgm.state().playing, 'night');
  assert.equal(h.tracks.length, 1);
  assert.match(h.tracks[0].src, /assets\/bgm\/night\.mp3/);
  assert.equal(h.tracks[0].paused, false);
  h.setTime('2026-11-26T20:59:00Z'); // KST 05:59
  h.win.BiryeongBgm.sync(); await flush();
  assert.equal(h.tracks.length, 1);
  h.setTime('2026-11-26T21:00:00Z'); // KST 06:00
  h.win.BiryeongBgm.sync(); await flush();
  assert.equal(h.win.BiryeongBgm.state().playing, 'commu');
  assert.match(h.tracks[0].src, /assets\/bgm\/commu\.mp3/);
  assert.equal(h.tracks[0].paused, false);
});

test('D.06.11 autoplay rejection does not trigger retry storm; provides explicit resume action', async () => {
  const h = harness({ failFirst: true });
  h.win.BiryeongBgm.sync(); await flush();
  assert.equal(h.win.BiryeongBgm.state().blocked, true);
  assert.equal(h.win.BiryeongBgm.state().error, 'NotAllowedError');
  assert.ok(h.prompt());
  for(let i=0;i<20;i++) h.win.BiryeongBgm.sync();
  assert.equal(h.attempts(),1,'background sync should not retry blocked audio repeatedly');
  h.prompt().click(); await flush();
  assert.equal(h.win.BiryeongBgm.state().blocked, false);
  assert.equal(h.tracks[0].paused, false);
  assert.equal(h.prompt(), null);
});

test('D.06.11 switching ambient to combat keeps original battle/boss paths and return to current ambient', async () => {
  const h = harness();
  h.win.BiryeongBgm.sync(); await flush();
  const ambient=h.tracks[0]; ambient.currentTime=15;
  h.win.BiryeongBgm.battle('battle'); await flush();
  assert.equal(h.tracks[1].src,'assets/bgm/battle.mp3');
  assert.equal(ambient.paused,true);
  h.win.BiryeongBgm.battle('boss'); await flush();
  assert.equal(h.tracks[2].src,'assets/bgm/boss.mp3');
  h.win.BiryeongBgm.battle(null); await flush();
  assert.equal(h.win.BiryeongBgm.state().playing,'night');
  assert.equal(ambient.currentTime,15);
});
