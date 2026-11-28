/* 秘靈 D.06.8 — 도깨비들의 터: 현재 일행/종료된 일행의 전체 대화를 안전한 독립 HTML 파일로 저장. */
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const kst = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
  };
  const safeId = (id) => { const n = Number(id); if (!Number.isSafeInteger(n) || n < 1) throw new Error('대화방 번호를 확인할 수 없습니다.'); return n; };

  // V.01 서버 부하: 내려받기 전용 함수(bry_room_msgs_export)로 1000건씩, 쪽 사이를 잠깐 쉬며 끝까지 모은다.
  //   · 방 정보는 첫 쪽에만 받는다(화면용 bry_room_msgs 는 300건마다 방 정보를 다시 만든다).
  //   · 서버가 「요청이 많다」고 하면 몇 초 쉬었다가 같은 자리부터 다시 받는다.
  //   · 서버에 아직 V.01 SQL 이 없으면 예전 함수(300건씩)로, 역시 쉬어 가며 받는다.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function collect(roomId, call, opt = {}) {
    const id = safeId(roomId), msgs = [], pause = opt.pause ?? 250;
    let after = 0, room = null, legacy = false, busy = 0;
    while (true) {
      let page;
      try {
        page = await call(legacy ? 'bry_room_msgs' : 'bry_room_msgs_export', { p_room: id, p_after: after });
      } catch (e) {
        if (!legacy && e?.code === 'schema_missing') { legacy = true; continue; }
        if (/too_many_requests|요청이 너무 많/.test(`${e?.code || ''} ${e?.message || ''}`) && busy < 6) { busy += 1; await sleep(opt.busyWait ?? 5000); continue; }
        throw e;
      }
      busy = 0;
      const batch = page?.msgs;
      if (!Array.isArray(batch)) throw new Error('서버의 대화 내역 형식이 올바르지 않습니다.');
      if (!room || after === 0) room = page?.room || room;
      for (const msg of batch) {
        const next = Number(msg.id);
        if (!Number.isSafeInteger(next) || next <= after) throw new Error('대화 내역의 순서가 올바르지 않습니다.');
        msgs.push(msg); after = next;
      }
      if (msgs.length > 100000) throw new Error('기록이 10만 건을 초과하여 한 번에 저장할 수 없습니다.');
      const more = legacy ? batch.length >= 300 : (page?.more ?? batch.length >= 1000);
      if (!more || !batch.length) return { messages: msgs, room: legacy ? page?.room || room : room };
      if (pause > 0) await sleep(pause);
    }
  }

  function html(room, messages, exportedAt = new Date()) {
    const members = Array.isArray(room?.everyone) && room.everyone.length ? room.everyone : (Array.isArray(room?.members) ? room.members : []);
    const participants = members.map((m) => m?.name || m?.u || '').filter(Boolean).join(' · ') || '일행';
    const kind = room?.kind === 'battle' ? '전투 일행' : '일행';
    const title = `비령 — 도깨비들의 터 대화 기록 #${safeId(room?.id)}`;
    const rows = messages.map((m) => {
      const notice = !m.u;
      return `<article class="line${notice ? ' notice' : ''}"><header><strong>${notice ? '알림' : esc(m.name || m.u)}</strong><time>${esc(kst(m.at))}</time></header><div class="body">${esc(m.body)}</div></article>`;
    }).join('\n');
    return `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>\n<style>body{margin:0;background:#101925;color:#eae3d4;font:15px/1.65 system-ui,-apple-system,"Malgun Gothic",sans-serif}main{max-width:850px;margin:30px auto;padding:20px}h1{font-size:23px;color:#e9c88b;margin:0 0 8px}p.meta{font-size:13px;color:#a9b3b6;margin:3px 0}.line{border:1px solid #48545d;background:#182536;margin:10px 0;padding:12px 16px;break-inside:avoid}.line header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}.line strong{color:#bed2f4}.line time{font-size:12px;color:#94a5af}.line .body{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:7px}.notice{background:#202638}.notice strong{color:#e9c88b}footer{font-size:12px;color:#94a5af;margin-top:30px}@media print{body{background:white;color:#222}.line{background:white;border-color:#ccc}.line strong,.notice strong,h1{color:#222}}</style></head>\n<body><main><h1>${esc(title)}</h1><p class="meta">종류: ${esc(kind)}</p><p class="meta">참여자: ${esc(participants)}</p><p class="meta">시작: ${esc(kst(room?.created_at))} · 종료: ${room?.ended_at ? esc(kst(room.ended_at)) : '진행 중'}</p><p class="meta">저장: ${esc(kst(exportedAt))} (한국 시간) · 메시지 ${messages.length.toLocaleString('ko-KR')}건</p><section aria-label="대화 내역">${rows}</section><footer>비령 · 도깨비들의 터 / 이 파일은 다운로드 시점의 기록이며, 이후 대화는 자동 추가되지 않습니다.</footer></main></body></html>`;
  }

  async function download(room, call) {
    if (typeof call !== 'function') throw new Error('대화 서버를 사용할 수 없습니다.');
    const id = safeId(room?.id);
    const { messages, room: serverMeta } = await collect(id, call);
    const meta = { ...room, ...serverMeta, id, // 응답이 축약되었을 때 기존 화면의 방 정보를 유지한다.
      everyone: serverMeta?.everyone || room?.everyone,
      members: serverMeta?.members || room?.members,
      created_at: serverMeta?.created_at || room?.created_at,
      ended_at: serverMeta?.ended_at || room?.ended_at };
    const data = html(meta, messages);
    const file = new Blob([data], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('/', '-');
    anchor.href = url; anchor.download = `biryeong_party_${id}_${stamp}.html`;
    document.body.append(anchor);
    try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    return messages.length;
  }
  window.BiryeongPartyLog = Object.freeze({ collect, html, download });
})();
