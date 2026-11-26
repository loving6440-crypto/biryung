import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = readFileSync(join(ROOT, 'adapt.js'), 'utf8')

function mount(saved = {}) {
  let persists = 0
  const app = {
    save: { adapt: saved },
    h: () => ({}), btn: () => ({}), para: () => ({}), toast: () => {},
    persist: () => { persists += 1 }, profile: () => null,
  }
  const win = { BiryeongApp: app, addEventListener: () => {} }
  const ctx = { window: win, document: { addEventListener: () => {} },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    clearInterval: () => {}, location: { hash: '#/' }, console }
  vm.runInNewContext(script, ctx, { filename: 'adapt.js' })
  return { adapter: win.BiryeongAdapt, app, persistCount: () => persists }
}

test('D.06.10: 시트 64~79행은 1-4 기본 활동 16단계, 80~84행은 1-5 동아리 5단계', () => {
  const { adapter } = mount()
  assert.equal(adapter.quests.length, 5)
  assert.equal(adapter.quests[3].title, '1-4. 기본 활동')
  assert.equal(adapter.quests[3].steps.length, 16)
  assert.equal(adapter.quests[4].title, '1-5. 동아리')
  assert.equal(adapter.quests[4].steps.length, 5)
  assert.match(adapter.quests[3].steps[0].x, /학생의 기본 본분인 수업 듣기/)
  assert.match(adapter.quests[3].steps[7].x, /매 주 한 단계씩 추가/)
  assert.match(adapter.quests[3].steps[14].x, /무구 관리를 할 수 있는 곳/)
  assert.match(adapter.quests[4].steps[2].x, /방송부에 속해/)
  assert.equal(adapter.quests[3].reward.money, 50)
  assert.equal(adapter.quests[4].reward.money, 20)
  assert.ok(adapter.quests[3].steps[1].w.route.endsWith('/mainHall/class'))
  assert.ok(adapter.quests[3].steps[5].w.route.endsWith('/gym/battle'))
  assert.ok(adapter.quests[3].steps[10].w.route.endsWith('/dorm/my-room'))
  assert.ok(adapter.quests[3].steps[12].w.route.endsWith('/infirmary/rest'))
  assert.equal(adapter.quests[3].steps[14].w.see, '.play-scope [data-armory]')
})

test('D.06.10: 기존 동아리 완료는 a5로 이동하고 새로운 a4는 미완료, 보상은 중복 지급되지 않음', () => {
  const { adapter, persistCount } = mount({ done: { a1: 1, a2: 2, a3: 3, a4: 44, a5: 55 }, paid: { a4: 444, a5: 555 }, gave: {} })
  const s = adapter.state()
  assert.equal(s.questSchema, 2)
  assert.equal(s.done.a4, undefined)
  assert.equal(s.done.a5, 44)
  assert.equal(s.paid.a4, 555)
  assert.equal(s.paid.a5, 444)
  assert.equal(persistCount(), 1)
  adapter.state() // 재진입 시 다시 뒤집지 않음
  assert.equal(s.paid.a5, 444)
  assert.equal(persistCount(), 1)
  assert.equal(adapter.progressText(), '4 / 5')
})

test('D.06.10: 예전 a4 동아리를 진행 중이던 플레이어는 a5 진행을 이어감', () => {
  const { adapter } = mount({ done: { a1: 1, a2: 2, a3: 3 }, paid: {}, gave: {}, cur: { id: 'a4', step: 3 } })
  const s = adapter.state()
  assert.equal(s.cur.id, 'a5')
  assert.equal(s.cur.step, 3)
  assert.equal(s.done.a5, undefined)
})

test('D.06.10: 이전 a5 학당 안내는 새 a5 동아리로 오인하지 않고 진행 기록 정리', () => {
  const { adapter } = mount({ done: { a1: 1, a2: 2, a3: 3, a4: 4 }, paid: { a4: 4 }, cur: { id: 'a5', step: 4 } })
  const s = adapter.state()
  assert.equal(s.cur, undefined)
  assert.equal(s.done.a5, 4)
  assert.equal(s.done.a4, undefined)
})

test('D.06.10: 새 계정 상태 초기화 및 적응 퀘스트 번들 캐시 버전', () => {
  const { adapter } = mount()
  assert.equal(adapter.state().questSchema, 2)
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  assert.ok(html.includes('adapt.js?v=D.06.10'))
})
