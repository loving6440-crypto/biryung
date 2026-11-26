import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = readFileSync(join(ROOT, 'app.js'), 'utf8')
const codexData = readFileSync(join(ROOT, 'codex-data.js'), 'utf8')
const context = { window: {} }
runInNewContext(codexData, context)
const psychics = context.window.BIRYEONG_CODEX.psychics

// Exercise the actual codex UI renderer without requiring a browser or bundler.
function renderPsychics(player) {
  const start = app.indexOf('  function renderDexPsychics(body) {')
  const end = app.indexOf('  function renderDexEnemies(body) {', start)
  assert.ok(start >= 0 && end > start, '영능력 도감 화면 함수 필요')
  const js = app.slice(start, end)
  const node = (tag, cls = '', value = '') => ({ tag, cls, value, dataset: {}, children: [], append(...children) { this.children.push(...children) } })
  const dexLine = (label, content, cls='') => { const p=node('p',`dex-line ${cls}`);p.append(node('b','',label),node('span','',content));return p }
  const code = `${js}\nrenderDexPsychics(body);`
  const body = node('div')
  runInNewContext(code, { body, CODEX: { psychics }, dexPlayer: () => player, dexAll: () => false, h: node, dexLine })
  return body
}
function walk(node) {
  const result = [node]
  for (const child of node.children ?? []) if (child && typeof child === 'object') result.push(...walk(child))
  return result
}
function skill(body,id) { return walk(body).find(x => x.dataset?.dexPsychic === id) }
function contents(card) { return walk(card).filter(x=> typeof x.value === 'string').map(x=>x.value) }

test('모든 영능력 도감 자료에는 얻는 방법이 있다 (일반·탈취 포함)', () => {
  assert.equal(psychics.length, 82)
  for (const x of psychics) assert.ok(typeof x.cond === 'string' && x.cond.trim(), `얻는 방법 누락: ${x.id}`)
})
test('미습득 영능력은 얻는 방법만 공개되고 상세와 의지력은 숨긴다', () => {
  const body = renderPsychics({ psychics: [] })
  for (const x of psychics.filter(x=> !x.always)) {
    const card = skill(body,x.id)
    assert.ok(card, `도감 항목 누락: ${x.id}`)
    assert.equal(card.dataset.known, '0')
    const fields = walk(card).filter(y=>y.cls?.startsWith('dex-line'))
    assert.deepEqual(fields.map(field=>field.children[0].value), ['얻는 방법'], `미습득 보안 공개 범위: ${x.id}`)
    assert.equal(fields[0].children[1].value, x.cond, `실제 습득 방법 일치: ${x.id}`)
  }
})
test('습득 영능력은 능력 설명과 얻는 방법을 함께 공개한다', () => {
  const target = psychics.find(x=>x.stolen)
  const own = psychics.find(x=> !x.stolen && !x.always)
  const body = renderPsychics({ psychics: [target.id, own.id] })
  for (const x of [target,own]) {
    const card = skill(body,x.id)
    assert.equal(card.dataset.known, '1')
    const fields = walk(card).filter(y=>y.cls?.startsWith('dex-line'))
    assert.deepEqual(fields.map(field=>field.children[0].value), ['의지력 소모','상세 설명','영향받는 스탯','얻는 방법'])
    assert.equal(fields.at(-1).children[1].value,x.cond)
  }
})
test('기본으로 주어지는 영능력도 얻는 방법을 유지한다', () => {
  const x=psychics.find(x=>x.always)
  assert.ok(x)
  const card=skill(renderPsychics({psychics:[]}),x.id)
  assert.equal(card.dataset.known,'1')
  assert.equal(walk(card).find(y=>y.cls?.startsWith('dex-line is-from'))?.children[1].value,x.cond)
})
