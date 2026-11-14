// 비령 play — 저장 (메인 화면과 같은 localStorage 키를 나눠 쓴다)
//
// 'biryeong-save-v1' 하나에 메인 화면과 실행 화면이 함께 적는다. 서로 덮어쓰지 않도록 맡은 칸을 나눴다.
//   메인 화면(app.js) 몫 : profile · flags · sets · achievements · titles · lantern
//   실행 화면(play)   몫 : game(초록동색 규칙의 플레이어 상태) · counts(업적 횟수) · playLog
// 저장할 때는 항상 저장소의 최신 값을 다시 읽어 상대 몫은 그대로 두고 자기 몫만 바꾼다.
// v1.0: 계정마다 따로 적는다(auth.js). 로그인 전이면 실행 화면이 붙지 않으므로 이 키를 쓸 일이 없다.
export const saveKey = () => window.BiryeongAuth?.saveKey?.() ?? 'biryeong-save-v1'
export const HOST_KEYS = ['game', 'counts', 'playLog']

export function readSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(saveKey()) || 'null')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

let warned = false
export function writeHost(patch) {
  const latest = readSave()
  const next = { ...latest }
  for (const k of HOST_KEYS) if (k in patch) next[k] = patch[k]
  try {
    localStorage.setItem(saveKey(), JSON.stringify(next))
    return true
  } catch (err) {
    if (!warned) { warned = true; console.warn('[비령] 저장 실패', err) }
    return false
  }
}
