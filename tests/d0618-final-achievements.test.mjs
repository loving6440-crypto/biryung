import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const txt = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const w = {}
const ctx = { window:w }
for (const f of ['titles.js','titles2.js','titles-final.js']) vm.runInNewContext(txt(f),ctx,{filename:f})
const finals = w.BIRYEONG_ACHIEVEMENTS.filter((a)=>a.group==='final')
test('최종 업적은 16종이며 단독 10단계와 50종 종합 업적이 모두 있다', () => {
  assert.equal(finals.length,16)
  for(let tier=1;tier<=10;tier++){
    const a=finals.find(x=>x.id===`final-extra-${tier}`)
    assert.ok(a)
    assert.equal(w.BIRYEONG_FINAL_ENEMIES[tier].length,5)
  }
  assert.equal(Object.values(w.BIRYEONG_FINAL_ENEMIES).flat().length,50)
  assert.ok(finals.find(x=>x.id==='final-extra-all'))
})
test('모든 최종 칭호는 기능을 갖지 않는다',()=>{
  for(const a of finals){const t=w.BIRYEONG_TITLES.find(x=>x.id===a.title);assert.ok(t); assert.equal(t.perk,undefined);assert.equal(t.perkText,'기능은 없다. 이것은 자신을 증명할 수단일 뿐이다.')}
})
test('육조 한 갈래/합계 업적 목표는 40/240이다',()=>{
  const byId=Object.fromEntries(w.BIRYEONG_ACHIEVEMENTS.map(a=>[a.id,a]));
  assert.equal(byId['p-stat60'].when.n,40)
  assert.equal(byId['p-statsum'].when.n,240)
})
test('공지사항이 첫 화면 기본 탭이며 기존 스토리는 클릭할 수 있다',()=>{
  const html=txt('index.html');assert.match(html,/data-lore-tab="notice" aria-selected="true"/);assert.match(html,/data-lore-tab="story" aria-selected="false"/);
  assert.match(html,/<div class="lore-pane" id="loreStory" role="tabpanel" hidden>/)
})
test('후반 개척 수치 변환 기준을 40으로 낮추고 추가전투 데이터 자체는 보존한다',()=>{
  const source=txt('systems/play/src/huntLevels.js')
  assert.match(source,/\[60, 40\], \[100, 40\]/)
  assert.match(txt('play/play.js'), /\[60,40\],\[100,40\]/)
  const n = w.BIRYEONG_FINAL_ENEMIES
  assert.equal(n[10].length,5)
})
