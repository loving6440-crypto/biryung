/* 비령 vD.06.1 — 배경음악.
 *  · 커뮤(국악): 한국 시간 06:00~17:59. 밤 음악: 18:00~05:59.
 *  · 일반 전투(극락 8bit) · 보스 전투(극락 v15): 전투가 열리면 처음부터, 끝나면 커뮤가 멈췄던 자리에서 이어진다.
 *  · 이야기(본편 · 이벤트 · 처음 오프닝)를 보는 동안에는 커뮤를 잠시 멈췄다가, 화면으로 돌아오면 이어서 튼다.
 *  [테마 관리]에서 끄고 켜고, 크기를 고른다(이 브라우저에 남는다).
 */
(() => {
  const App = window.BiryeongApp;
  const SRC = { commu: 'assets/bgm/commu.mp3?v=2', night: 'assets/bgm/night.mp3?v=D.06.8', battle: 'assets/bgm/battle.mp3', boss: 'assets/bgm/boss.mp3' };
  // 사용자 기기의 시간대와 관계없이 한국 시간(Asia/Seoul)으로 낮/밤을 판정한다.
  const seoulHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const ambientTrack = () => { const h = seoulHour(); return h >= 6 && h < 18 ? 'commu' : 'night'; };
  const MUTE_KEY = 'biryeong-music', VOL_KEY = 'biryeong-music-vol';
  const get = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* 이번만 */ } };
  let muted = get(MUTE_KEY) === 'off';
  let volume = Math.min(1, Math.max(0, parseFloat(get(VOL_KEY) ?? '0.4')));
  if (!Number.isFinite(volume)) volume = 0.4;
  let battle = null; // null | 'battle' | 'boss'
  let playing = null;
  const audios = {};
  const ensure = (k) => { if (!audios[k]) { const a = new Audio(SRC[k]); a.loop = true; a.preload = (k === 'commu' || k === 'night') ? 'auto' : 'none'; audios[k] = a; } return audios[k]; };

  const inStory = () => document.body.classList.contains('is-scene') || !!document.getElementById('opening');
  function wanted() {
    if (muted || volume <= 0) return null;
    if (battle) return battle;
    if (!App?.profile?.() || inStory()) return null;
    return ambientTrack();
  }
  let armed = false;
  function retry() { // 브라우저는 한 번 누르거나 쳐야 소리를 낸다
    if (armed) return; armed = true;
    const go = () => { armed = false; window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true); sync(); };
    window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
  }
  function sync() {
    const w = wanted();
    for (const [k, a] of Object.entries(audios)) { a.volume = volume; if (k !== w && !a.paused) a.pause(); }
    document.documentElement.dataset.bgm = w || 'none';
    if (!w) { playing = null; return; }
    const a = ensure(w); a.volume = volume;
    if (playing !== w && (w === 'battle' || w === 'boss')) { try { a.currentTime = 0; } catch (_) { /* 아직 */ } } // 전투 곡은 처음부터, 낮/밤 곡은 멈췄던 자리에서 이어서
    playing = w;
    if (a.paused) a.play().catch(retry);
  }
  // 이야기 창 · 오프닝이 열리고 닫히는 것을 본다
  new MutationObserver(() => sync()).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
  window.addEventListener('biryeong:saved', () => { if (!playing) sync(); });
  window.addEventListener('biryeong:route', () => sync());
  // 페이지를 열어둔 채 06:00/18:00을 지나도 음악이 전환된다(탭 절전 복귀 포함).
  setInterval(sync, 30 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

  window.BiryeongBgm = {
    /** 실행 화면이 부른다: 'battle' | 'boss' | null */
    battle(mode) { const m = mode === 'boss' ? 'boss' : mode ? 'battle' : null; if (m === battle) return; battle = m; sync(); },
    setMuted(v) { muted = !!v; set(MUTE_KEY, muted ? 'off' : 'on'); sync(); },
    setVolume(v) { volume = Math.min(1, Math.max(0, Number(v) || 0)); set(VOL_KEY, String(volume)); sync(); },
    state: () => ({ muted, volume, playing, battle }),
    sync,
  };
  setTimeout(sync, 800);
})();
