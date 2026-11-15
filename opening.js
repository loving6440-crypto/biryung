/* 秘靈 · 비령 — 오프닝 (v1.6)
 * 명부 등록(회원가입) 직후, 프로필이 아직 없는 계정에 한 번 화면 전체를 채워 흐른다. 끝나면 「내 프로필 만들기」 창으로 넘어간다.
 * 초록동색 가입 전 오프닝처럼: 어둠 속 제호 → 컷마다 그림 연출 + 한두 줄 → 빛이 번지며 다음 화면.
 * 글자만 지나가지 않도록 컷마다 도트 무대가 있다(화면 격자 · 정확도 계기 · 문틈 빛 · 종 울림 · 꺼진 촛불 · 괴담 · 산문 · 단말기 인증).
 * 클릭 · Space · Enter · → 로 넘기고, Esc · [건너뛰기]로 끝낸다. 컷마다 8초 뒤 저절로 넘어간다.
 * 다시 보기: window.BiryeongOpening.play({ replay: true })
 * 연도는 적지 않는다(세계관 문서 · 본편 스크립트가 바뀌어도 어긋나지 않게).
 */
(() => {
  const AUTO_MS = 8000, TITLE_MS = 3600, BLOOM_MS = 1600;
  const seenKey = (id) => `biryeong-opening-seen:${id}`;
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ── 컷: stage(무대 그리기) · lines(자막) · type(타자기로 찍을 문장, 선택) ── */
  const CUTS = [
    {
      id: 'screens',
      lines: ['섣달그믐 밤, 전국의 모든 화면이 한꺼번에 켜졌다.'],
      type: '모든 신들의 응답을 하나로 수렴했습니다.',
      stage(s) {
        const grid = h('div', 'op-screens');
        for (let i = 0; i < 48; i++) { const c = h('i', 'op-screen'); c.style.animationDelay = `${(i % 8) * 0.07 + Math.floor(i / 8) * 0.11 + rnd(0, 0.25)}s`; grid.append(c); }
        s.append(grid, h('div', 'op-vignette'));
      },
    },
    {
      id: 'gauge',
      lines: ['산신 · 용왕 · 조상신 — 사백열두 신격의 대답이 단 하나의 결과로 합쳐졌다.', '예측 정확도,'],
      stage(s) {
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
          if (k < 1 && s.isConnected) requestAnimationFrame(tick); else { box.classList.add('is-full'); }
        };
        requestAnimationFrame(tick);
      },
    },
    {
      id: 'door',
      lines: ['그날 밤, 잠든 줄 알았던 아이의 방문이 조용히 열렸다.', '“누가 대신 대답해 준다고 해도, 네 대답은 네가 해.”'],
      stage(s) {
        const room = h('div', 'op-room');
        const door = h('div', 'op-door'); door.append(h('i', 'op-door-light'));
        const hand = h('div', 'op-hand'); hand.append(h('i', 'op-relic'));
        room.append(door, hand);
        s.append(room);
      },
    },
    {
      id: 'bell',
      lines: ['제야의 종이 서른세 번 울렸다.', '무구를 쥔 아이들은 그 소리를 저마다 다른 방에서, 똑같이 잠든 채 들었다.'],
      stage(s) {
        const bell = h('div', 'op-bell'); bell.append(h('i', 'op-bell-body'));
        s.append(bell);
        let n = 0;
        const ring = () => {
          if (!s.isConnected || n >= 33) return;
          n += 1; const r = h('i', 'op-ring'); bell.append(r); setTimeout(() => r.remove(), 2400);
          count.textContent = `${n} / 33`;
          setTimeout(ring, reduced() ? 0 : n < 6 ? 620 : 150);
        };
        const count = h('small', 'op-bell-count', ''); s.append(count);
        setTimeout(ring, 300);
      },
    },
    {
      id: 'empty',
      lines: ['새해 아침, 안방은 비어 있었다. 이불은 개어져 있고, 촛불은 끝까지 타 있었다.', '그날 아침, 신력 있는 무당들이 한꺼번에 사라졌다.'],
      stage(s) {
        const altar = h('div', 'op-altar');
        for (let i = 0; i < 5; i++) { const c = h('i', 'op-candle'); c.style.left = `${14 + i * 18}%`; c.style.height = `${rnd(26, 52)}px`; const sm = h('b', 'op-smoke'); sm.style.animationDelay = `${i * 0.4}s`; c.append(sm); altar.append(c); }
        const news = h('div', 'op-ticker'); news.append(h('span', '', '속보 · 전국에서 무속인 실종 신고 잇따라 · 같은 시각 일제히 · 행방 묘연 · 속보 · 전국에서 무속인 실종 신고 잇따라 ·'));
        s.append(altar, news);
      },
    },
    {
      id: 'tales',
      lines: ['겨울 내내, 사당의 신이 모습을 드러내고 죽은 이가 돌아왔다.', '괴담이 하나씩, 현실이 되었다.'],
      stage(s) {
        const bg = h('div', 'op-pan op-pan-hero'); s.append(bg);
        for (let i = 0; i < 7; i++) { const g = h('i', 'op-ghost'); g.style.left = `${rnd(6, 90)}%`; g.style.top = `${rnd(38, 72)}%`; g.style.animationDelay = `${rnd(0, 3)}s`; s.append(g); }
        s.append(h('div', 'op-glitch'));
      },
    },
    {
      id: 'mountain',
      lines: ['봄. 정부는 사라진 무당의 아이들을 한곳에 모았다.', '영기가 가장 짙은 산 — 비령산.'],
      stage(s) {
        s.append(h('div', 'op-pan op-pan-north'), h('div', 'op-mist'), h('div', 'op-mist op-mist-2'));
      },
    },
    {
      id: 'gate',
      lines: ['산문 앞 단말기가 당신의 얼굴을 훑는다.'],
      type: '후손 확인. 명부에 이름을 남기십시오.',
      stage(s) {
        const term = h('div', 'op-term');
        const face = h('div', 'op-face'); face.append(h('i', 'op-face-scan'));
        term.append(h('small', '', '秘靈 · 入山 認證'), face, h('em', 'op-term-ok', '一致'));
        s.append(term);
      },
    },
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
      const scene = h('div', `op-scene op-scene-${c.id}`); stage.append(scene); c.stage(scene);
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

  window.BiryeongOpening = { play, cuts: CUTS.length };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeAutoplay); else maybeAutoplay();
})();
