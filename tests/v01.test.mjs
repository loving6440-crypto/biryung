// V.01: 산출물 다시 만들기 · schema.sql 한 벌 · 관리자 코드 잠금 · 접속 주소 · 서버 전체 지우기 · 만물 도감 · 대화 로그 부하
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('V.01: schema.sql 은 본문이 한 벌이고 V.01 패치가 맨 끝에 붙는다(다시 실행하면 V.01 상태로 끝난다)', () => {
  const sql = read('supabase/schema.sql'), patch = read('supabase/v01_patch.sql');
  const head = '-- 秘靈 · 비령 — Supabase 표.';
  assert.equal(sql.split(head).length - 1, 1, '본문이 두 번 들어 있지 않다');
  assert.ok(sql.trimEnd().endsWith(patch.trimEnd()), 'V.01 패치가 맨 끝');
  // D.06.15 의 「복구」(저장본 q.flags 를 표로 넣기)는 schema 에도 패치에도 없다
  for (const s of [sql, patch]) {
    assert.ok(!s.includes("{story,q,flags}"), '저장본에서 표를 되살리지 않는다');
    assert.ok(!s.includes('cloud_saves cs join'), '옛 백업에서 표를 되살리지 않는다');
  }
  // 마지막 정의가 V.01 의 것
  const last = (name) => sql.slice(sql.lastIndexOf(`create or replace function public.${name}(`));
  assert.ok(last('bry_story_choice').includes('story_choice_exclusions') && last('bry_story_choice').includes('story_branch_ok'));
  assert.ok(last('story_admin_ok').includes('admin_code_check'));
  assert.ok(last('story_admin_choices').includes('edit_count') && last('story_admin_choices').includes('display_name as name'));
  assert.ok(last('bry_status').includes("'V.01'"));
  assert.ok(patch.includes("delete from public.story_choices where not biryeong_private.story_branch_ok(branch)"), '비본편 줄 정리');
  // 지난 패치 파일은 old/ 로 옮겨 실수로 다시 돌리지 않게
  for (const f of ['security_patch_D.06.6', 'party_bell_D.06.12', 'story_choice_revision_D.06.15', 'story_admin_repair_D.06.16', 'story_choice_admin_cleanup_D.06.18']) {
    assert.ok(!existsSync(new URL(`../supabase/${f}.sql`, import.meta.url)) && existsSync(new URL(`../supabase/old/${f}.sql`, import.meta.url)), f);
  }
});

test('V.01: 관리자 코드 — 서로 다른 틀린 코드 5번이면 1시간 잠금, 실패는 예외 없이 403/429 로 남긴다', () => {
  const p = read('supabase/v01_patch.sql');
  assert.ok(p.includes("then 100 else 5 end") && p.includes("now() + interval '1 hour'"));
  assert.ok(p.includes("array['ip:' || biryeong_private.ip(), 'all']") && p.includes("array['acct:' || a.id, 'ip:' || ip(), 'all']"));
  assert.ok(p.includes("set_config('response.status', case when r = 'locked' then '429' else '403' end, true)"));
  const fnBody = (name) => { const i = p.indexOf(`function public.${name}(`); return p.slice(i, p.indexOf('end $$;', i)); };
  for (const f of ['story_admin_list', 'story_admin_set', 'story_admin_routes', 'story_admin_route', 'story_admin_names', 'story_admin_choices', 'story_admin_choice_delete']) {
    assert.ok(!fnBody(f).includes("raise exception 'admin code mismatch'"), `${f}: 예외로 실패 기록을 되돌리지 않는다`);
  }
  assert.ok(p.includes("revoke all on function public.story_admin_ok(text) from public, anon, authenticated"));
  const sync = read('sync.js'), auth = read('auth.js');
  assert.ok(sync.includes('관리자 코드를 5번 틀려 1시간 동안 다시 시도할 수 없어요.') && sync.includes('/^rpc\\/story_admin_/.test(path)'));
  assert.ok(auth.includes("c.error === 'admin_locked'"));
});

test('V.01: 접속 주소는 cf-connecting-ip → X-Forwarded-For 첫 항목', () => {
  const p = read('supabase/v01_patch.sql');
  assert.ok(p.includes("j ->> 'cf-connecting-ip'") && p.includes("split_part(coalesce(j ->> 'x-forwarded-for', ''), ',', 1)"));
});

test('V.01: 서버 전체 지우기는 새로 생긴 표까지 비운다', () => {
  const r = read('supabase/reset_all.sql');
  for (const t of ['story_choice_exclusions', 'throttle_windows', 'admin_code_fails', 'admin_code_locks', 'room_bells']) assert.ok(r.includes(`biryeong_private.${t},`), t);
});

test('V.01: 만물 도감은 얻는 곳이 알려진 아이템만 센다', () => {
  const ctx = { window: {} };
  new Function('window', read('codex-data.js'))(ctx.window);
  const items = ctx.window.BIRYEONG_CODEX.items;
  const app = read('app.js');
  const src = app.slice(app.indexOf('function finalItemCounts('), app.indexOf('// 최종 업적: 수집 완료는'));
  const finalItemCounts = new Function(`${src}; return finalItemCounts`)();
  const counted = items.filter(finalItemCounts);
  assert.ok(app.includes('const itemList = (CODEX.items || []).filter(finalItemCounts);'));
  assert.equal(counted.length, items.length - 20, "얻는 곳 없음 19 (괴담 수칙서 포함) + 루트 전용 1");
  for (const id of ['st-dangsan-twig', 'st-ghost-rules', 'st-pass', 'st-light-locket']) assert.ok(!counted.some((x) => x.id === id), id);
  assert.ok(counted.every((x) => x.from && !x.from.includes('아직 알려진 곳이 없다')));
  assert.ok(read('titles-final.js').includes('이벤트 물건은 세지 않는다'));
});

test('V.01: 산출물은 소스에서 다시 만든 것 — 화면 묶음 · 도감 · 화이트 모드', () => {
  const play = read('play/play.js'), codex = read('codex-data.js'), light = read('theme-light.css');
  assert.ok(play.includes('borrowPsychic') && !play.includes('typeof __borrow'));
  assert.ok(codex.includes('무구보관소에서 무구를 일반 강화(10~12)할 때 쓰는 재료(2·3·4개 필요).'));
  assert.ok(light.includes('.party-call-bell'), '일행 호출 종도 화이트 모드');
  const html = read('index.html');
  assert.ok(!/\?v=D\.06/.test(html) && html.includes('?v=V.01-3'));
});

test('V.01: 매점 판매가는 개척 터 레벨로 — 같은 터 같은 종류는 같은 값, 터가 어려울수록 비싸다', () => {
  const pt = read('systems/play/patches.mjs');
  assert.ok(pt.includes("file: 'game/sell.js'") && pt.includes('const L = Number.isFinite(site.targetStat) ? site.targetStat : 1') && pt.includes('Math.round(8 + L * 2.6)'));
  const csv = read('SELL_PRICES_V01.csv').trim().split('\n').slice(1).map((l) => l.split(','));
  const row = (id) => csv.find((r) => r[0] === id);
  assert.equal(row('brick')[5], row('chwinamul')[5], '벽돌 · 취나물: 같은 진달래 샘터길(9)');
  assert.ok(Number(row('chwinamul')[5]) > Number(row('chwinamul')[4]), '취나물은 올랐다');
  assert.ok(Number(row('stone')[5]) < Number(row('somdari')[5]));
});

test('V.01: 업데이트 노트 창 대신 동아리 창 — 동아리를 골라 일퀘 · 주퀘를 본다', () => {
  const html = read('index.html'), app = read('app.js'), host = read('systems/play/src/usePlayHost.js');
  assert.ok(html.includes('data-menu="clubs"') && !html.includes('data-menu="notes"'));
  assert.ok(app.includes("clubs: () => go('#/clubs')") && app.includes("else if (head === 'clubs') renderClubs();"));
  assert.ok(app.includes('api.clubBoard(c.id)') && app.includes("'club-tabs'"));
  assert.ok(host.includes('clubList: () => CLUBS.map(') && host.includes('clubMine: () => countsRef.current.club?.id ?? null'));
});

test('V.01: 첫 화면 기밀 문서 — 공지사항이 첫 탭 · 처음부터 열림, 주요 이야기는 옆 탭', () => {
  const html = read('index.html');
  const a = html.indexOf('data-lore-tab="notice" aria-selected="true"'), b = html.indexOf('data-lore-tab="story" aria-selected="false"');
  assert.ok(a > 0 && b > a, '공지사항이 앞');
  assert.ok(html.indexOf('id="loreNotice"') < html.indexOf('id="loreStory"') && html.includes('<div class="lore-pane" id="loreStory" role="tabpanel" hidden>'));
});

test('V.01: 영능력 점검 — 혼자 · 일행 전투에서 다르게 돌던 것', async () => {
  const pt = read('systems/play/patches.mjs');
  assert.ok(pt.includes("const buffed = false // V.01 생존본능은 효험과 상관없다"), '생존본능: 효험 의지력 받지 않음');
  assert.ok(pt.includes("Math.max(Math.floor(s.php), Math.min(s.phpMax ?? 100, 100))") && pt.includes('healed.php = Math.max(healed.php, Math.min(healed.phpMax, 100))'), '형상 기억: 100까지, 깎지 않음');
  assert.ok(pt.includes("if (id === 'warding-scripture' && !state.party)") && pt.includes('if (target && target.id !== m.id) target.mp'), '벽사진경: 일행 전용 · 나에게 두 번 채우지 않음');
  assert.ok(pt.includes("x.mp+Math.max(0,Math.floor(r.shareMpAmount||0))"), '진리의 어둠: 바친 만큼');
  assert.ok(pt.includes("stats: cur.starBonus ? withHidden(stats, { aggression: stats.aggression + cur.starBonus }) : stats,\\n"), '칠성낙인: 혼자일 때 영능력에도');
  assert.ok(read('systems/play/vaultEdits.mjs').includes('((solo ? s.es.bryAttackHalf>0 : s.es.bryAttackHalfAct) ? 0.5 : 1)'), '한붙음: 혼자일 때 한 라운드 더 줄던 것');
  const st = read('systems/play/src/steal.js');
  assert.ok(st.includes("'geuseundae#2': { mp:0, shareRemainingMp:true, partyOnly:true }") && st.includes("'jangsanbeom#2': { mp:10, redirectNext:true, partyOnly:true }"));
  const { V01_PSYCHIC_TEXT } = await import('../systems/play/src/psychicText.js');
  for (const id of ['echo-form', 'warding-scripture', 'steal-geuseundae-2', 'steal-jangsanbeom-2']) assert.ok(V01_PSYCHIC_TEXT[id]?.detail);
  const ctx = { window: {} }; new Function('window', read('codex-data.js'))(ctx.window);
  const C = Object.fromEntries(ctx.window.BIRYEONG_CODEX.psychics.map((p) => [p.id, p]));
  assert.ok(C['echo-form'].detail.includes('100까지') && C['warding-scripture'].detail.startsWith('일행 전투에서만'));
});

test('V.01: 기본 영능력 얻는 방법을 실제로 세고, 채우면 준다', async () => {
  const PU = await import('../systems/play/src/psyUnlock.js');
  const defs = [{ id: 'earth-step', label: '지신밟기' }];
  let r = PU.notePsyBattle({ psychics: [] }, { g: 12, mp: 80, sc: 9, mist: 3, rash: 4, smash: 2, a: 5, hit: 1 }, { party: false, size: 1, win: true }, defs);
  assert.deepEqual(r.got, []);
  assert.equal(PU.psyProgressOf(r.player, 'earth-step').text, '12회 / 20회 (한 전투 최고)');
  assert.equal(PU.psyProgressOf(r.player, 'seven-stars').text, '4회 / 20회');
  r = PU.notePsyBattle(r.player, { g: 20, rash: 4 }, { party: false, size: 1, win: true }, defs);
  assert.ok(r.got.includes('earth-step') && r.got.includes('spirit-barrier'), '한 판 방어 20 · 한 대도 안 맞고 이김');
  assert.equal(r.player.psyProg.rash, 8, '누적은 더한다');
  assert.equal(r.player.psyProg.guardBest, 20, '최고는 큰 쪽');
  r = PU.notePsyBattle({ psychics: [] }, { a: 0, alone: 1, hit: 3 }, { party: true, size: 3, win: true, boss: true, partySize: 3 }, defs);
  assert.ok(r.got.includes('karmic-recompense') && r.got.includes('falling-light') && !r.got.includes('dokkaebi-fire'));
  r = PU.notePsyBattle({ psychics: [] }, { a: 2, hit: 1 }, { party: true, size: 2, win: true, boss: true, partySize: 3 }, defs);
  assert.deepEqual(r.got, ['dokkaebi-fire']);
  const pt = read('systems/play/patches.mjs'), host = read('systems/play/src/usePlayHost.js');
  assert.ok(pt.includes("nurse: (p.psyProg?.nurse || 0) + 1") && host.includes('globalThis.__BRY_PSY_STAT = (stat, meta)') && host.includes('psyProgress: (id) =>'));
  assert.ok(pt.includes("globalThis.__BRY_PSY_STAT?.(me.bryStat") && pt.includes("globalThis.__BRY_PSY_STAT?.(state.bryStat"));
});

test('V.01: 모바일 · 컴퓨터 기록 맞추기 — 다른 기기가 올린 기록을 덮어쓰지 않는다', () => {
  const sql = read('supabase/v01_patch.sql'), auth = read('auth.js');
  assert.ok(sql.includes('drop function if exists public.bry_save_put(text, jsonb);') && sql.includes('p_base timestamptz default null'));
  assert.ok(sql.includes("return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur.updated_at, 'device', cur.data ->> 'syncDevice')"));
  assert.ok(read('supabase/schema.sql').trimEnd().endsWith(sql.trimEnd()));
  assert.ok(auth.includes('args.p_base = meta.at') && auth.includes("e.code === 'schema_missing' && args.p_base"), '기준 시각을 보내고, 서버가 아직이면 예전처럼');
  assert.ok(auth.includes('if (!opt.force && meta.at && !touchedSince(id)) return false;'), '켜 두기만 한 화면은 올리지 않는다');
  assert.ok(auth.includes('setInterval(() => { if (!document.hidden && !idle()) checkOther(); }, 60000)') && auth.includes("window.addEventListener('focus', () => checkOther())"));
  assert.ok(auth.includes('if (dirty && (ask || touchedSince(id)))'), '들어올 때 이 기기에서 한 것이 없으면 다른 기기 기록을 받는다');
  assert.ok(auth.includes('leaving = true; location.reload();'), '받아 새로고침할 때 닫히는 화면이 옛 기록을 올리지 못한다');
});

test('V.01: 한 주는 일요일 ~ 토요일 — 화면(주간 기록 · 동아리 · 랭킹)과 서버(week0)가 같다', async () => {
  const { applyPatches } = await import('../systems/play/patches.mjs');
  const src = applyPatches('systems/vault/modules/game/activityCounters.js', read('systems/vault/modules/game/activityCounters.js'));
  const body = src.match(/export const weekStartOf = [\s\S]*?\n\}/)[0].replace('export ', '');
  const weekStartOf = new Function('KST_MS', 'DAY_MS', `${body}; return weekStartOf`)(9 * 3600e3, 864e5);
  const day = (iso) => new Date(weekStartOf(Date.parse(iso)) + 9 * 3600e3).toISOString().slice(0, 10);
  assert.equal(day('2026-11-28T23:59:00+09:00'), '2026-11-22'); // 토요일 → 그 주 일요일
  assert.equal(day('2026-11-29T00:00:00+09:00'), '2026-11-29'); // 일요일 0시에 새 주
  assert.ok(src.includes('weekStart === ws + DAY_MS'), '예전(월요일)으로 적힌 이번 주 기록은 이어진다');
  const patch = read('supabase/v01_patch.sql');
  assert.ok(patch.includes("(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day')"), 'SQL week0 일요일');
  for (const f of ['app.js', 'systems/play/src/ClubQuests.jsx']) assert.ok(!read(f).includes('월요일 0시'), f);
  assert.ok(read('community.js').includes('지금까지의 기록 보기'), '낮새들의 터: 이번 주 + 지난 기록');
});

test('V.01: 안목이 높을수록 분실물을 잘 줍는다(1 → 1%, 40 → 10%)', async () => {
  const { lostFindChance } = await import('../systems/play/src/lostFind.js');
  assert.equal(lostFindChance(1), 0.01);
  assert.ok(Math.abs(lostFindChance(40) - 0.1) < 1e-9);
  assert.ok(Math.abs(lostFindChance(99) - 0.1) < 1e-9, '40을 넘어도 10%');
  assert.ok(lostFindChance(20) > 0.05 && lostFindChance(20) < 0.06);
  assert.ok(read('systems/play/src/usePlayHost.js').includes('lostFindChance(ins)'));
});

test('V.01: 도깨비 증표 퀘스트 15종 — 사찰 · 하루 하나 · 따로 열고 기본은 닫힘', () => {
  const q = read('systems/play/src/npcQuests.js');
  assert.equal((q.match(/^\s+G\('god\d\d'/gm) || []).length, 15);
  assert.ok(q.includes("export const GOD_PLACE = 'gym:center:climb:temple'"));
  assert.ok(read('systems/play/src/usePlayHost.js').includes('Number(globalThis.BiryeongQuest?.routes?.GOBLIN_QUESTS) === 1'), '공개해야 보인다');
  const qs = read('quest.js');
  assert.ok(qs.includes("sync.adminRoute(adminCode(), 'GOBLIN_QUESTS'") && qs.includes("godBox.dataset.godQuestAdmin = ''"), '관리자 단추가 따로');
  assert.ok(qs.includes('godName: () => godName()'));
});

test('V.01: 비밀번호를 잊었을 때 — 임시 비밀번호 요청 · 관리자 확인 · 새 비밀번호', () => {
  const patch = read('supabase/v01_patch.sql');
  for (const f of ['bry_pw_reset_request', 'bry_pw_reset_finish', 'bry_pw_reset_state', 'bry_admin_pw_resets', 'bry_admin_pw_reset_clear']) assert.ok(patch.includes(`function public.${f}(`), f);
  assert.ok(patch.includes("'must_change', temp"), '임시 비밀번호로 들어오면 알린다');
  assert.ok(!/bry_pw_reset_request[\s\S]{0,1600}'temp_pw', tmp/.test(patch), '요청한 사람에게 임시 비밀번호를 돌려주지 않는다');
  assert.ok(read('supabase/reset_all.sql').includes('biryeong_private.pw_resets'));
  assert.ok(read('auth.js').includes('forceNewPassword') && read('server.js').includes('bry_admin_pw_resets'));
});

test('V.01: 동아리 할일을 채우면 붉은 알림 · 단추에 숫자', () => {
  const a = read('app.js');
  assert.ok(a.includes('function checkClubAlerts') && a.includes("'is-alert'") && a.includes('menu-alert'));
  assert.ok(a.includes('try { checkClubAlerts(); }'), '기록이 바뀔 때마다 확인');
});

test('V.01: 첫 화면 스크립트는 문법 오류가 없다', () => {
  for (const f of ['app.js', 'auth.js', 'quest.js', 'server.js', 'community.js', 'party.js', 'beast-event.js']) assert.doesNotThrow(() => new Function(read(f)), f);
});
