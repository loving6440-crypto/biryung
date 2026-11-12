/**
 * 秘靈 · 비령 — 실행 화면(play) 빌드.
 *
 *   npm run play:build        → 저장소 맨 위의 play/ 폴더(index.html · play.js · play.css · 그림/소리)를 다시 만든다.
 *
 * 보관고(systems/vault/modules)의 초록동색 화면 코드를 그대로 묶는다. 화면 코드는 고치지 않는다.
 *  - '@vault/…'      → systems/vault/modules/…
 *  - 'lucide-react'  → systems/play/src/shims/lucide-react.jsx (패키지 없이 같은 이름의 아이콘)
 *  - '/bgm.mp3' 처럼 맨 앞이 / 인 그림 · 소리 주소 → 'bgm.mp3' (GitHub Pages 의 하위 주소에서도 열리도록)
 *  - 스타일: 보관고 index.css 를 Tailwind 로 컴파일 + src/play.css
 *
 * 필요한 패키지: esbuild, react, react-dom, tailwindcss (npm install 로 설치).
 * node_modules 가 없으면 BIRYEONG_NODE_PATH(콜론으로 구분) 에서도 찾는다.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const VAULT = join(ROOT, 'systems/vault/modules')
const PUBLIC = join(ROOT, 'systems/vault/assets/public')
const OUT = join(ROOT, 'play')

const extraPaths = (process.env.BIRYEONG_NODE_PATH || '').split(':').filter(Boolean)
const searchPaths = [join(ROOT, 'node_modules'), ...extraPaths]
function findPkg(name) {
  for (const base of searchPaths) if (existsSync(join(base, name, 'package.json'))) return join(base, name)
  throw new Error(`패키지 ${name} 을(를) 찾지 못했다. npm install 을 하거나 BIRYEONG_NODE_PATH 를 지정한다.`)
}
const req = createRequire(join(findPkg('esbuild'), 'package.json'))
const esbuild = req(findPkg('esbuild'))
const tailwind = await import(pathToFileURL(join(findPkg('tailwindcss'), 'dist/lib.mjs')).href)

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p] })
const publicFiles = readdirSync(PUBLIC).filter((n) => n !== 'theme-bootstrap.js')
const assetRe = new RegExp(`(['"\`(])/(${publicFiles.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=['"\`)?#])`, 'g')
const relAssets = (text) => text.replace(assetRe, '$1$2')

// ── 1. 자바스크립트 ──
const vaultPlugin = {
  name: 'biryeong-vault',
  setup(b) {
    b.onResolve({ filter: /^@vault\// }, (a) => ({ path: join(VAULT, a.path.slice(7)) }))
    b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: join(HERE, 'src/shims/lucide-react.jsx') }))
    b.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (a) => {
      const [pkg, ...rest] = a.path.split('/')
      return { path: createRequire(join(findPkg(pkg), 'package.json')).resolve(a.path), namespace: 'file', pluginData: { pkg, rest } }
    })
    b.onLoad({ filter: /systems[\\/]vault[\\/]modules[\\/].*\.(m?js|jsx)$/ }, (a) => ({ contents: relAssets(readFileSync(a.path, 'utf8')), loader: 'jsx', resolveDir: dirname(a.path) }))
    // 화면에서 쓰는 png(로고 등)는 파일로 내보낸다.
  },
}
mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true })
const version = Date.now().toString(36)
const result = await esbuild.build({
  entryPoints: [join(HERE, 'src/main.jsx')],
  bundle: true,
  outfile: join(OUT, 'play.js'),
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.png': 'file', '.webp': 'file', '.svg': 'file' },
  assetNames: 'media/[name]-[hash]',
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"', 'import.meta.env.VITE_SERVER_URL': '""' },
  plugins: [vaultPlugin],
  metafile: true,
  logLevel: 'warning',
})

// ── 2. 스타일 (Tailwind v4) ──
const sources = [...walk(VAULT).filter((p) => /\.(m?js|jsx)$/.test(p)), ...walk(join(HERE, 'src')).filter((p) => /\.(m?js|jsx)$/.test(p))]
const candidates = new Set()
for (const p of sources) for (const m of readFileSync(p, 'utf8').matchAll(/[^\s"'`{}<>;=]+/g)) candidates.add(m[0].replace(/^[([,]+|[),.\]]+$/g, ''))
const twDir = findPkg('tailwindcss')
// 비령 글꼴 정책: 갈무리9 · KoPub 돋움 · KoPub 바탕만. 초록동색의 다른 글꼴 선언은 빌드할 때 걷어 낸다(보관고 원본은 그대로).
const DROP_FONTS = ['PF Stardust', 'Silver', 'Ramche', 'NeoDunggeunmo']
const indexCss = readFileSync(join(VAULT, 'ui/index.css'), 'utf8')
  .replace(/^@import url\([^)]*neodgm[^)]*\);?\s*$/m, '')
  .replace(/@font-face\s*\{[^}]*\}/g, (block) => (DROP_FONTS.some((f) => block.includes(`'${f}'`)) ? '' : block))
  .replace(/^\s*\[data-ui-font='(stardust|silver|ramche)'\][^\n]*\n/gm, '')
  .replace(/'NeoDunggeunmo',\s*/g, '')
  .replace(/\[data-ui-font='neo'\]/g, "[data-ui-font='galmuri9']")
const compiler = await tailwind.compile(indexCss, {
  base: join(VAULT, 'ui'),
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? join(twDir, id.slice(12)) : resolve(base, id)
    return { path: file, base: dirname(file), content: readFileSync(file, 'utf8') }
  },
  loadModule: async () => { throw new Error('Tailwind 플러그인은 쓰지 않는다') },
})
const css = relAssets(compiler.build([...candidates])) + '\n' + readFileSync(join(HERE, 'src/play.css'), 'utf8')
writeFileSync(join(OUT, 'play.css'), css)

// ── 3. 그림 · 소리 · 페이지 ──
for (const f of publicFiles) copyFileSync(join(PUBLIC, f), join(OUT, f))
writeFileSync(join(OUT, 'index.html'), readFileSync(join(HERE, 'index.template.html'), 'utf8').replaceAll('__VERSION__', version))
writeFileSync(join(OUT, 'README.md'), '# play/\n\n이 폴더는 `npm run play:build` 가 만든 결과물이다. 직접 고치지 말고 `systems/play/src` 를 고친 뒤 다시 빌드한다.\n')

const size = (f) => Math.round(statSync(join(OUT, f)).size / 1024)
console.log(`play/play.js ${size('play.js')}KB · play/play.css ${size('play.css')}KB · 그림/소리 ${publicFiles.length}개`)
if (result.warnings.length) console.log(`경고 ${result.warnings.length}건`)
const inputs = Object.keys(result.metafile.inputs).filter((p) => p.includes('systems/vault/modules')).length
console.log(`보관고 화면 · 규칙 파일 ${inputs}개를 묶었다.`)
