/* 秘靈 · 비령 — 사이트 설정. 서버(Render)를 붙이면 여기만 고친다.
 *   api            서버 주소(예: 'https://biryeong.onrender.com'). 같은 서버에서 화면까지 내보내면 ''(빈 값) 그대로 두고 sameOrigin 을 true 로.
 *   sameOrigin     화면을 서버(Render)가 직접 내보낼 때 true — 관리자 코드를 서버의 ADMIN_CODE 환경변수로 확인한다.
 *   adminCodeHash  보안상 기본 비활성화. 공개 정적 사이트에서는 관리자 자격을 확인할 수 없다.
 *                  관리자 권한은 Supabase의 bry_claim_admin 또는 서버 측 검증으로만 판단한다.
 */
window.BIRYEONG_CONFIG = {
  api: '',
  sameOrigin: false,
  // 본편 퀘스트의 서버 부분(Supabase). 비워 두면 이 브라우저의 값만 쓴다. 연결 순서: supabase/README.md
  supabaseUrl: '',
  supabaseAnonKey: '',
  adminCodeFrom: 'server', // 공개 정적 사이트는 관리자 코드 검증을 제공하지 않는다
  adminCodeHash: '', // 노출되는 공개 해시로 관리자 인증하지 않는다
};

/* 얼굴 그림(프사): 화자 이름 → 그림 주소. 메인 인물(윤진서 · 연호수 · △△ · 비 · 서창현)은 여기 적으면 대사마다 저절로 붙는다(없으면 빈 액자).
   넣는 법: assets/portraits/README.md   예) '윤진서': 'assets/portraits/jinseo.png', */
// vC.06 메인 인물 그림. 표정이 여러 장이면 { base, … } — 대사의 글 · 지문으로 표정을 고른다(원고 줄에 e: '표정 이름'을 적으면 그것).
//   △△: base 무표정 · serious 굳은 얼굴 · sad 시무룩 · smile 미소 / 비: base
//   서창현: base · sweat 곤란(땀) · smile 눈웃음 / 연호수: base · smile 씩 웃음 · frown 찡그림 / 윤진서: base · smile · worried 걱정 · surprised 놀람 · serious 굳은 얼굴
window.BIRYEONG_PORTRAITS = {
  '△△': { base: 'assets/portraits/dd-base.webp', serious: 'assets/portraits/dd-serious.webp', sad: 'assets/portraits/dd-sad.webp', smile: 'assets/portraits/dd-smile.webp' },
  '비': { base: 'assets/portraits/bi-base.webp' },
  '서창현': { base: 'assets/portraits/seo-base.webp', sweat: 'assets/portraits/seo-sweat.webp', smile: 'assets/portraits/seo-smile.webp' },
  '연호수': { base: 'assets/portraits/yeon-base.webp', smile: 'assets/portraits/yeon-smile.webp', frown: 'assets/portraits/yeon-frown.webp' },
  '윤진서': { base: 'assets/portraits/yoon-base.webp', smile: 'assets/portraits/yoon-smile.webp', worried: 'assets/portraits/yoon-worried.webp', surprised: 'assets/portraits/yoon-surprised.webp', serious: 'assets/portraits/yoon-serious.webp' },
};
