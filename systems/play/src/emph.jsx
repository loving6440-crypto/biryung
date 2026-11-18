// 비령 vD.02.3 — 전투 글에서 중요한 곳을 강조한다(요괴 영능력이 길어 핵심이 안 보이던 문제).
//   수치(피해 · 턴 · 라운드 · % · 배) = 붉은 굵은 글씨 · 막기 불가/봉인/흡수 같은 핵심 낱말 = 금색 굵은 글씨 · [상태] = 밝은 주황
const RX = /(\d+d\d+(?:\s*\+\s*\d+)?|\d+(?:\.\d+)?\s*(?:피해|턴|라운드|%|배|번|회)|(?:체력|의지력|영력|공격력|방어)\s*[+−-]?\s*\d+|막기 불가|막을 수 없(?:는|다|음)|막을 수 있음|봉인|흡수|기절|부활|즉사|빼앗|일행 전원|전원|\[[^\]]{1,12}\])/g
const KEY = /^(막기 불가|막을 수 없(?:는|다|음)|봉인|흡수|기절|부활|즉사|빼앗|일행 전원|전원)$/
export function Emph({ text }) {
  const s = String(text ?? '')
  const out = []; let last = 0; let m; let i = 0
  RX.lastIndex = 0
  while ((m = RX.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0]
    const cls = t.startsWith('[') ? 'emph-status' : KEY.test(t) ? 'emph-key' : t === '막을 수 있음' ? 'emph-soft' : 'emph-num'
    out.push(<b key={i++} className={cls}>{t}</b>)
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return <>{out}</>
}
export default Emph
