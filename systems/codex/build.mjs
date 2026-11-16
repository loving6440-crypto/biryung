/**
 * 秘靈 · 비령 — 도감 자료(codex-data.js) 만들기.   node systems/codex/build.mjs
 * 업적 / 도감 화면(app.js)의 [아이템] [영능력] [적] 칸이 읽는다. 무엇을 보여 줄지(얻었는지 · 만났는지 · 안목)는 화면이 플레이어 기록으로 가린다.
 *  - 아이템: 이름 · 종류 · 효과 · 해설 · 설명(쓰임새) · 짧은 획득처(영물 · 요괴 이름 없이 터만) · 도트
 *  - 영능력: 이름 · 소개 · 상세 · 의지력 · 영향받는 스탯 · 익히는 조건
 *  - 적: 단계 · 묶음 · 등장 위치 · 소개 · 수치(체력 · 공격력 · 행동력 · 영력) · 영능력(둘이면 둘 다, 효과까지) · 떨어뜨리는 아이템
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), G = join(ROOT, 'systems/vault/modules/game')
const imp = (f) => import(join(G, f))
const { PSYCHICS, specialEffects, SPECIAL_PERCENT } = await imp('battle.js')
const { yogoeList } = await imp('codex.js')
const { HUNT_SITES } = await imp('huntSites.js')
const { TIER_HANJA } = await imp('constants.js')
const R = await import(join(ROOT, 'systems/biryeong/reskin.data.js'))
// {{npc:자리|조사}} 는 실행 화면이 사람 이름으로 바꾸는 자리표시다. 도감에는 그 자리의 역할 이름으로 적는다(받침에 맞춰 조사도 고른다).
const NPC_ROLE = { storeKeeper: '매점 담당', armorySmith: '무구보관소 담당', seedKeeper: '텃밭 씨앗 상점 담당', outskirtsGuide: '뒷산 캠핑장 안내인', shrineKeeper: '사당 문지기', kitchenKeeper: '조리실 담당', infirmaryKeeper: '양호실 담당' }
const JOSA = [['이', '가'], ['을', '를'], ['은', '는'], ['과', '와'], ['으로', '로']] // [받침 있을 때, 없을 때]
const npcText = (t) => t.replace(/\{\{npc:(\w+)\|?([^}]*)\}\}/g, (_, slot, josa) => {
  const name = NPC_ROLE[slot] || '어느 선생'
  const last = name.charCodeAt(name.length - 1), batchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0
  const pair = JOSA.find((p) => p.includes(josa))
  return name + (pair ? pair[batchim ? 0 : 1] : josa)
})
const swap = (t) => npcText(R.TEXT_SWAPS.reduce((s, [a, b]) => s.split(a).join(b), String(t ?? '')))

// ── 아이템: 표(엑셀) 자료와 같은 것을 쓴다 ──
const sheet = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'systems/sheets/export.mjs')], { encoding: 'utf8', maxBuffer: 64 << 20 }))
const items = sheet.items.map((i) => ({ id: i.id, name: i.name, kind: i.kind, effect: npcText(String(i.effect ?? '')), desc: npcText(String(i.lore ?? '')), use: npcText(String(i.use ?? '')), from: i.sourceSimple, px: R.ITEM_PIXELS[i.id] ?? null }))
const nameOf = Object.fromEntries(items.map((i) => [i.id, i.name]))

// ── 영능력 ──
const AFFECTS = {
  buff: ['안목', '호전'], survival: ['인내', '절제'], 'monkey-paw': ['체력', '호전', '안목', '인내', '절제'], 'dokkaebi-fire': ['호전', '안목'],
  'echo-form': ['인내', '절제', '호전', '체력'], 'karmic-recompense': ['공격 대상'], 'falling-light': ['방어 태세'], 'cotton-mist': ['상대 행동'],
}
const mpText = (s) => (s.id === 'monkey-paw' ? '깎는 체력만큼' : s.id === 'echo-form' ? '50 − 인내 − 절제 + 호전 (20~99)' : Number.isFinite(s.mp) ? String(s.mp) : '행동에 따라 변동')
const psychics = PSYCHICS.map((p) => ({ id: p.id, name: p.label, note: swap(p.note), detail: swap(p.detail || ''), cond: swap(p.cond || ''), mp: mpText(p), affects: (AFFECTS[p.id] || []).join(' · ') || '직접 참조 없음', always: !!p.default }))

// ── 적 ──
const drops = {}
for (const s of Object.values(HUNT_SITES)) {
  const e = s.ghost?.enemy
  if (e) for (const rw of s.ghost.rewardItems ?? []) (drops[e.id] ??= new Set()).add(rw.item)
}
const special = (sp, e, two) => ({ name: sp.label, note: swap(sp.note || ''), rate: `발동 확률 ${SPECIAL_PERCENT}% (상대 턴마다 d10 = 10${two ? ', 두 가지 중 하나' : ''})` })
const enemies = yogoeList().map(({ enemy: e, group, where }) => ({
  id: e.id, name: e.name, tier: e.tier, tierLabel: `${TIER_HANJA[e.tier - 1] ?? e.tier}단계`, group: group.replace(/ \(.*\)$/, ''), where, boss: !!e.boss, party: e.partySize || 1,
  blurb: swap(e.blurb ?? ''), hp: e.hp, atk: e.atk, act: e.act, spirit: e.spirit,
  specials: [{ key: e.id, ...special(e.special, e, !!e.special2) }, ...(e.special2 ? [{ key: `${e.id}-2`, ...special(e.special2, e, true) }] : [])],
  effects: specialEffects(e).map(swap), gimmicks: (e.gimmicks ?? []).map((g) => swap(typeof g === 'string' ? g : g.text ?? g.label ?? '')).filter(Boolean),
  drops: [...(drops[e.id] ?? [])].map((id) => nameOf[id] ?? id),
}))
// 본편 이야기 전투의 상대(만나면 'story-열쇠' 로 기록된다). 수치는 장면마다 달라서 적지 않는다.
const w = { BIRYEONG_TITLES: [] }
new Function('window', readFileSync(join(ROOT, 'story-data.js'), 'utf8'))(w)
const SBsrc = readFileSync(join(ROOT, 'systems/play/src/storyBoss.js'), 'utf8')
const SBobj = SBsrc.slice(SBsrc.indexOf('export const STORY_FOES = {') + 'export const STORY_FOES = '.length)
const SB = { STORY_FOES: new Function(`return ${SBobj.slice(0, SBobj.indexOf('\n}\n') + 2)}`)() } // 화면 부품(JSX)이 섞인 파일이라 자료 부분만 읽는다
for (const [key, foe] of Object.entries(w.BIRYEONG_QUESTS.foes ?? {})) {
  const cfg = SB.STORY_FOES[key] ?? {}
  enemies.push({
    id: `story-${key}`, name: foe.name, tier: foe.tier ?? 0, tierLabel: '본편', group: '본편 이야기 전투', where: '본편 이야기 전투', boss: true, party: 1,
    blurb: foe.blurb ?? '', story: true, specials: (cfg.rules ?? []).map((r, k) => ({ key: `story-${key}${k ? `-${k + 1}` : ''}`, name: `수법 ${k + 1}`, note: r, rate: '' })), effects: [], gimmicks: [],
    drops: cfg.drop ? [nameOf[cfg.drop[0]] ?? cfg.drop[0]] : [],
  })
}

const out = { items, psychics, enemies, templates: R.PIXEL_TEMPLATES, palettes: R.PIXEL_PALETTES }
const js = `/* 비령 도감 자료 — systems/codex/build.mjs 가 만든다. 직접 고치지 말 것. */\nwindow.BIRYEONG_CODEX = ${JSON.stringify(out)};\n`
if (/초록동색|창록|chorok|changnok/i.test(js)) throw new Error('도감 자료에 옛 이름이 남았다')
writeFileSync(join(ROOT, 'codex-data.js'), js)
console.log(`도감 자료: 아이템 ${items.length} · 영능력 ${psychics.length} · 적 ${enemies.length} · ${(js.length / 1024).toFixed(0)}KB`)
