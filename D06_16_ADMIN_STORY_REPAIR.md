# 비령 D.06.16 — 관리자 스토리 연동 복구

## 발견 사항
- 관리자 스토리 관리는 `story_admin_list`, `story_admin_set`, `story_admin_routes`, `story_admin_route`, `story_admin_names` 등 Supabase RPC를 사용한다. 이 함수가 빠지거나 Data API 스키마 캐시에 없으면 404가 난다. 실제 운영 DB 상태는 이 파일만으로 확인할 수 없다.
- 이전 클라이언트는 JSON 업로드와 공개 변경을 서버 확인 전 로컬에 기록했다. 서버가 거절할 때 관리자 화면과 실제 서버가 불일치할 수 있다.
- 조회 실패 시 적절한 복구 안내가 부족했다.

## 반드시 적용할 순서
1. Supabase 백업을 만든다.
2. Supabase SQL Editor에서 `supabase/story_admin_repair_D.06.16.sql` 을 실행한다. 기존 story_chapters 및 story_routes 데이터를 삭제하지 않는다. 관리자 비밀번호를 초기화하지 않는다.
3. SQL 결과에 오류가 없음을 확인한다. 이미 D.06.15 투표 SQL을 적용하지 않았다면 별도로 `supabase/story_choice_revision_D.06.15.sql` 도 적용해야 한다.
4. 전체 ZIP 배포 또는 패치 ZIP의 `sync.js`, `quest.js`, `index.html`만 기존 프로젝트 루트에 교체한다.
5. 관리자 계정으로 로그인한 후 관리자 › 스토리 관리에 진입하여 장 목록, JSON 업로드, 지금 공개, 루트 공개를 차례로 확인한다. 공개 전 챕터 본문은 학생에게 보이지 않는다.

## 진단 쿼리
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('story_admin_list','story_admin_set','story_admin_routes','story_admin_route','story_admin_names')
order by 1;
```

## 검증 범위
- 정적 소스 구문 검증 및 자동 회귀 테스트 실행.
- 실제 운영 Supabase 접속·권한 검증·배포 및 여러 사용자 실동작 테스트는 불가. SQL 실행 전에 운영 DB 백업 필요.
