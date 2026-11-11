#!/usr/bin/env node
/**
 * 秘靈 · 비령 — 초록동색 C.01 콘텐츠 보관고 꺼내기 도구.
 *
 *   npm run vault -- bundles                         꺼내기 묶음 목록
 *   npm run vault -- list [종류|묶음]                 파일 목록 (종류: game-logic, ui-component, asset-image …)
 *   npm run vault -- info <id>                       한 파일의 정보(원래 경로 · 의존 · 표시)
 *   npm run vault -- search <낱말>                    id · 경로 · 카탈로그 값에서 찾기
 *   npm run vault -- json <id> [내보내는이름]          게임 데이터(JSON) 보기 — 예: json game/items ITEMS
 *   npm run vault -- export <id|묶음 …> --to <폴더> [--npc 자리=이름 …] [--layout vault|app]
 *        · 고른 것과 그것이 import 하는 파일 · 그림 · 소리를 모두 함께 꺼낸다.
 *        · --npc 를 주면 꺼낸 글 속 {{npc:자리|조사}} 를 그 이름으로 채운다(조사는 받침에 맞춰).
 *        · --layout app 은 초록동색과 같은 src/game · src/components · public 배치로 꺼낸다(기본은 vault 배치).
 *   npm run vault -- verify                          보관고 파일이 manifest 와 같은지(sha256) 확인
 *
 * 네트워크 접속은 하지 않는다. 보관고 안의 파일은 바꾸지 않고, 꺼낼 때는 복사본만 만든다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const VAULT = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(join(VAULT, 'manifest.json'), 'utf8'))
const byId = Object.fromEntries(manifest.entries.map((e) => [e.id, e]))
const posix = (p) => p.split(sep).join('/')

// ── NPC 글 채우기 (npcSlots.js 와 같은 규칙) ──
const JOSA = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'], 아: ['아', '야'], 야: ['아', '야'], 이랑: ['이랑', '랑'], 랑: ['이랑', '랑'] }
const batchim = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0) - 0xac00; return c < 0 || c > 11171 ? -1 : c % 28 }
const josa = (w, j) => { const p = JOSA[j]; if (!p) return `${w}${j ?? ''}`; const b = batchim(w); if (p[0] === '으로') return `${w}${b > 0 && b !== 8 ? '으로' : '로'}`; return `${w}${b > 0 ? p[0] : p[1]}` }
const fillNpc = (text, names) => text.replace(/\{\{npc:(\w+)(?:\|([가-힣]+))?\}\}/g, (m, id, j) => (names[id] ? (j ? josa(names[id], j) : names[id]) : m))

/** 고른 id · 묶음 → 딸려 나갈 모든 id */
function resolveSelection(names) {
  const roots = []
  for (const n of names) {
    if (manifest.bundles[n]) roots.push(...(n === 'all' ? manifest.entries.map((e) => e.id) : manifest.bundles[n].roots))
    else if (byId[n]) roots.push(n)
    else throw new Error(`없는 id 또는 묶음: ${n}  (npm run vault -- bundles / list 로 확인)`)
  }
  const seen = new Set()
  const stack = [...roots]
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...byId[id].deps)
  }
  return [...seen].sort()
}

/** vault 경로 → app 배치(초록동색과 같은 src/ · public/) 경로 */
function appPathOf(e) {
  const p = e.path
  if (p.startsWith('modules/game/')) return 'src/game/' + p.slice(13)
  if (p.startsWith('modules/ui/components/')) return 'src/components/' + p.slice(22)
  if (p.startsWith('modules/ui/hooks/')) return 'src/hooks/' + p.slice(17)
  if (p.startsWith('modules/ui/adapters/')) return 'src/adapters/' + p.slice(20)
  if (p === 'modules/ui/index.css') return 'src/index.css'
  if (p.startsWith('assets/public/')) return 'public/' + p.slice(14)
  if (p.startsWith('assets/images/')) return 'src/assets/' + p.slice(14)
  if (p.startsWith('tools/')) return 'scripts/' + p.slice(6)
  return p
}
/** app 배치에서는 폴더 깊이가 달라지므로 상대 import 를 다시 맞춘다. */
function relinkForApp(text, fromEntry, outPathOf) {
  const fromOut = outPathOf(fromEntry)
  return text.replace(/((?:import|export)[^'"]*?from\s*['"]|import\(\s*['"])(\.[^'"]+)(['"])/g, (m, a, spec, b) => {
    const target = posix(relative(VAULT, resolve(VAULT, dirname(fromEntry.path), spec)))
    const hit = manifest.entries.find((x) => x.path === target || x.path === target + '.js' || x.path === target + '.jsx' || x.path === target + '.mjs')
    if (!hit) return m
    const keepExt = /\.(m?js|jsx|png|webp|svg|css)$/.test(spec)
    let rel = posix(relative(dirname(fromOut), outPathOf(hit)))
    if (!keepExt) rel = rel.replace(/\.(m?js|jsx)$/, '')
    if (!rel.startsWith('.')) rel = './' + rel
    return a + rel + b
  })
}

function cmdExport(argv) {
  const to = argv.includes('--to') ? resolve(argv[argv.indexOf('--to') + 1]) : null
  if (!to) throw new Error('--to <폴더> 가 필요하다')
  const layout = argv.includes('--layout') ? argv[argv.indexOf('--layout') + 1] : 'vault'
  if (!['vault', 'app'].includes(layout)) throw new Error('--layout 은 vault 또는 app')
  const names = {}
  argv.forEach((a, i) => {
    if (a !== '--npc') return
    const [slot, ...rest] = String(argv[i + 1] ?? '').split('=')
    if (!manifest.npcSlots.includes(slot) || !rest.length) throw new Error(`--npc 자리=이름 (자리: ${manifest.npcSlots.join(', ')})`)
    names[slot] = rest.join('=')
  })
  const skip = new Set(['--to', '--layout', '--npc'])
  const picks = argv.filter((a, i) => !a.startsWith('--') && !skip.has(argv[i - 1]))
  if (!picks.length) throw new Error('꺼낼 id 또는 묶음을 적는다')
  if (existsSync(to) && readdirSync(to).length) throw new Error(`${to} 가 비어 있지 않다 — 빈 폴더를 고른다`)
  const ids = resolveSelection(picks)
  const outPathOf = (e) => (layout === 'app' ? appPathOf(e) : e.path)
  const written = []
  for (const id of ids) {
    const e = byId[id]
    let buf = readFileSync(join(VAULT, e.path))
    if (/\.(m?js|jsx|css|json|csv|md)$/.test(e.path)) {
      let t = buf.toString('utf8')
      if (layout === 'app' && /\.(m?js|jsx)$/.test(e.path)) t = relinkForApp(t, e, outPathOf)
      if (Object.keys(names).length) {
        t = fillNpc(t, names)
        // 자리 자체에도 이름을 넣어 둔다 — 그래야 화면에서 그 NPC 의 대화창 · 선택지가 열린다.
        if (e.id === 'game/npcSlots') t += '\n// ── 꺼낼 때 넣은 이름 (npm run vault -- export --npc) ──\n' + Object.entries(names).map(([k, v]) => `fillNpcSlot(${JSON.stringify(k)}, { name: ${JSON.stringify(v)} })`).join('\n') + '\n'
      }
      buf = Buffer.from(t, 'utf8')
    }
    const out = join(to, outPathOf(e))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, buf)
    written.push({ id, path: posix(relative(to, out)), from: e.path, origin: e.origin })
  }
  const packages = [...new Set(ids.flatMap((id) => byId[id].packages))].sort()
  const report = {
    exportedFrom: '秘靈 · 비령 systems/vault (초록동색 C.01 콘텐츠)',
    picks, layout, npcNames: names, files: written.length,
    needsPackages: packages,
    needsServerAdapter: ids.some((id) => byId[id].flags.needsServerAdapter),
    npcSlotsUsed: ids.some((id) => byId[id].flags.usesNpcSlots),
    unfilledNpcTokens: written.filter((w) => /\{\{npc:/.test(readFileSync(join(to, w.path), 'utf8').slice(0, 2_000_000))).length,
    entries: written,
  }
  writeFileSync(join(to, 'VAULT_EXPORT.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${written.length}개 파일을 ${to} 로 꺼냈다 (배치: ${layout}).`)
  if (packages.length) console.log(`필요한 패키지: ${packages.join(', ')}`)
  if (report.needsServerAdapter) console.log('서버 기능 화면이 섞여 있다: adapters/online.js 를 비령 서버 API 로 바꿔야 실제로 동작한다.')
  if (report.npcSlotsUsed && !Object.keys(names).length) console.log('NPC 자리를 쓰는 파일이 있다: --npc 자리=이름 으로 채우거나, 꺼낸 npcSlots.js 를 채운다.')
}

function cmdVerify() {
  let bad = 0
  for (const e of manifest.entries) {
    const p = join(VAULT, e.path)
    if (!existsSync(p)) { bad++; console.log('없음', e.path); continue }
    const h = createHash('sha256').update(readFileSync(p)).digest('hex')
    if (h !== e.sha256) { bad++; console.log('다름', e.path) }
  }
  for (const c of manifest.catalog) {
    const h = createHash('sha256').update(readFileSync(join(VAULT, c.file))).digest('hex')
    if (h !== c.sha256) { bad++; console.log('다름', c.file) }
  }
  console.log(bad ? `문제 ${bad}건 — 파일을 고쳤다면 npm run vault:build 로 manifest 를 다시 만든다.` : `이상 없음 (${manifest.entries.length}개 파일 · 카탈로그 ${manifest.catalog.length}개)`)
  if (bad) process.exitCode = 1
}

const [cmd, ...rest] = process.argv.slice(2)
try {
  if (!cmd || cmd === 'help') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''))
  } else if (cmd === 'bundles') {
    for (const [k, b] of Object.entries(manifest.bundles)) console.log(`${k.padEnd(18)} ${String(b.files).padStart(3)}개  ${b.title}${b.needsServerAdapter ? '  [서버 어댑터 필요]' : ''}`)
  } else if (cmd === 'list') {
    const f = rest[0]
    const list = !f ? manifest.entries : manifest.bundles[f] ? resolveSelection([f]).map((id) => byId[id]) : manifest.entries.filter((e) => e.kind === f)
    for (const e of list) console.log(`${e.id.padEnd(42)} ${e.kind.padEnd(13)} ${e.flags.changeKind ?? ''}`)
    console.log(`(${list.length}개)`)
  } else if (cmd === 'info') {
    const e = byId[rest[0]]
    if (!e) throw new Error(`없는 id: ${rest[0]}`)
    console.log(JSON.stringify(e, null, 2))
  } else if (cmd === 'json') {
    const e = byId[rest[0]]
    if (!e?.catalog) throw new Error(`${rest[0]}: 데이터 카탈로그가 없다 (game-logic 중 데이터를 내보내는 모듈만 있다)`)
    const data = JSON.parse(readFileSync(join(VAULT, e.catalog), 'utf8')).exports
    console.log(JSON.stringify(rest[1] ? data[rest[1]] : Object.keys(data), null, 2))
  } else if (cmd === 'search') {
    const q = rest.join(' ')
    if (!q) throw new Error('찾을 낱말을 적는다')
    for (const e of manifest.entries) if (e.id.includes(q) || e.path.includes(q)) console.log('파일', e.id)
    for (const c of manifest.catalog) {
      const t = readFileSync(join(VAULT, c.file), 'utf8')
      const n = t.split(q).length - 1
      if (n) console.log(`데이터 ${c.id} — ${n}곳`)
    }
  } else if (cmd === 'export') cmdExport(rest)
  else if (cmd === 'verify') cmdVerify()
  else throw new Error(`모르는 명령: ${cmd}`)
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
}
