// 비령 play — 진입점. play/index.html 이 이 파일(빌드 결과 play/play.js)을 불러온다.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// 메인 화면과 같은 글꼴 설정을 쓴다(갈무리9 · KoPub 돋움 · KoPub 바탕).
try {
  const font = localStorage.getItem('biryeong-ui-font')
  document.documentElement.dataset.uiFont = ['galmuri9', 'kopub-dotum', 'kopub-batang'].includes(font) ? font : 'galmuri9'
} catch { document.documentElement.dataset.uiFont = 'galmuri9' }
document.documentElement.dataset.theme = 'dark'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
