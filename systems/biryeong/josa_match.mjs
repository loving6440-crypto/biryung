// 비령_조사 탭(josa_rows.json) → 게임 탐사 데이터(보관고)와 이름으로 맞춰, 바꿀 글을 뽑는다.
import { readFileSync, writeFileSync } from 'node:fs'
const G = '/home/claude/src/work/biryeong/systems/vault/modules/game/'
const [{ FLOORS }, { ANNEX_FLOORS }, { HIKE_PATHS }, { SHRINE_AREAS, SIGN_UNREADABLE, SIGN_READ }, { LOCATION_INTRO }] = await Promise.all(['explore.js', 'annex.js', 'hike.js', 'shrineExplore.js', 'locationText.js'].map((f) => import(G + f)))
const rows = JSON.parse(readFileSync('/home/claude/work/josa_rows.json', 'utf8'))
const KEYS = ['floors', 'areas', 'rooms', 'spots', 'choices', 'branches']
const kids = (n) => KEYS.flatMap((k) => (Array.isArray(n?.[k]) ? n[k].map((c) => ({ k, c })) : []))
const norm = (s) => String(s ?? '').replace(/\{\{npc:[^}]*\}\}/g, '@').replace(/\(NPC\)/g, '').replace(/[\s.。]/g, '').replace(/\*/g, '')
const vaultNames = new Set()
const collect = (n) => kids(n).forEach(({ c }) => { vaultNames.add(norm(c.name)); collect(c) })
;[FLOORS, ANNEX_FLOORS, HIKE_PATHS, SHRINE_AREAS].forEach((list) => list.forEach((n) => { vaultNames.add(norm(n.name)); collect(n) }))

// ── 시트 → 나무 ──
const root = { col: 0, name: 'ROOT', texts: [], children: [] }
let stack = [root]
const push = (col, name, row) => { while (stack.length > 1 && stack[stack.length - 1].col >= col) stack.pop(); const n = { col, name, texts: [], children: [], row }; stack[stack.length - 1].children.push(n); stack.push(n); return n }
const looksName = (v) => v.length < 22 && !/[.?!…。」"”]$/.test(v)
for (const { row, cells } of rows) {
  if (cells.length === 1) {
    const [k, v] = cells[0]
    const parent = [...stack].reverse().find((n) => n.col < k)
    const isVaultName = vaultNames.has(norm(v)) || [...vaultNames].some((vn) => vn.includes('@') && norm(v).endsWith(vn.replace('@', '')))
    if (parent && parent !== root && !(looksName(v) && isVaultName)) { while (stack[stack.length - 1] !== parent) stack.pop(); parent.texts.push(v); continue }
    push(k, v, row); continue
  }
  const text = cells[cells.length - 1][1]
  const names = cells.slice(0, -1).filter(([, v]) => v !== '설명')
  let last = null
  for (const [c, v] of names) last = push(c, v, row)
  last.texts.push(text)
}

// ── 맞추기 ──
const MANUAL = { '비령산학당(??%)': 'changnok', '비령무당의일지': 'fog', '[비령의서문,12쪽]': 'fogPreface' }
const out = [], miss = [], intro = {}
function find(vnode, sname) {
  const want = norm(sname)
  const q = [...kids(vnode).map((x) => ({ ...x, path: [x.c.id] }))]
  while (q.length) {
    const x = q.shift()
    const vn = norm(x.c.name)
    const hit = MANUAL[want] ? x.c.id === MANUAL[want] : vn === want || (vn.includes('@') && want.endsWith(vn.replace('@', '')))
      || (/천을걷어본다/.test(want) && x.c.id === (/이하/.test(want) ? 'liftTimid' : 'liftBold'))
    if (hit) return x
    q.push(...kids(x.c).map((y) => ({ ...y, path: [...x.path, y.c.id] })))
  }
  return null
}
const strings = (t) => (Array.isArray(t) ? t : [t]).filter((x) => typeof x === 'string')
function apply(zone, base, vnode, snode, prefix) {
  for (const s of snode.children) {
    const x = find(vnode, s.name) || (vnode !== base ? (() => { const y = find(base, s.name); return y ? { ...y, path: y.path, abs: true } : null })() : null)
    if (!x) { miss.push(`${zone}: 「${s.name}」 (줄 ${s.row}) — 게임에 같은 이름이 없다`); continue }
    const path = x.abs ? [...x.path] : [...prefix, ...x.path]
    if (x.c.text === undefined && x.c.intro === undefined && !(norm(x.c.name).includes('@') || MANUAL[norm(s.name)])) { apply(zone, base, x.c, s, path); continue } // 글이 아니라 기능(위젯 · 놀이)인 칸
    const field = x.c.intro !== undefined && x.c.text === undefined ? 'intro' : Array.isArray(x.c.seq) && !strings(x.c.text).length ? 'seq' : 'text'
    const cur = strings(x.c[field])
    const same = cur.length === s.texts.length && cur.every((t, i) => norm(t) === norm(s.texts[i]))
    const rename = !MANUAL[norm(s.name)] && !(norm(x.c.name).includes('@')) && !/천을걷어본다/.test(norm(s.name)) ? null : s.name
    const nameChange = MANUAL[norm(s.name)] || norm(x.c.name).includes('@') ? s.name : null
    if (s.texts.length && !same) out.push({ zone, path, field, texts: s.texts, ...(nameChange ? { name: nameChange } : {}) })
    else if (nameChange && norm(nameChange) !== norm(x.c.name)) out.push({ zone, path, field, ...(nameChange ? { name: nameChange } : {}) })
    apply(zone, base, x.c, s, path)
  }
}
const Z = { '본관탐사': ['main', { floors: FLOORS }, 'mainHall'], '별관탐사': ['annex', { floors: ANNEX_FLOORS }, 'annex'], '산탐색': ['hike', { floors: HIKE_PATHS }, 'gym'], '사당': ['shrine', { areas: SHRINE_AREAS }, 'shrine'] }
for (const z of root.children) {
  const m = Z[norm(z.name)]; if (!m) { miss.push(`구역 「${z.name}」 은 이번에 다루지 않는다(줄 ${z.row})`); continue }
  const [zone, vroot, introKey] = m
  if (z.texts.length) intro[introKey] = z.texts.join('\n\n')
  // 사당 표지판은 상수
  if (zone === 'shrine') {
    const sign = z.children.find((c) => c.name === '표지판')
    if (sign) { z.children = [...z.children.filter((c) => c !== sign), ...sign.children.filter((c) => !/^안목/.test(c.name))]; for (const c of sign.children.filter((c) => /^안목/.test(c.name))) intro[/이하/.test(c.name) ? 'signUnreadable' : 'signRead'] = c.texts.join('\n') }
  }
  apply(zone, vroot, vroot, z, [])
}
const curIntro = { mainHall: LOCATION_INTRO.mainHall, annex: LOCATION_INTRO.annex, gym: LOCATION_INTRO.gym, shrine: LOCATION_INTRO.shrine, signUnreadable: SIGN_UNREADABLE, signRead: SIGN_READ }
const introDiff = Object.fromEntries(Object.entries(intro).filter(([k, v]) => norm(strings(curIntro[k]).join('')) !== norm(v)))
// 시트에 설명이 없는 칸(일지)과, 서문에 합쳐진 옛 4장 칸
out.push({ zone: 'annex', path: ['f3', 'archive', 'fog'], field: 'text', name: '비령 무당의 일지', texts: ['비령 무당이 남긴 일지. 첫 장에 「비령의 서문」이라고 적혀 있다.'] })
out.push({ zone: 'annex', path: ['f3', 'archive', 'fog', 'fogPreface', 'fogCh4'], remove: true })
const seen = new Set(); for (let i = out.length - 1; i >= 0; i--) { const k = out[i].path.join('>'); if (seen.has(k)) out.splice(i, 1); else seen.add(k) }
writeFileSync('/home/claude/work/josa_overrides.json', JSON.stringify({ edits: out, intro: introDiff }, null, 1))
console.log('바꿀 곳', out.length, '· 소개글', Object.keys(introDiff))
console.log(miss.join('\n'))
console.log(Object.keys(LOCATION_INTRO))
