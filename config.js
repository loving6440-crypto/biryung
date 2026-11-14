/* 秘靈 · 비령 — 사이트 설정. 서버(Render)를 붙이면 여기만 고친다.
 *   api            서버 주소(예: 'https://biryeong.onrender.com'). 같은 서버에서 화면까지 내보내면 ''(빈 값) 그대로 두고 sameOrigin 을 true 로.
 *   sameOrigin     화면을 서버(Render)가 직접 내보낼 때 true — 관리자 코드를 서버의 ADMIN_CODE 환경변수로 확인한다.
 *   adminCodeHash  서버가 없을 때 쓰는 임시 관리자 코드의 SHA-256. 서버가 붙으면 '' 로 비워 둔다.
 *                  지금 임시 코드: biryeong-admin-2046  (바꾸려면 새 코드의 SHA-256 을 넣는다)
 */
window.BIRYEONG_CONFIG = {
  api: '',
  sameOrigin: false,
  // 본편 퀘스트의 서버 부분(Supabase). 비워 두면 이 브라우저의 값만 쓴다. 연결 순서: supabase/README.md
  supabaseUrl: '',
  supabaseAnonKey: '',
  adminCodeHash: 'e910fb815e02e1eb5530b7a19c60a25585e832fa30b18947c5c9c32d086a4f73',
};

/* 초상(포트레잇): 화자 이름 → 그림 주소. 비어 있으면 머리색 인장으로 나온다. 넣는 법: assets/portraits/README.md */
window.BIRYEONG_PORTRAITS = {
};
