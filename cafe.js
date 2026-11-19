/* 秘靈 · 비령 — 카페 정산 (vD.04)
 *
 *   카페에 남긴 기록(게시글 · 댓글 · 방문)을 메모로 적고, 정해진 보상 중 하나를 골라 제출하면 곧바로 받는다.
 *   · 제출 내역은 서버에 남는다 — 본인은 이 화면 아래에서, 관리자는 [관리자 도구 → 서버 관리 → 카페 정산 내역]에서 본다.
 *   · 서버 함수: supabase/schema.sql 의 bry_cafe_submit · bry_cafe_mine · bry_admin_cafe
 */
(() => {
  'use strict';
  const Auth = window.BiryeongAuth, App = window.BiryeongApp;
  if (!Auth || !App) return;
  const { h, btn, para, toast } = App;

  const KINDS = [
    { id: 1, label: '일반 로그', money: 50, spirit: 0 },
    { id: 2, label: '일반 로그 + 메인스토리', money: 70, spirit: 50 },
    { id: 3, label: '장편 로그', money: 80, spirit: 0 },
    { id: 4, label: '장편 로그 + 메인스토리', money: 100, spirit: 50 },
    { id: 5, label: '직접 기입(이벤트)', custom: true },
  ];
  const MONEY_MAX = 9999, SPIRIT_MAX = 999;
  const GUIDE = '[게시글 제목 / 날짜] [현재 댓글 수 / 날짜] [현재 방문 수 / 날짜] 셋 중 하나를 골라 기입해주세요. 메인스토리 또는 이벤트, 장편 보너스가 있는 경우 직접 계산해 수령하셔야 합니다.';
  const ERR = { invalid_memo: '메모를 적어 줘(200자까지).', invalid_value: '받을 냥 · 영력을 확인해 줘. (냥 0~9999 · 영력 0~999, 둘 다 0이면 안 된다)', too_many_requests: '너무 자주 제출했다. 잠시 뒤에 다시.', login_required: '로그인이 필요하다.' };
  const errText = (e) => ERR[e?.code] || ERR[e?.message] || e?.message || '서버에 닿지 못했다.';
  const call = (name, args) => Auth.call(name, args);
  const api = () => App.playApi();
  const kindOf = (id) => KINDS.find((k) => k.id === Number(id));
  const rewardText = (m, s) => [m ? `${m}냥` : '', s ? `영력 ${s}` : ''].filter(Boolean).join(' + ') || '없음';
  const when = (v) => { try { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(v)); } catch (_) { return '—'; } };
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
  const numIn = (ph, max) => { const i = h('input'); i.type = 'number'; i.min = '0'; i.max = String(max); i.step = '1'; i.placeholder = ph; i.inputMode = 'numeric'; return i; };

  /* ───────── 학생 화면(#/cafe) ───────── */
  function render(body) {
    if (!Auth.server || !Auth.token()) { body.append(para('카페 정산은 서버에 연결된 계정으로 들어왔을 때 열린다.')); return; }
    if (!api()?.player) { body.append(para('캐릭터를 불러온 뒤에 쓸 수 있다. 프로필을 만들었는지 확인해 줘.')); return; }
    const root = h('div', 'cafe-root'); body.append(root);

    const form = h('form', 'cafe-form');
    const memoLab = h('label', 'cafe-memo'); const memo = h('input'); memo.type = 'text'; memo.maxLength = 200; memo.required = true; memo.dataset.cafeMemo = '';
    memo.placeholder = '예) 꽃잎이 지는 밤 / 11.20';
    memoLab.append(h('span', 'cafe-label', '메모'), memo, h('small', 'cafe-guide', GUIDE));

    const pick = h('fieldset', 'cafe-kinds'); pick.append(h('legend', 'cafe-label', '받을 보상'));
    const cm = numIn('냥', MONEY_MAX), cs = numIn('영력', SPIRIT_MAX); cm.dataset.cafeMoney = ''; cs.dataset.cafeSpirit = '';
    const custom = h('div', 'cafe-custom'); custom.hidden = true;
    const cl = (t, i) => { const l = h('label', ''); l.append(h('span', '', t), i); return l; };
    custom.append(cl('냥', cm), cl('영력', cs));
    KINDS.forEach((k, i) => {
      const l = h('label', 'cafe-kind'); const r = h('input'); r.type = 'radio'; r.name = 'cafe-kind'; r.value = String(k.id); r.checked = i === 0; r.dataset.cafeKind = String(k.id);
      l.append(r, h('b', '', `${k.id}. ${k.custom ? '직접 기입' : rewardText(k.money, k.spirit)}`), h('span', '', k.custom ? '(이벤트) — 받을 냥과 영력을 직접 적는다' : `(${k.label})`));
      pick.append(l);
      r.addEventListener('change', () => { custom.hidden = kindOf(r.value)?.custom !== true; if (!custom.hidden) cm.focus(); });
    });
    pick.append(custom);

    const send = h('button', 'solid-btn cafe-send', '제출'); send.type = 'submit'; send.dataset.cafeSend = '';
    form.append(memoLab, pick, send);

    const histHead = h('p', 'cafe-hist-head', '지금까지 제출한 내역');
    const hist = h('div', 'cafe-hist'); hist.setAttribute('aria-live', 'polite');
    root.append(form, histHead, hist);

    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const k = kindOf(form.querySelector('input[name="cafe-kind"]:checked')?.value);
      const text = memo.value.trim();
      if (!text) { toast('카페 정산', ERR.invalid_memo); memo.focus(); return; }
      if (!k) return;
      const money = k.custom ? int(cm.value, 0, MONEY_MAX) : k.money, spirit = k.custom ? int(cs.value, 0, SPIRIT_MAX) : k.spirit;
      if (k.custom && !money && !spirit) { toast('카페 정산', ERR.invalid_value); cm.focus(); return; }
      busy = true; send.disabled = true;
      try {
        const r = await call('bry_cafe_submit', { p_kind: k.id, p_memo: text, p_money: money, p_spirit: spirit });
        api()?.grant?.({ money: r.money, spirit: r.spirit, log: `[카페 정산] ${k.label} — ${rewardText(r.money, r.spirit)} (${text})` });
        App.renderStatus?.(); Auth.pushSave?.(); App.ding?.('gift');
        toast('카페 정산', `${rewardText(r.money, r.spirit)}을(를) 받았다.`);
        memo.value = ''; cm.value = ''; cs.value = '';
        await loadMine(hist);
      } catch (err) { toast('카페 정산', errText(err)); }
      finally { busy = false; send.disabled = false; }
    });
    loadMine(hist);
  }

  async function loadMine(hist) {
    hist.replaceChildren(para('불러오는 중…'));
    try {
      const { rows } = await call('bry_cafe_mine');
      hist.replaceChildren();
      if (!rows.length) { hist.append(para('아직 제출한 내역이 없다.')); return; }
      const sumM = rows.reduce((a, r) => a + r.money, 0), sumS = rows.reduce((a, r) => a + r.spirit, 0);
      hist.append(h('p', 'cafe-sum', `모두 ${rows.length}건 · 받은 보상 ${rewardText(sumM, sumS)}`));
      rows.forEach((r) => hist.append(row(r)));
    } catch (e) { hist.replaceChildren(para(errText(e))); }
  }
  function row(r, who) {
    const el = h('div', 'cafe-row'); el.dataset.cafeRow = String(r.id);
    const top = h('div', 'cafe-row-top');
    top.append(h('span', 'cafe-when', when(r.at)), h('b', 'cafe-kind-tag', `${r.kind}. ${kindOf(r.kind)?.label || ''}`), h('span', 'cafe-reward', rewardText(r.money, r.spirit)));
    el.append(top);
    if (who) el.append(h('p', 'cafe-who', who));
    el.append(h('p', 'cafe-memo-text', r.memo));
    return el;
  }

  /* ───────── 관리자: 모든 학생의 정산 내역 ───────── */
  function admin(body) {
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '카페 정산 내역 — 학생들이 제출한 카페 정산 전부(최근 1000건). 아이디 · 이름 · 메모로 찾는다'));
    const bar = h('div', 'cafe-admin-bar');
    const q = h('input'); q.type = 'search'; q.placeholder = '찾기 (아이디 · 이름 · 메모)'; q.dataset.cafeAdminSearch = '';
    const kindSel = h('select'); kindSel.append(new Option('모든 종류', '')); KINDS.forEach((k) => kindSel.append(new Option(`${k.id}. ${k.label}`, String(k.id))));
    const reload = btn('ghost-btn', '새로고침', () => load());
    bar.append(q, kindSel, reload);
    const sum = h('p', 'cafe-sum'); const list = h('div', 'cafe-hist cafe-admin-list'); list.dataset.cafeAdmin = '';
    body.append(bar, sum, list);
    let rows = [];
    const draw = () => {
      const t = q.value.trim().toLowerCase(), kd = Number(kindSel.value) || 0;
      const shown = rows.filter((r) => (!kd || r.kind === kd) && (!t || [r.username, r.display, r.name, r.memo].some((x) => String(x || '').toLowerCase().includes(t))));
      list.replaceChildren();
      sum.textContent = `${shown.length}건${shown.length !== rows.length ? ` (전체 ${rows.length}건)` : ''} · 합계 ${rewardText(shown.reduce((a, r) => a + r.money, 0), shown.reduce((a, r) => a + r.spirit, 0))}`;
      if (!shown.length) { list.append(para(rows.length ? '찾는 내역이 없다.' : '아직 제출된 내역이 없다.')); return; }
      shown.forEach((r) => list.append(row(r, `${r.name ? `${r.name} · ` : ''}${r.display} @${r.username}`)));
    };
    async function load() {
      list.replaceChildren(para('불러오는 중…'));
      try { ({ rows } = await call('bry_admin_cafe')); draw(); } catch (e) { list.replaceChildren(para(errText(e))); }
    }
    q.addEventListener('input', draw); kindSel.addEventListener('change', draw);
    load();
  }

  window.BiryeongCafe = { render, admin, KINDS, GUIDE };
})();
