import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { enhCostFor as vaultCost } from '../systems/vault/modules/game/items.js';
import { enhCostFor as coreCost } from '../systems/rules/items.js';

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const loadPartyLog = () => {
  const ctx = createContext({ window: {}, Intl, Date, Number, String });
  runInContext(source('party-log.js'), ctx);
  return ctx.window.BiryeongPartyLog;
};

test('D.06.8: 대화 로그는 300건 초과 기록도 빠짐없이 오름차순 수집', async () => {
  const archive = Array.from({ length: 607 }, (_, i) => ({ id: i + 100, name: `사람${i % 2}`, u: 'abc', body: `메시지 ${i}`, at: '2026-11-26T09:00:00Z' }));
  const calls = [];
  const call = async (name, args) => {
    assert.equal(name, 'bry_room_msgs');
    assert.equal(args.p_room, 12);
    calls.push(args.p_after);
    return { room: { id: 12, status: 'ended' }, msgs: archive.filter(x => x.id > args.p_after).slice(0, 300) };
  };
  const log = loadPartyLog();
  const result = await log.collect(12, call);
  assert.equal(result.messages.length, 607);
  assert.equal(result.messages.at(0).id, 100);
  assert.equal(result.messages.at(-1).id, 706);
  assert.equal(calls.length, 3);
  assert.equal(calls[0], 0);
  assert.equal(calls[1], 399);
  assert.equal(calls[2], 699);
});

test('D.06.8: HTML 내보내기에는 XSS 입력을 문자로 이스케이프하고 대화방 메타데이터 포함', () => {
  const { html } = loadPartyLog();
  const output = html({ id: 72, kind: 'battle', everyone: [{ name: '<script>파티장</script>', u: 'admin' }], created_at: '2026-11-26T06:00:00Z', ended_at: '2026-11-26T07:00:00Z' }, [
    { id: 1, u: 'bad', name: '<img onerror=alert(1)>', body: '<script>evil()</script>\n두번째 줄 & 확인', at: '2026-11-26T06:01:00Z' },
    { id: 2, body: '[일행 종료]' },
  ]);
  assert.match(output, /^<!doctype html>/);
  assert.match(output, /<meta charset="utf-8">/);
  assert.match(output, /대화 기록 #72/);
  assert.match(output, /전투 일행/);
  assert.match(output, /&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.match(output, /&lt;img onerror=alert\(1\)&gt;/);
  assert.match(output, /두번째 줄 &amp; 확인/);
  assert.doesNotMatch(output, /<script>evil\(\)<\/script>/);
});

test('D.06.8: 무구 1~15강의 재료 순서 및 화면 엔진 비용 일치', () => {
  const order = ['whetstone', 'oil-cloth', 'five-knot', 'silver-inlay', 'cinnabar-charm'];
  const expectedQ = [1,2,3,1,2,3,1,2,3,2,3,4,1,2,3];
  let totalPolishing = 0, totalSpirit = 0;
  for (let i = 0; i < 15; i++) {
    const a = vaultCost(i), b = coreCost(i);
    assert.deepEqual(a, b);
    assert.equal(a.material, order[Math.floor(i / 3)]);
    assert.equal(a.quantity, expectedQ[i]);
    assert.equal(a.polishing, i + 1);
    assert.equal(a.spirit, (Math.floor(i / 3) + 1) * 10);
    totalPolishing += a.polishing; totalSpirit += a.spirit;
  }
  assert.equal(totalPolishing, 120);
  assert.equal(totalSpirit, 450);
  assert.equal(vaultCost(15), null);
  const built = source('play/play.js');
  assert.match(built, /material:\["whetstone","oil-cloth","five-knot","silver-inlay","cinnabar-charm"\]\[a\]/);
  assert.match(built, /quantity:t%3\+1\+\(a===3\?1:0\)/);
});

test('D.06.8: 한국 시각 06/18시 BGM 전환, 전투 BGM 우선, 배경곡 재생 위치 보존', async () => {
  let now = '2026-11-26T08:59:00Z'; // KST 17:59
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  }
  const tracks = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; tracks.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const body = { classList: { contains: () => false } };
  const document = { body, documentElement: { dataset: {} }, getElementById: () => null, addEventListener: () => {}, hidden: false };
  const window = { BiryeongApp: { profile: () => ({ username: 'test' }) }, addEventListener: () => {}, removeEventListener: () => {} };
  const localStorage = { getItem: () => null, setItem: () => {} };
  class MutationObserver { observe() {} }
  const ctx = createContext({ window, document, Audio: FakeAudio, Date: Clock, Intl, Number, MutationObserver, localStorage, setInterval: () => {}, setTimeout: () => {} });
  runInContext(source('bgm.js'), ctx);
  window.BiryeongBgm.sync();
  assert.equal(window.BiryeongBgm.state().playing, 'commu');
  const day = tracks[0]; day.currentTime = 25;
  now = '2026-11-26T09:00:00Z'; // KST 18:00
  window.BiryeongBgm.sync();
  assert.equal(window.BiryeongBgm.state().playing, 'night');
  assert.equal(day.paused, true);
  const night = tracks[1]; night.currentTime = 41;
  window.BiryeongBgm.battle('battle');
  assert.equal(window.BiryeongBgm.state().playing, 'battle');
  assert.equal(tracks[2].src, 'assets/bgm/battle.mp3');
  window.BiryeongBgm.battle('boss');
  assert.equal(tracks[3].src, 'assets/bgm/boss.mp3');
  window.BiryeongBgm.battle(null);
  assert.equal(window.BiryeongBgm.state().playing, 'night');
  assert.equal(night.currentTime, 41);
  now = '2026-11-26T21:00:00Z'; // KST next day 06:00
  window.BiryeongBgm.sync();
  assert.equal(window.BiryeongBgm.state().playing, 'commu');
  assert.equal(day.currentTime, 25);
});
