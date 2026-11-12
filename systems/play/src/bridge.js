// 비령 play — 메인 화면(app.js)과 실행 화면(React) 사이의 다리.
// 메인 화면이 주소를 정해 주면(setRoute) 실행 화면이 그 화면을 그리고,
// 실행 화면에서 생긴 일(저장 · 알림 · 화면 이동 요청)은 window 이벤트로 메인 화면에 알린다.
let route = null
const subs = new Set()
export const bridge = {
  getRoute: () => route,
  setRoute(next) { route = next ?? null; subs.forEach((f) => f()) },
  subscribe(f) { subs.add(f); return () => subs.delete(f) },
  /** 실행 화면 안에서 다른 화면으로 가고 싶을 때. 메인 화면이 주소(#/go/…)를 바꿔 준다. */
  nav(path) { window.dispatchEvent(new CustomEvent('biryeong:nav', { detail: { path } })) },
  back() { window.dispatchEvent(new CustomEvent('biryeong:nav', { detail: { back: true } })) },
  saved() { window.dispatchEvent(new CustomEvent('biryeong:saved')) },
  toast(head, text) { window.dispatchEvent(new CustomEvent('biryeong:toast', { detail: { head, text } })) },
  /** usePlayHost 가 채운다: { upgradeStat, openInventory, grant, player } */
  api: null,
}
