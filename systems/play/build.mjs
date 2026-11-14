/**
 * 秘靈 · 비령 — 실행 화면(play) 빌드.   npm run play:build → play/play.js · play/play.css · play/(그림 · 소리)
 *
 * 보관고(systems/vault/modules)의 초록동색 화면 코드를 묶어, 비령 메인 화면(index.html) 안에 끼워 넣는 부품으로 만든다.
 * 보관고 원본은 고치지 않고, 묶을 때 아래를 적용한다.
 *  - '@vault/…'           → systems/vault/modules/…
 *  - 'lucide-react'       → src/shims/lucide-react.jsx (패키지 없이 같은 이름의 아이콘)
 *  - ItemIcon.jsx         → src/PixelItemIcon.jsx (도트 아이콘)
 *  - 글자 바꾸기           : 영능력 · 학교 이름(systems/biryeong 의 TEXT_SWAPS), 초록동색 색상값 → 비령 색상값
 *  - '/bgm.mp3' 같은 주소  → 'play/bgm.mp3'
 *  - document.body 포털    → #playPortal (스타일 범위 안)
 *  - 보관고 조각(patches.mjs): v1.3 본편 아이템을 아이템 목록에 붙이고, 전투 화면에 보스 패턴 훅을 끼운다
 *  - 스타일               : Tailwind 로 컴파일한 뒤 전부 `.play-scope` 안쪽으로 가둔다 → 메인 화면 스타일과 섞이지 않는다.
 * 필요한 패키지: esbuild, react, react-dom, tailwindcss (npm install). node_modules 가 없으면 BIRYEONG_NODE_PATH 에서도 찾는다.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { TEXT_SWAPS } from '../biryeong/reskin.data.js'
import { applyPatches } from './patches.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const VAULT = join(ROOT, 'systems/vault/modules')
const PUBLIC = join(ROOT, 'systems/vault/assets/public')
const OUT = join(ROOT, 'play')
const SCOPE = '.play-scope'

const searchPaths = [join(ROOT, 'node_modules'), ...(process.env.BIRYEONG_NODE_PATH || '').split(':').filter(Boolean)]
function findPkg(name) {
  for (const base of searchPaths) if (existsSync(join(base, name, 'package.json'))) return join(base, name)
  throw new Error(`패키지 ${name} 을(를) 찾지 못했다. npm install 을 하거나 BIRYEONG_NODE_PATH 를 지정한다.`)
}
const esbuild = createRequire(join(findPkg('esbuild'), 'package.json'))(findPkg('esbuild'))
const tailwind = await import(pathToFileURL(join(findPkg('tailwindcss'), 'dist/lib.mjs')).href)

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p] })
const publicFiles = readdirSync(PUBLIC).filter((n) => n !== 'theme-bootstrap.js' && !/^(favicon|apple-touch|icons\.svg)/.test(n))
const assetRe = new RegExp(`(['"\`(])/(${publicFiles.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=['"\`)?#])`, 'g')
// 초록동색 색상값 → 비령 색상값 (화면 코드 · 스타일에 직접 적힌 것)
const COLOUR_SWAPS = [['#ffd426', '#d5b579'], ['#ffe14a', '#e6cf9c'], ['#b8960f', '#806e50'], ['#050b1f', '#0b1522'], ['#0a1633', '#101e2e'], ['#0f1e44', '#172a3a'], ['#030817', '#07111b'], ['#f26b5e', '#d56b69'], ['#e5483c', '#c66a6c'], ['#2aa6b8', '#68a9b9'], ['#f7ecd0', '#efe6ce'], ['#f1cf68', '#d0af73'], ['#65c9c5', '#4f948d'], ['#e9554f', '#d56b69']]
const swapColours = (t) => COLOUR_SWAPS.reduce((s, [a, b]) => s.replace(new RegExp(a, 'gi'), b), t)
const swapText = (t) => TEXT_SWAPS.reduce((s, [a, b]) => s.split(a).join(b), t)
const vaultSource = (path) => swapColours(swapText(applyPatches(path, readFileSync(path, 'utf8'))))
  .replace(assetRe, '$1play/$2')
  .replace(/document\.body(?=\s*[,)])/g, "(document.getElementById('playPortal') || document.body)")

// ── 1. 자바스크립트 ──
const vaultPlugin = {
  name: 'biryeong-vault',
  setup(b) {
    b.onResolve({ filter: /^@vault\// }, (a) => ({ path: join(VAULT, a.path.slice(7)) }))
    b.onResolve({ filter: /^@story\// }, (a) => ({ path: join(HERE, 'src', a.path.slice(7)) }))
    b.onResolve({ filter: /^@biryeong\// }, (a) => ({ path: join(ROOT, 'systems/biryeong', a.path.slice(10)) }))
    b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: join(HERE, 'src/shims/lucide-react.jsx') }))
    b.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (a) => ({ path: createRequire(join(findPkg(a.path.split('/')[0]), 'package.json')).resolve(a.path) }))
    b.onLoad({ filter: /systems[\\/]vault[\\/]modules[\\/]ui[\\/]components[\\/]ItemIcon\.jsx$/ }, () => ({ contents: readFileSync(join(HERE, 'src/PixelItemIcon.jsx'), 'utf8'), loader: 'jsx', resolveDir: join(HERE, 'src') }))
    b.onLoad({ filter: /systems[\\/]vault[\\/]modules[\\/].*\.(m?js|jsx)$/ }, (a) => ({ contents: vaultSource(a.path), loader: 'jsx', resolveDir: dirname(a.path) }))
  },
}
mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true })
const result = await esbuild.build({
  entryPoints: [join(HERE, 'src/main.jsx')],
  bundle: true, outfile: join(OUT, 'play.js'), format: 'iife', target: ['es2022'], jsx: 'automatic',
  loader: { '.js': 'jsx', '.png': 'file', '.webp': 'file', '.svg': 'file' },
  assetNames: 'media/[name]-[hash]', publicPath: 'play', minify: true, legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"', 'import.meta.env.VITE_SERVER_URL': '""' },
  plugins: [vaultPlugin], metafile: true, logLevel: 'warning',
})

// ── 2. 스타일: Tailwind 컴파일 → .play-scope 안에 가두기 ──
const sources = [...walk(VAULT), ...walk(join(HERE, 'src'))].filter((p) => /\.(m?js|jsx)$/.test(p))
const candidates = new Set()
for (const p of sources) for (const m of readFileSync(p, 'utf8').matchAll(/[^\s"'`{}<>;=]+/g)) { candidates.add(m[0]); candidates.add(m[0].replace(/^[(,]+|[),.]+$/g, '')) } // z-[70] 처럼 대괄호로 끝나는 것도 그대로 둔다
const twDir = findPkg('tailwindcss')
// 글꼴은 메인 화면의 것(갈무리9 · KoPub 돋움 · KoPub 바탕)만 쓴다. 초록동색의 글꼴 선언은 걷어 낸다.
const indexCss = swapColours(readFileSync(join(VAULT, 'ui/index.css'), 'utf8'))
  .replace(/^@import url\([^)]*\);?\s*$/gm, '')
  .replace(/@font-face\s*\{[^}]*\}/g, '')
  .replace(/^\s*(:root,\s*)?\[data-ui-font='[a-z0-9]+'\][^\n]*\{[^}]*\}\s*$/gm, '')
  .replace(/--ui-font-family:[^;]*;/g, '')
const compiler = await tailwind.compile(indexCss, {
  base: join(VAULT, 'ui'),
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? join(twDir, id.slice(12)) : resolve(base, id)
    return { path: file, base: dirname(file), content: readFileSync(file, 'utf8') }
  },
  loadModule: async () => { throw new Error('Tailwind 플러그인은 쓰지 않는다') },
})
const compiled = compiler.build([...candidates]).replace(/\/\*[\s\S]*?\*\//g, '')

/** 맨 위 규칙들을 { prelude, body } 로 쪼갠다(문자열 · 중괄호 짝을 지킨다). */
function splitRules(css) {
  const out = []
  let i = 0, start = 0
  const n = css.length
  while (i < n) {
    const ch = css[i]
    if (ch === '"' || ch === "'") { const q = ch; i++; while (i < n && css[i] !== q) { if (css[i] === '\\') i++; i++ } i++; continue }
    if (ch === ';') { const stmt = css.slice(start, i + 1).trim(); if (stmt) out.push({ prelude: stmt, body: null }); i++; start = i; continue }
    if (ch === '{') {
      const prelude = css.slice(start, i).trim()
      let depth = 1, j = i + 1
      while (j < n && depth) { const c = css[j]; if (c === '"' || c === "'") { const q = c; j++; while (j < n && css[j] !== q) { if (css[j] === '\\') j++; j++ } } else if (c === '{') depth++; else if (c === '}') depth--; j++ }
      out.push({ prelude, body: css.slice(i + 1, j - 1) })
      i = j; start = i; continue
    }
    i++
  }
  return out
}
const ROOTISH = /^(html|body|:root|:host|#root)$/
function scopeSelector(sel) {
  const parts = []
  let depth = 0, cur = ''
  for (const ch of sel) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = '' } else cur += ch }
  parts.push(cur)
  const mapped = parts.map((p) => p.trim()).map((p) => {
    if (/data-theme=["']?light/.test(p) && !p.includes(':where(')) return null // 비령은 어두운 화면만 쓴다
    p = p.replace(/^html?\[data-theme=["']?dark["']?\]\s*|^\[data-theme=["']?dark["']?\]\s*/, '').replace(/^html\[data-ui-font\]\s*/, '')
    if (!p || ROOTISH.test(p)) return '&'
    return p.replace(/^(html|body|:root)\s+/, '')
  }).filter(Boolean)
  return [...new Set(mapped)].join(',')
}
const hoisted = []
function scopeBlock(css) {
  let out = ''
  for (const r of splitRules(css)) {
    if (r.body == null) { if (/^@(import|charset)/.test(r.prelude)) hoisted.push(r.prelude); continue } // `@layer a,b;` 같은 선언은 버린다
    if (/^@(keyframes|font-face|property|counter-style)/.test(r.prelude)) { hoisted.push(`${r.prelude}{${r.body}}`); continue }
    if (/^@layer/.test(r.prelude)) { out += scopeBlock(r.body); continue } // 레이어는 풀어서 순서대로 놓는다(메인 화면 스타일보다 약해지지 않도록)
    if (/^@(media|supports|container)/.test(r.prelude)) { out += `${r.prelude}{${scopeBlock(r.body)}}`; continue }
    if (r.prelude.startsWith('@')) { hoisted.push(`${r.prelude}{${r.body}}`); continue }
    const sel = scopeSelector(r.prelude)
    if (sel) out += `${sel}{${r.body}}`
  }
  return out
}
const scoped = scopeBlock(compiled) + readFileSync(join(HERE, 'src/play.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const nested = `${hoisted.join('\n')}\n${SCOPE}{${scoped}}`
const lowered = await esbuild.transform(nested, { loader: 'css', target: ['chrome100', 'safari15', 'firefox100'], minify: true })
writeFileSync(join(OUT, 'play.css'), lowered.code.replace(assetRe, '$1$2'))

// ── 3. 그림 · 소리 ──
for (const f of publicFiles) copyFileSync(join(PUBLIC, f), join(OUT, f))
writeFileSync(join(OUT, 'README.md'), '# play/\n\n이 폴더는 `npm run play:build` 가 만든 결과물이다. 직접 고치지 말고 `systems/play/src` · `systems/biryeong` 을 고친 뒤 다시 빌드한다.\n')

const size = (f) => Math.round(statSync(join(OUT, f)).size / 1024)
console.log(`play/play.js ${size('play.js')}KB · play/play.css ${size('play.css')}KB · 그림/소리 ${publicFiles.length}개`)
if (result.warnings.length || lowered.warnings.length) console.log(`경고 ${result.warnings.length + lowered.warnings.length}건`, lowered.warnings.slice(0, 3).map((w) => w.text))
console.log(`보관고 화면 · 규칙 파일 ${Object.keys(result.metafile.inputs).filter((p) => p.includes('systems/vault/modules')).length}개를 묶었다.`)
