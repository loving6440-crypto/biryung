// 비령 play — 진입점. 메인 화면(index.html)이 play/play.js 를 불러오면 window.BiryeongPlay 가 생긴다.
//   BiryeongPlay.mount(el)        실행 화면을 el 안에 붙인다(한 번). 프로필이 바뀌면 reload().
//   BiryeongPlay.show('battle/scarecrow') / show(null)   그릴 화면을 고른다(null 이면 아무것도 안 그림 — 시간은 계속 흐른다).
//   BiryeongPlay.api()            { upgradeStat(key), openInventory(), grant({spirit,money,items,log}), player }
import './reskin.js'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { bridge } from './bridge.js'
import { ALL_ROUTES } from './routes.js'

let root = null
let generation = 0
const render = () => root?.render(<App key={generation} />)
window.BiryeongPlay = {
  mount(el) { if (root) return; root = createRoot(el); render() },
  reload() { generation += 1; bridge.api = null; render() },
  show(path) { bridge.setRoute(path) },
  api: () => bridge.api,
  routes: ALL_ROUTES.map((r) => ({ path: r.path, label: r.label, group: r.group })),
}
window.dispatchEvent(new CustomEvent('biryeong:play-ready'))
