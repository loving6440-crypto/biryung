/* 秘靈 vD.06.11 배경음악: 한국 시간 06~18 commu, 18~06 night.
 * 비전투 곡은 하나의 Audio 요소를 재사용해 브라우저 자동재생 정책으로 인한 전환 실패를 줄인다.
 * 전투 및 보스 BGM의 경로·음원·우선순위는 수정하지 않는다.
 */
(() => {
  'use strict';
  const SRC = { commu: 'assets/bgm/commu.mp3?v=D.06.11', night: 'assets/bgm/night.mp3?v=D.06.11', battle: 'assets/bgm/battle.mp3', boss: 'assets/bgm/boss.mp3' };
  const MUTE_KEY = 'biryeong-music', VOL_KEY = 'biryeong-music-vol';
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 제한 환경 */ } };
  let muted = get(MUTE_KEY) === 'off';
  let volume = Math.min(1, Math.max(0, parseFloat(get(VOL_KEY) ?? '0.4')));
  if (!Number.isFinite(volume)) volume = 0.4;
  let battle = null, playing = null, blocked = false, blockedTrack = null, pendingTrack = null, error = null;
  let ambientAudio = null, ambientKey = null;
  const positions = { commu: 0, night: 0 };
  const combat = {};
  let retryArmed = false;
  const seoulHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const ambientTrack = () => { const h = seoulHour(); return h >= 6 && h < 18 ? 'commu' : 'night'; };
  const inStory = () => document.body.classList.contains('is-scene') || document.body.classList.contains('is-opening') || !!document.getElementById('opening');
  const wanted = () => {
    if (muted || volume <= 0) return null;
    if (battle) return battle;
    if (inStory()) return null;
    // 새 가입·로그인·프로필 화면에서도 비전투 음악은 재생한다.
    return ambientTrack();
  };
  function clearResumePrompt() { document.getElementById('bgmResumePrompt')?.remove(); }
  function promptResume() {
    if (muted || volume <= 0 || !wanted() || document.getElementById('bgmResumePrompt')) return;
    const button = document.createElement('button');
    button.id = 'bgmResumePrompt'; button.type = 'button';
    button.textContent = '♪ 음악 재생';
    button.setAttribute('aria-label', '브라우저에서 차단된 배경음악 재생');
    button.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:10000;border:1px solid #b99c68;background:#101b32;color:#f4e3bb;padding:10px 16px;border-radius:6px;font:600 13px sans-serif;cursor:pointer';
    button.addEventListener('click', () => { sync(true); });
    document.body.append(button);
  }
  function clearRetry() {
    if (!retryArmed) return;
    retryArmed = false;
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
  }
  function onGesture() { clearRetry(); sync(true); }
  function armRetry() {
    if (retryArmed) return;
    retryArmed = true;
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
  }
  function ensureAmbient(k) {
    if (!ambientAudio) {
      ambientAudio = new Audio(SRC[k]);
      ambientAudio.loop = true; ambientAudio.preload = 'auto'; ambientKey = k;
    } else if (ambientKey !== k) {
      if (Number.isFinite(ambientAudio.currentTime)) positions[ambientKey] = ambientAudio.currentTime;
      ambientAudio.pause(); ambientKey = k;
      ambientAudio.src = SRC[k];
      try { ambientAudio.load?.(); } catch { /* 브라우저별 동작 */ }
      const seek = positions[k] || 0;
      if (seek > 0) {
        try { ambientAudio.currentTime = seek; } catch {
          ambientAudio.addEventListener?.('loadedmetadata', () => { if (ambientKey === k) { try { ambientAudio.currentTime = seek; } catch { /* seek 불가 */ } } }, { once: true });
        }
      }
    }
    return ambientAudio;
  }
  function ensureCombat(k) {
    if (!combat[k]) {
      combat[k] = new Audio(SRC[k]); combat[k].loop = true; combat[k].preload = 'none';
    }
    return combat[k];
  }
  function pauseAllExcept(chosen) {
    for (const a of [ambientAudio, ...Object.values(combat)]) {
      if (a && a !== chosen && !a.paused) a.pause();
    }
  }
  function sync(force = false) {
    const w = wanted();
    document.documentElement.dataset.bgm = w || 'none';
    if (!w) {
      pauseAllExcept(null); playing = null; blocked = false; blockedTrack = null; pendingTrack = null; error = null;
      clearRetry(); clearResumePrompt(); return;
    }
    const next = (w === 'commu' || w === 'night') ? ensureAmbient(w) : ensureCombat(w);
    pauseAllExcept(next);
    next.volume = volume;
    if (w !== playing && (w === 'battle' || w === 'boss')) {
      try { next.currentTime = 0; } catch { /* 미로딩 */ }
    }
    playing = w;
    if (blockedTrack !== w) { blocked = false; blockedTrack = null; }
    // 관찰자·타이머에 의한 반복 시도가 차단 알림을 연속해서 생성하지 않도록 한다.
    if (!force && (blockedTrack === w || pendingTrack === w)) return;
    if (next.paused) {
      try {
        const p = next.play();
        pendingTrack = w;
        if (p?.then) p.then(() => { if (pendingTrack === w) pendingTrack = null; if (wanted() === w) { blocked = false; blockedTrack = null; error = null; clearRetry(); clearResumePrompt(); } })
          .catch((e) => {
            if (pendingTrack === w) pendingTrack = null;
            if (wanted() !== w) return;
            blocked = true; blockedTrack = w; error = e?.name || 'PLAY_FAILED';
            armRetry(); promptResume();
          });
      } catch (e) {
        blocked = true; blockedTrack = w; pendingTrack = null; error = e?.name || 'PLAY_FAILED';
        armRetry(); promptResume();
      }
    } else {
      blocked = false; blockedTrack = null; pendingTrack = null; error = null; clearRetry(); clearResumePrompt();
    }
  }
  // 경과 시간 감시, 창 복귀, 대화·오프닝 닫힘에 따른 복구.
  new MutationObserver(() => sync()).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
  window.addEventListener('biryeong:saved', () => sync());
  window.addEventListener('biryeong:route', () => sync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  setInterval(sync, 30_000);
  window.BiryeongBgm = {
    battle(mode) { const m = mode === 'boss' ? 'boss' : mode ? 'battle' : null; if (battle === m) return; battle = m; sync(); },
    setMuted(v) { muted = !!v; set(MUTE_KEY, muted ? 'off' : 'on'); sync(true); },
    setVolume(v) { volume = Math.min(1, Math.max(0, Number(v) || 0)); set(VOL_KEY, String(volume)); sync(true); },
    state: () => ({ muted, volume, playing, battle, blocked, error, dayNight: ambientTrack() }),
    sync,
  };
  // 첫 재생은 사용자 입력이 필요할 수 있으므로 진입 즉시 시도하고, 차단 시 재생 단추를 표시한다.
  setTimeout(sync, 800);
})();
