/* 秘靈 · 비령 — 오프닝 (v1.6)
 * 명부 등록(회원가입) 직후, 프로필이 아직 없는 계정에 한 번 화면 전체를 채워 흐른다. 끝나면 「내 프로필 만들기」 창으로 넘어간다.
 * 어둠 속 제호 → 컷마다 한두 줄(글자만 · vD.02.2부터 그림 없음) → 빛이 번지며 다음 화면.
 * 아래 도트 무대(STAGES)는 오프닝에서는 쓰지 않고 본편 이야기 화면만 쓴다(BiryeongOpening.stage).
 * 클릭 · Space · Enter · → 로 넘기고, Esc · [건너뛰기]로 끝낸다. 컷마다 8초 뒤 저절로 넘어간다.
 * 다시 보기: window.BiryeongOpening.play({ replay: true })
 * 자막은 스토리 스크립트 v4 의 첫 줄들 그대로다. 프로필을 만들면 본편 프롤로그가 그 다음 줄부터 잇는다.
 */
(() => {
  const AUTO_MS = 8000, TITLE_MS = 3600, BLOOM_MS = 1600;
  const seenKey = (id) => `biryeong-opening-seen:${id}`;
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ── 컷: stage(무대 그리기) · lines(자막) · type(타자기로 찍을 문장, 선택) ── */
  /* ── 도트 무대(장면 그림) — 오프닝과 본편 이야기 화면(quest.js 의 stage:… 연출)이 함께 쓴다 ── */
  const STAGES = {
    screens(s) {
      const grid = h('div', 'op-screens');
      for (let i = 0; i < 48; i++) { const c = h('i', 'op-screen'); c.style.animationDelay = `${(i % 8) * 0.07 + Math.floor(i / 8) * 0.11 + rnd(0, 0.25)}s`; grid.append(c); }
      s.append(grid, h('div', 'op-vignette'));
    },
    gauge(s) {
      const box = h('div', 'op-gauge');
      const num = h('b', 'op-gauge-num', '0'); const pct = h('span', 'op-gauge-pct', '%');
      const bar = h('div', 'op-gauge-bar'); const fill = h('i'); bar.append(fill);
      box.append(h('small', '', '秘靈 · 統合 神託'), h('div', 'op-gauge-row'), bar);
      box.children[1].append(num, pct);
      s.append(h('div', 'op-scan'), box);
      const t0 = performance.now(), dur = reduced() ? 1 : 4200;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur), v = Math.round(100 * (1 - Math.pow(1 - k, 3)));
        num.textContent = String(v); fill.style.width = `${v}%`;
        if (k < 1 && s.isConnected) requestAnimationFrame(tick); else box.classList.add('is-full');
      };
      requestAnimationFrame(tick);
    },
    news(s) {
      const tv = h('div', 'op-tv'); const screen = h('div', 'op-tv-screen');
      screen.append(h('div', 'op-tv-desk'), h('i', 'op-tv-anchor'), h('b', 'op-tv-logo', '秘靈 뉴스'));
      const lower = h('div', 'op-tv-lower'); lower.append(h('em', '', 'LIVE'), h('span', '', '전국 412개 신격 응답 통합 · 정확도 100%'));
      screen.append(lower); tv.append(screen); s.append(tv, h('div', 'op-scan'));
    },
    door(s) {
      const room = h('div', 'op-room');
      const door = h('div', 'op-door'); door.append(h('i', 'op-door-light'));
      const hand = h('div', 'op-hand'); hand.append(h('i', 'op-relic'));
      room.append(door, hand); s.append(room);
    },
    bell(s) {
      const bell = h('div', 'op-bell'); bell.append(h('i', 'op-bell-body')); s.append(bell);
      const count = h('small', 'op-bell-count', ''); s.append(count);
      let n = 0;
      const ring = () => {
        if (!s.isConnected || n >= 33) return;
        n += 1; const r = h('i', 'op-ring'); bell.append(r); setTimeout(() => r.remove(), 2400);
        count.textContent = `${n} / 33`;
        setTimeout(ring, reduced() ? 0 : n < 6 ? 620 : 150);
      };
      setTimeout(ring, 300);
    },
    empty(s) {
      const altar = h('div', 'op-altar');
      for (let i = 0; i < 5; i++) { const c = h('i', 'op-candle'); c.style.left = `${14 + i * 18}%`; c.style.height = `${rnd(26, 52)}px`; const sm = h('b', 'op-smoke'); sm.style.animationDelay = `${i * 0.4}s`; c.append(sm); altar.append(c); }
      s.append(altar);
    },
    tales(s) {
      s.append(h('div', 'op-pan op-pan-hero'));
      for (let i = 0; i < 7; i++) { const g = h('i', 'op-ghost'); g.style.left = `${rnd(6, 90)}%`; g.style.top = `${rnd(38, 72)}%`; g.style.animationDelay = `${rnd(0, 3)}s`; s.append(g); }
      s.append(h('div', 'op-glitch'));
    },
    mountain(s) { s.append(h('div', 'op-pan op-pan-north'), h('div', 'op-mist'), h('div', 'op-mist op-mist-2')); },
    gate(s) {
      const term = h('div', 'op-term');
      const face = h('div', 'op-face'); face.append(h('i', 'op-face-scan'));
      term.append(h('small', '', '秘靈 · 入山 認證'), face, h('em', 'op-term-ok', '一致'));
      s.append(term);
    },
  };

  /* ── 오프닝 컷: 스토리 스크립트의 첫 줄들(행 2 · 3 · 4 · 5 · 7). 이어지는 줄은 프로필을 만든 뒤 본편 프롤로그가 잇는다. ── */
  const CUTS = [
    { id: 'screens', lines: ['2035년 12월 31일 23시. 비령 서비스 10년째의 마지막 밤, 전국의 모든 화면에 같은 문장이 떠올랐다.'], type: '모든 신들의 응답을 하나로 수렴했습니다. 오늘부터 여러분은 신의 대답을 기다리지 않아도 됩니다.' },
    { id: 'gauge', lines: ['“정부 모처의 비령 운영단은 산신 · 용왕 · 조상신을 포함한 전국 412개 신격의 응답을 단일 결과로 통합한 「신탁」을 새해 0시부터 적용한다고 밝혔습니다. 응답 정확도는 100퍼센트입니다.”'] },
    { id: 'news', lines: ['“지난 10년 동안 비령은 점사와 재난 예측, 고인의 목소리 재현까지 맡아 왔습니다. 무속인 협회는 오늘 밤 성명을 내지 않았습니다.”'] },
    { id: 'door', lines: ['같은 시각, 전국의 무당 집마다 같은 일이 있었다. 수십 개의 방문이 조용히 열렸다 닫혔다.', '아이들은 저마다 다른 것을 쥐고, 서로를 모르는 채 같은 일을 겪었다.'] },
  ];

  function play({ replay = false, onDone } = {}) {
    if (document.getElementById('opening')) return;
    const instant = reduced();
    const root = h('div', 'opening'); root.id = 'opening'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '오프닝');
    const stage = h('div', 'op-stage'), cap = h('div', 'op-cap'), foot = h('div', 'op-foot');
    const title = h('div', 'op-title'); title.append(h('b', '', '秘靈'), h('span', '', '비 령'), h('small', '', '모든 신의 대답이 하나가 된 밤'));
    const skip = h('button', 'op-skip', '건너뛰기'); skip.type = 'button';
    const hint = h('p', 'op-hint'); const bar = h('div', 'op-bar'); const barFill = h('i'); bar.append(barFill);
    foot.append(hint, bar);
    root.append(stage, cap, title, skip, foot);
    document.body.append(root); document.body.classList.add('is-opening');
    let at = -1, timer = null, ready = false, done = false, typing = null;

    const finish = () => {
      if (done) return; done = true; clearTimeout(timer); clearInterval(typing);
      root.classList.add('is-leaving');
      const bloom = h('i', 'op-bloom'); root.append(bloom);
      setTimeout(() => {
        root.remove(); document.body.classList.remove('is-opening');
        window.removeEventListener('keydown', onKey);
        onDone ? onDone() : null;
      }, instant ? 0 : BLOOM_MS);
    };
    const show = (i) => {
      clearTimeout(timer); clearInterval(typing);
      if (i >= CUTS.length) { finish(); return; }
      at = i; const c = CUTS[i];
      stage.replaceChildren(); cap.replaceChildren();
      // vD.02.2 오프닝은 그림 없이 글자만(화면을 채운 어둠 위에 자막이 뜬다). 무대 그림(STAGES)은 본편 이야기 화면의 연출에서만 쓴다.
      c.lines.forEach((t, k) => { const p = h('p', 'op-line', t); p.style.animationDelay = `${0.5 + k * 1.1}s`; cap.append(p); });
      if (c.type) {
        const tp = h('p', 'op-type'); const cur = h('i', 'op-cursor'); tp.append(h('span'), cur); cap.append(tp);
        let n = 0; const span = tp.firstChild;
        setTimeout(() => { typing = setInterval(() => { n += 1; span.textContent = c.type.slice(0, n); if (n >= c.type.length) clearInterval(typing); }, instant ? 1 : 85); }, instant ? 0 : 900 + c.lines.length * 900);
      }
      hint.textContent = `${i === CUTS.length - 1 ? (replay ? '클릭하면 돌아가요' : '클릭하면 명부 등록으로') : '클릭하면 다음으로'} · ${i + 1} / ${CUTS.length}`;
      barFill.style.animation = 'none'; void barFill.offsetWidth; barFill.style.animation = `opBar ${AUTO_MS}ms linear forwards`;
      timer = setTimeout(() => show(at + 1), AUTO_MS + (c.type ? c.type.length * 85 : 0));
    };
    const next = () => { if (ready && !done) show(at + 1); };
    const onKey = (e) => {
      if (!ready) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'Escape') finish();
    };
    root.addEventListener('click', (e) => { if (e.target === skip) return; next(); });
    skip.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    window.addEventListener('keydown', onKey);
    // 어둠 속 제호 → 흐려지며 첫 컷
    setTimeout(() => title.classList.add('is-out'), instant ? 0 : TITLE_MS);
    setTimeout(() => { ready = true; root.classList.add('is-ready'); show(0); }, instant ? 0 : TITLE_MS + 900);
  }

  /** 명부 등록 직후 · 프로필이 없고 아직 안 본 계정이면 오프닝 → 프로필 만들기. */
  function maybeAutoplay() {
    const A = window.BiryeongAuth; const id = A?.session?.();
    if (!id) return;
    let seen = false, hasProfile = false;
    try { seen = localStorage.getItem(seenKey(id)) === '1'; hasProfile = !!JSON.parse(localStorage.getItem(A.saveKey()) || 'null')?.profile; } catch (_) { /* 저장 불가면 그냥 보여 준다 */ }
    if (seen || hasProfile) return;
    play({ onDone() { try { localStorage.setItem(seenKey(id), '1'); } catch (_) { /* 다음에 또 보면 그만 */ } location.hash = '#/profile'; } });
  }

  window.BiryeongOpening = { play, cuts: CUTS.length, stage: (id, el) => { if (!STAGES[id]) return false; STAGES[id](el); return true; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeAutoplay); else maybeAutoplay();
})();
