/**
 * 秘靈 · 비령 — 초록동색 C.01 콘텐츠 보관고(vault) 빌더.
 *
 *   node systems/vault/build.mjs                 manifest.json · catalog/*.json 다시 만들기
 *   node systems/vault/build.mjs --c01 <폴더>     C.01 원본 폴더(압축 푼 것)와 비교해 '바뀐 파일' 표시도 다시 계산
 *
 * 하는 일
 *  1. modules/ · assets/ · docs/ · tools/ 의 모든 파일을 manifest.json 에 적는다(id, 종류, 원래 경로, sha256, 의존 파일, 필요한 패키지, 표시).
 *  2. Node 에서 바로 불러올 수 있는 게임 모듈(modules/game)은 내보내는 값 중 '데이터'를 catalog/game/*.json 으로 떠 둔다.
 *     (함수는 JSON 에 담을 수 없으므로 이름만 manifest 에 적는다. 계산이 필요하면 모듈 자체를 import 한다.)
 *  3. bundles(꺼내기 묶음)마다 실제로 딸려 나가는 파일 수를 계산해 둔다.
 * 네트워크 접속이나 다른 프로젝트 import 는 하지 않는다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve, extname, sep } from 'node:path'
import { BUNDLES } from './bundles.mjs'

const VAULT = dirname(fileURLToPath(import.meta.url))
const ROOTS = ['modules', 'assets', 'docs', 'tools']
const args = process.argv.slice(2)
const c01Dir = args.includes('--c01') ? resolve(args[args.indexOf('--c01') + 1]) : null

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const posix = (p) => p.split(sep).join('/')
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

/** 보관고 안 경로 → 꺼낼 때 쓰는 id */
function idOf(rel) {
  const r = posix(rel)
  if (r.startsWith('modules/game/')) return 'game/' + r.slice(13).replace(/\.(m?js|jsx)$/, '')
  if (r.startsWith('modules/ui/components/')) return 'ui/' + r.slice(22).replace(/\.(m?js|jsx)$/, '')
  if (r.startsWith('modules/ui/')) return 'ui/' + r.slice(11).replace(/\.(m?js|jsx)$/, '')
  if (r.startsWith('assets/public/')) return 'asset/' + r.slice(14)
  if (r.startsWith('assets/images/')) return 'asset/images/' + r.slice(14)
  if (r.startsWith('docs/')) return 'doc/' + r.slice(5)
  if (r.startsWith('tools/')) return 'tool/' + r.slice(6).replace(/\.m?js$/, '')
  return r
}
/** 보관고 안 경로 → C.01 원래 경로 (새로 만든 파일은 null) */
const NEW_FILES = new Set(['modules/game/npcSlots.js', 'modules/game/activityCounters.js', 'modules/ui/adapters/online.js'])
function originOf(rel) {
  const r = posix(rel)
  if (NEW_FILES.has(r)) return null
  if (r.startsWith('modules/game/')) return 'src/game/' + r.slice(13)
  if (r.startsWith('modules/ui/components/')) return 'src/components/' + r.slice(22)
  if (r.startsWith('modules/ui/hooks/')) return 'src/hooks/' + r.slice(17)
  if (r === 'modules/ui/index.css') return 'src/index.css'
  if (r.startsWith('assets/public/')) return 'public/' + r.slice(14)
  if (r.startsWith('assets/images/')) return 'src/assets/' + r.slice(14)
  if (r.startsWith('docs/sheets/')) return r.slice(12)
  if (r.startsWith('docs/reports/')) return 'reports/' + r.slice(13)
  if (r.startsWith('tools/')) return 'scripts/' + r.slice(6)
  return null
}
const REPLACES = { 'modules/game/activityCounters.js': 'src/game/clubQuests.js (퀘스트 목록 · 보상은 빼고 활동 카운터만)', 'modules/ui/adapters/online.js': 'src/net/online.js (네트워크 없는 연결 안 됨 어댑터)' }

function kindOf(rel) {
  const r = posix(rel)
  if (r.startsWith('modules/game/')) return 'game-logic'
  if (r.startsWith('modules/ui/adapters/')) return 'adapter'
  if (r.startsWith('modules/ui/hooks/')) return 'ui-hook'
  if (r.endsWith('.css')) return 'style'
  if (r.startsWith('modules/ui/')) return /\/icons|statIcons/.test(r) ? 'ui-icons' : 'ui-component'
  if (r.startsWith('assets/')) return /\.(mp3|ogg|wav)$/.test(r) ? 'asset-audio' : /\.js$/.test(r) ? 'asset-script' : 'asset-image'
  if (r.startsWith('docs/')) return 'doc'
  if (r.startsWith('tools/')) return 'tool'
  return 'other'
}

const files = ROOTS.flatMap((r) => (existsSync(join(VAULT, r)) ? walk(join(VAULT, r)) : [])).map((p) => posix(relative(VAULT, p))).sort()
const fileSet = new Set(files)
const publicAssets = files.filter((f) => f.startsWith('assets/public/')).map((f) => f.slice(14))

function resolveRel(fromRel, spec) {
  const base = posix(relative(VAULT, resolve(VAULT, dirname(fromRel), spec)))
  for (const c of [base, base + '.js', base + '.jsx', base + '.mjs']) if (fileSet.has(c)) return c
  return null
}

const prev = existsSync(join(VAULT, 'manifest.json')) ? JSON.parse(readFileSync(join(VAULT, 'manifest.json'), 'utf8')) : null
const prevById = Object.fromEntries((prev?.entries ?? []).map((e) => [e.id, e]))

const entries = []
for (const rel of files) {
  const buf = readFileSync(join(VAULT, rel))
  const isCode = /\.(m?js|jsx|css)$/.test(rel)
  const text = isCode ? buf.toString('utf8') : ''
  const deps = new Set()
  const packages = new Set()
  if (isCode) {
    for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm)) {
      const spec = m[1] || m[2] || m[3]
      if (spec.startsWith('.')) {
        const r = resolveRel(rel, spec)
        if (!r) throw new Error(`${rel}: 찾을 수 없는 import ${spec}`)
        deps.add(r)
      } else if (!spec.startsWith('node:')) packages.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0])
    }
    // 화면에서 쓰는 /public 파일(그림 · 소리)
    for (const a of publicAssets) if (text.includes(`'/${a}'`) || text.includes(`"/${a}"`) || text.includes(`(/${a})`) || text.includes(`url("/${a}")`) || text.includes(`url('/${a}')`)) deps.add('assets/public/' + a)
  }
  const origin = originOf(rel)
  let c01Sha = prevById[idOf(rel)]?.c01Sha256 ?? null
  if (c01Dir && origin) c01Sha = existsSync(join(c01Dir, origin)) ? sha(readFileSync(join(c01Dir, origin))) : null
  const shaNow = sha(buf)
  // 바뀐 정도: 'same' | 'import-paths'(import 경로만 비령 폴더 구조에 맞게 바뀜) | 'content'(내용이 바뀜 — NPC · 퀘스트 빼기 등) | 'new'
  let changeKind = prevById[idOf(rel)]?.changeKind ?? null
  if (!origin) changeKind = 'new'
  else if (c01Dir && existsSync(join(c01Dir, origin))) {
    const before = readFileSync(join(c01Dir, origin))
    if (sha(before) === shaNow) changeKind = 'same'
    else if (isCode) {
      const norm = (t) => t.replace(/(from\s*['"])[^'"]+(['"])/g, '$1$2').replace(/(import\(\s*['"])[^'"]+(['"])/g, '$1$2')
      changeKind = norm(before.toString('utf8')) === norm(text) ? 'import-paths' : 'content'
    } else changeKind = 'content'
  }
  const flags = {
    usesNpcSlots: isCode && /npcSlots/.test(text),
    hasNpcTokens: isCode && /\{\{npc:\w+/.test(text),
    needsReact: packages.has('react') || /\.jsx$/.test(rel),
    needsServerAdapter: [...deps].some((d) => d === 'modules/ui/adapters/online.js'),
    changedFromC01: origin ? (c01Sha ? c01Sha !== shaNow : null) : true,
  }
  flags.changeKind = changeKind
  entries.push({
    id: idOf(rel),
    kind: kindOf(rel),
    path: rel,
    origin: origin ?? null,
    replaces: REPLACES[rel] ?? undefined,
    bytes: buf.length,
    sha256: shaNow,
    c01Sha256: c01Sha,
    deps: [...deps].map(idOf).sort(),
    packages: [...packages].sort(),
    flags,
  })
}
const byPath = Object.fromEntries(entries.map((e) => [e.path, e]))
const byId = Object.fromEntries(entries.map((e) => [e.id, e]))

// ── 2. 게임 데이터 카탈로그 ──
const CATALOG = join(VAULT, 'catalog')
rmSync(CATALOG, { recursive: true, force: true })
mkdirSync(join(CATALOG, 'game', 'minigames'), { recursive: true })
let dataExports = 0
const catalogFiles = []
const strip = (v, seen = new WeakSet()) => {
  if (typeof v === 'function') return undefined
  if (v && typeof v === 'object') {
    if (seen.has(v)) return '[circular]'
    seen.add(v)
    if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [k, strip(x, seen)]))
    if (v instanceof Set) return [...v].map((x) => strip(x, seen))
    if (Array.isArray(v)) return v.map((x) => strip(x, seen) ?? null)
    const o = {}
    for (const [k, x] of Object.entries(v)) { const s = strip(x, seen); if (s !== undefined) o[k] = s }
    seen.delete(v)
    return o
  }
  return v
}
const hasFn = (v, seen = new WeakSet()) => {
  if (typeof v === 'function') return true
  if (!v || typeof v !== 'object' || seen.has(v)) return false
  seen.add(v)
  return Object.values(v).some((x) => hasFn(x, seen))
}
for (const e of entries.filter((x) => x.kind === 'game-logic')) {
  if (e.packages.length) { e.nodeImportable = false; continue } // react · lucide 가 필요한 모듈은 화면 쪽에서만 쓴다
  const mod = await import(pathToFileURL(join(VAULT, e.path)).href)
  e.nodeImportable = true
  e.exports = Object.keys(mod).sort()
  e.functions = e.exports.filter((k) => typeof mod[k] === 'function')
  const data = {}
  const partial = []
  for (const k of e.exports) {
    if (typeof mod[k] === 'function') continue
    data[k] = strip(mod[k])
    if (hasFn(mod[k])) partial.push(k)
  }
  e.dataExports = Object.keys(data)
  if (partial.length) e.dataWithFunctionsStripped = partial
  if (!e.dataExports.length) continue
  dataExports += e.dataExports.length
  const out = join(CATALOG, e.path.slice('modules/'.length).replace(/\.js$/, '.json'))
  const txt = JSON.stringify({ id: e.id, source: e.path, exports: data }, null, 2) + '\n'
  writeFileSync(out, txt)
  e.catalog = posix(relative(VAULT, out))
  catalogFiles.push({ id: e.id, file: e.catalog, bytes: Buffer.byteLength(txt), sha256: sha(txt) })
}

// ── 3. 꺼내기 묶음 ──
function closure(ids, entryById = byId) {
  const seen = new Set()
  const stack = [...ids]
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    const e = entryById[id]
    if (!e) throw new Error(`없는 id: ${id}`)
    seen.add(id)
    stack.push(...e.deps)
  }
  return [...seen].sort()
}
const bundles = {}
for (const [name, b] of Object.entries(BUNDLES)) {
  const roots = name === 'all' ? entries.map((e) => e.id) : b.roots
  for (const r of roots) if (!byId[r]) throw new Error(`묶음 ${name}: 없는 id ${r}`)
  const all = closure(roots)
  bundles[name] = { title: b.title, roots: name === 'all' ? ['(전부)'] : roots, files: all.length, needsServerAdapter: all.some((id) => byId[id].flags.needsServerAdapter), packages: [...new Set(all.flatMap((id) => byId[id].packages))].sort() }
}

const counts = entries.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] ?? 0) + 1 }), {})
const manifest = {
  project: '秘靈 · 비령',
  vault: 'chorokdongsaek-C01-content',
  source: 'chorokdongsaek-vC.01.zip',
  sourcePackageVersion: '80.0.18',
  mode: 'STORED_NOT_WIRED',
  excluded: {
    npc: '초록동색 NPC 7명(이름 · 초상화 · 대사 · 선물 반응 · 도감 설명)과 NPC 가 주인공인 이동 글. 그 자리는 modules/game/npcSlots.js 의 빈 자리 7칸으로 남겼다.',
    quests: 'quests.js · questData.js · questLevels.js · clubQuests.js(퀘스트 부분) · firstDayQuest.js 와 퀘스트 화면(QuestBoard · QuestParts · ExtraQuestModal · FirstDayQuestModal · ClubModal), 의뢰 메뉴.',
    oldAppAndServer: '초록동색 서버(server/*), 로그인(game/auth.js · AuthScreen · ForcePasswordReset · ProfileSwitchModal · AdminPanel), 앱 뼈대(App.jsx · Game.jsx · main.jsx), 배포 설정. 비령은 자체 서버 · 계정을 쓴다.',
    other: 'NPC 초상화 이미지 15개, 패치 노트 문서, 폰트 파일(원래 zip 에도 없음).',
  },
  npcSlots: ['outskirtsGuide', 'storeKeeper', 'seedKeeper', 'armorySmith', 'shrineKeeper', 'kitchenKeeper', 'infirmaryKeeper'],
  counts: { files: entries.length, ...counts, catalogFiles: catalogFiles.length, dataExports },
  bundles,
  catalog: catalogFiles,
  entries,
}
writeFileSync(join(VAULT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(manifest.counts, null, 2))
console.log(`bundles: ${Object.keys(bundles).length}`)
