/* 秘靈 · 비령 — 벼룩시장 (vD.03)
 *
 *   사람들이 값을 정해 올린 물건을 사고판다.
 *   · 올린 사람은 보이지 않는다(서버가 이름을 주지 않는다).
 *   · 올리기: 여러 물건을 「올릴 목록」에 담아 한 번에 올린다 — 올리는 순간 소지품에서 빠진다(거두면 우편으로 돌아온다).
 *   · 사기: 여러 물건을 장바구니에 담아 한 번에 산다 — 물건마다 가장 싼 매물부터 자동으로 채운다.
 *     산 물건과 거스름돈은 우편으로 바로 들어온다(이 화면이 곧바로 우편함을 연다).
 *   · 판 사람: 팔린 만큼의 냥이 우편으로 자동으로 들어온다(접속 중이면 30초 안, 아니면 다음 접속 때).
 *
 *   서버 함수: supabase/schema.sql 의 bry_market · bry_market_post · bry_market_cancel · bry_market_buy
 */
(() => {
  'use strict';
  const Auth = window.BiryeongAuth, App = window.BiryeongApp;
  if (!Auth || !App) return;
  const { h, btn, para, toast } = App;
  const QTY_MAX = 999, PRICE_MAX = 99999, LIST_MAX = 20;
  const ERR = {
    price_changed: '그사이 값이 바뀌었다 — 아무것도 사지 않았다. 목록을 다시 불러왔으니 확인하고 다시 사 줘.',
    sold_out: '그사이 다 팔렸다.', market_full: '한 사람이 올려 둘 수 있는 매물은 60개까지다. 내 매물을 거두거나 팔린 뒤에 올려 줘.',
    not_found: '이미 팔렸거나 거둔 매물이다.', too_many_requests: '너무 자주 했다. 잠시 뒤에 다시.', invalid_value: '올릴 수 없는 내용이다.', login_required: '로그인이 필요하다.',
  };
  const errText = (e) => ERR[e?.code] || ERR[e?.message] || e?.message || '서버에 닿지 못했다.';
  const call = (name, args) => Auth.call(name, args);
  const api = () => App.playApi();
  const nameOf = (id) => api()?.itemName?.(id) || id;
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

  let data = { items: [], mine: [] }, tab = 'buy', root = null, timer = null, busy = false, filter = '';
  const cart = new Map();     // 물건 → 살 개수
  const staged = new Map();   // 물건 → { qty, price }

  // 물건 하나를 qty 개 살 때의 값(가장 싼 매물부터) — { qty: 실제로 살 수 있는 수, cost }
  function estimate(id, qty) {
    const it = data.items.find((x) => x.item === id);
    let left = qty, cost = 0, got = 0;
    for (const [price, n] of it?.levels || []) { if (left <= 0) break; const t = Math.min(left, n); cost += t * price; got += t; left -= t; }
    return { qty: got, cost };
  }
  const cartTotal = () => [...cart].reduce((s, [id, q]) => s + estimate(id, q).cost, 0);

  async function load() {
    try { data = await call('bry_market'); data.items ||= []; data.mine ||= []; }
    catch (e) { if (root) toast('벼룩시장', errText(e)); }
    for (const [id, q] of cart) { const a = estimate(id, q).qty; if (!a) cart.delete(id); else if (a < q) cart.set(id, a); }
    draw();
  }

  function render(body) {
    root = body;
    if (!Auth.server || !Auth.token()) { body.append(para('벼룩시장은 서버에 연결된 계정으로 들어왔을 때 열린다.')); root = null; return; }
    if (!api()?.player) { body.append(para('캐릭터를 불러온 뒤에 쓸 수 있다. 프로필을 만들었는지 확인해 줘.')); root = null; return; }
    body.append(h('div', 'mkt-root'));
    draw(); load();
    clearInterval(timer);
    timer = setInterval(() => { if (!root?.isConnected) { clearInterval(timer); root = null; return; } if (!document.hidden && !busy) load(); }, 20000);
  }
  window.addEventListener('biryeong:market-mail', () => { if (root?.isConnected) load(); });

  function draw() {
    const box = root?.querySelector('.mkt-root'); if (!box) return;
    const p = api()?.player;
    const tabs = h('nav', 'mkt-tabs');
    for (const [k, label] of [['buy', '사기'], ['sell', '팔기'], ['mine', `내 매물 ${data.mine.length || ''}`]]) {
      const b = btn(`mkt-tab${tab === k ? ' on' : ''}`, label.trim(), () => { tab = k; draw(); }); b.dataset.mktTab = k; tabs.append(b);
    }
    const head = h('div', 'mkt-head');
    head.append(para('사람들이 값을 정해 올린 물건을 사고판다. 누가 올렸는지는 보이지 않고, 같은 물건이면 가장 싼 것부터 팔린다. 팔린 만큼의 냥은 판 사람에게 우편으로 자동으로 들어간다.'),
      h('p', 'mkt-money', `주머니 ${Math.floor(p?.money || 0)}냥`));
    box.replaceChildren(head, tabs, tab === 'buy' ? drawBuy() : tab === 'sell' ? drawSell() : drawMine());
  }

  /* ───────── 사기 ───────── */
  function drawBuy() {
    const wrap = h('div', 'mkt-pane');
    // 장바구니
    const cb = h('section', 'mkt-cart'); cb.dataset.mktCart = '';
    cb.append(h('p', 'panel-label', `장바구니 ${cart.size ? `· ${cart.size}종` : ''}`));
    if (!cart.size) cb.append(h('p', 'panel-fine', '아래에서 개수를 정하고 [담기]를 누르면 여기에 모인다. 여러 물건을 한 번에 산다.'));
    else {
      const ul = h('ul', 'mkt-list');
      for (const [id, q] of cart) {
        const e = estimate(id, q); const li = h('li', 'mkt-row');
        li.append(h('b', '', nameOf(id)), h('span', '', `×${q}`), h('em', '', `${e.cost}냥`), btn('mkt-x', '빼기', () => { cart.delete(id); draw(); }));
        ul.append(li);
      }
      const total = cartTotal(), money = Math.floor(api()?.player?.money || 0);
      const buy = btn('solid-btn mkt-go', `모두 사기 · ${total}냥`, () => buyAll());
      buy.dataset.mktBuy = ''; buy.disabled = busy || total > money;
      cb.append(ul, h('p', `mkt-sum${total > money ? ' bad' : ''}`, total > money ? `냥이 ${total - money} 모자라다.` : `산 뒤 주머니 ${money - total}냥`), buy);
    }
    wrap.append(cb);
    // 매물
    const search = h('input', 'mkt-search'); search.placeholder = '물건 이름으로 찾기'; search.value = filter;
    search.addEventListener('input', () => { filter = search.value; const list = wrap.querySelector('.mkt-goods'); list?.replaceWith(goods()); });
    wrap.append(search, goods());
    return wrap;
  }
  function goods() {
    const ul = h('ul', 'mkt-list mkt-goods');
    const rows = data.items.filter((x) => !filter || nameOf(x.item).includes(filter.trim()));
    if (!rows.length) { ul.append(h('li', 'panel-fine', data.items.length ? '찾는 물건이 없다.' : '지금 올라온 물건이 없다.')); return ul; }
    for (const it of rows.sort((a, b) => nameOf(a.item).localeCompare(nameOf(b.item), 'ko'))) {
      const li = h('li', 'mkt-row mkt-good'); li.dataset.mktItem = it.item;
      const info = api()?.itemInfo?.(it.item);
      const name = h('div', 'mkt-name'); name.append(h('b', '', nameOf(it.item)), h('small', '', (info?.effectText || info?.desc || '').slice(0, 70)));
      const levels = it.levels.slice(0, 3).map(([pr, n]) => `${pr}냥×${n}`).join(' · ') + (it.levels.length > 3 ? ' …' : '');
      const inCart = cart.get(it.item) || 0;
      const qty = h('input', 'mkt-num'); qty.type = 'number'; qty.min = '1'; qty.max = String(it.qty); qty.value = '1'; qty.setAttribute('aria-label', '살 개수');
      const add = btn('ghost-btn mkt-add', inCart ? `더 담기 (${inCart})` : '담기', () => {
        const q = Math.min(it.qty, inCart + int(qty.value, 1, QTY_MAX));
        if (cart.size >= LIST_MAX && !cart.has(it.item)) { toast('벼룩시장', `장바구니에는 ${LIST_MAX}종까지 담는다.`); return; }
        cart.set(it.item, q); draw();
      });
      li.append(name, h('span', 'mkt-price', `최저 ${it.min}냥 · ${it.qty}개`), h('span', 'mkt-levels', levels), qty, add);
      ul.append(li);
    }
    return ul;
  }
  async function buyAll() {
    const a = api(); if (!a || busy || !cart.size) return;
    const lines = [...cart].map(([item, qty]) => ({ item, qty }));
    const total = cartTotal(), items = Object.fromEntries(lines.map((l) => [l.item, estimate(l.item, l.qty).qty]));
    if (total > Math.floor(a.player.money || 0)) { toast('벼룩시장', '냥이 모자라다.'); return; }
    if (a.canAdd && !a.canAdd(items)) { toast('벼룩시장', '소지품이 가득 찬다. 정리한 뒤에 사 줘.'); return; }
    if (!a.giveAway({ money: total })) { toast('벼룩시장', '냥이 모자라다.'); return; }
    busy = true; draw();
    try {
      const r = await call('bry_market_buy', { p_cart: lines, p_paid: total });
      const got = Object.entries(r.items || {}).map(([id, n]) => `${nameOf(id)} ×${n}`).join(' · ');
      const short = Object.entries(r.short || {}).map(([id, n]) => `${nameOf(id)} ${n}개`).join(' · ');
      a.grant({ log: `[벼룩시장] ${r.cost}냥에 샀다 — ${got}` });
      toast('벼룩시장', `${r.cost}냥에 샀다 — ${got}${short ? ` (모자라 못 산 것: ${short})` : ''}. 곧 소지품에 들어온다.`);
      cart.clear(); Auth.pushSave?.(); App.renderStatus?.();
      window.BiryeongServer?.poll?.(); // 산 물건 · 거스름돈은 우편으로 — 곧바로 받는다
    } catch (e) {
      a.grant({ money: total, log: '[벼룩시장] 사지 못해 냥을 되돌려 받았다.' });
      toast('벼룩시장', errText(e)); App.renderStatus?.();
    } finally { busy = false; await load(); }
  }

  /* ───────── 팔기 ───────── */
  function tradable() {
    const a = api(); const p = a?.player; if (!p) return [];
    const eq = new Set(a.equippedIds?.() || []);
    return Object.entries(p.inventory || {})
      .filter(([id, n]) => n > 0 && !id.includes('#') && !eq.has(id) && /^[a-z0-9][a-z0-9-]{0,47}$/.test(id))
      .map(([id, n]) => ({ id, n, info: a.itemInfo?.(id) }))
      .filter((x) => x.info && !x.info.story)
      .sort((x, y) => x.info.name.localeCompare(y.info.name, 'ko'));
  }
  function drawSell() {
    const wrap = h('div', 'mkt-pane');
    const sb = h('section', 'mkt-cart'); sb.dataset.mktStaged = '';
    sb.append(h('p', 'panel-label', `올릴 목록 ${staged.size ? `· ${staged.size}종` : ''}`));
    if (!staged.size) sb.append(h('p', 'panel-fine', '아래에서 개수와 한 개 값을 정해 [목록에 담기] — 여러 물건을 한 번에 올린다. 올리는 순간 소지품에서 빠지고, 거두면 우편으로 돌아온다.'));
    else {
      const ul = h('ul', 'mkt-list');
      for (const [id, s] of staged) {
        const li = h('li', 'mkt-row');
        li.append(h('b', '', nameOf(id)), h('span', '', `×${s.qty}`), h('em', '', `한 개 ${s.price}냥 · 다 팔리면 ${s.qty * s.price}냥`), btn('mkt-x', '빼기', () => { staged.delete(id); draw(); }));
        ul.append(li);
      }
      const go = btn('solid-btn mkt-go', '한 번에 올리기', () => postAll()); go.dataset.mktPost = ''; go.disabled = busy;
      sb.append(ul, go);
    }
    wrap.append(sb);
    const rows = tradable();
    const ul = h('ul', 'mkt-list mkt-goods');
    if (!rows.length) ul.append(h('li', 'panel-fine', '올릴 수 있는 물건이 없다(장착한 것 · 강화한 무구 · 본편 물건은 올릴 수 없다).'));
    for (const { id, n, info } of rows) {
      const left = n - (staged.get(id)?.qty || 0); if (left <= 0) continue;
      const li = h('li', 'mkt-row mkt-good'); li.dataset.mktSell = id;
      const mk = data.items.find((x) => x.item === id);
      const name = h('div', 'mkt-name'); name.append(h('b', '', info.name), h('small', '', `가진 수 ${n} · 시세 ${mk ? `최저 ${mk.min}냥 (${mk.qty}개 올라와 있다)` : '올라온 것 없음'}`));
      const qty = h('input', 'mkt-num'); qty.type = 'number'; qty.min = '1'; qty.max = String(Math.min(left, QTY_MAX)); qty.value = '1'; qty.setAttribute('aria-label', '올릴 개수');
      const price = h('input', 'mkt-num mkt-pricein'); price.type = 'number'; price.min = '1'; price.max = String(PRICE_MAX);
      price.value = String(mk?.min || (info.price ? Math.max(1, Math.round(info.price * 0.8)) : 10)); price.setAttribute('aria-label', '한 개 값(냥)');
      const add = btn('ghost-btn mkt-add', '목록에 담기', () => {
        if (staged.size >= LIST_MAX && !staged.has(id)) { toast('벼룩시장', `한 번에 ${LIST_MAX}종까지 올린다.`); return; }
        const q = int(qty.value, 1, Math.min(left, QTY_MAX)), pr = int(price.value, 1, PRICE_MAX);
        const cur = staged.get(id);
        staged.set(id, { qty: Math.min(n, (cur?.qty || 0) + q), price: pr }); draw();
      });
      const pl = h('label', 'mkt-pricebox'); pl.append(price, h('span', '', '냥'));
      li.append(name, qty, pl, add);
      ul.append(li);
    }
    wrap.append(ul);
    return wrap;
  }
  async function postAll() {
    const a = api(); if (!a || busy || !staged.size) return;
    const list = [...staged].map(([item, s]) => ({ item, qty: s.qty, price: s.price }));
    const items = Object.fromEntries(list.map((x) => [x.item, x.qty]));
    if (!a.giveAway({ items })) { toast('벼룩시장', '소지품이 바뀌었다(장착했거나 모자라다). 목록을 다시 확인해 줘.'); staged.clear(); draw(); return; }
    busy = true; draw();
    try {
      await call('bry_market_post', { p_items: list });
      a.grant({ log: `[벼룩시장] 올렸다 — ${list.map((x) => `${nameOf(x.item)} ×${x.qty} (${x.price}냥)`).join(' · ')}` });
      toast('벼룩시장', `${list.length}종을 올렸다. 팔리면 냥이 우편으로 들어온다.`);
      staged.clear(); Auth.pushSave?.(); App.renderStatus?.(); tab = 'mine';
    } catch (e) {
      a.grant({ items, log: '[벼룩시장] 올리지 못해 물건을 되돌려 받았다.' });
      toast('벼룩시장', errText(e));
    } finally { busy = false; await load(); }
  }

  /* ───────── 내 매물 ───────── */
  function drawMine() {
    const wrap = h('div', 'mkt-pane');
    wrap.append(h('p', 'panel-fine', '내가 올려 둔 물건. 남은 수만 보인다 — 팔린 만큼의 냥은 우편으로 이미 들어갔거나 곧 들어온다. [거두기]를 누르면 남은 물건이 우편으로 돌아온다.'));
    const ul = h('ul', 'mkt-list');
    if (!data.mine.length) ul.append(h('li', 'panel-fine', '올려 둔 물건이 없다.'));
    for (const m of data.mine) {
      const li = h('li', 'mkt-row'); li.dataset.mktMine = String(m.id);
      const back = btn('ghost-btn mkt-add', '거두기', async () => {
        if (busy) return; busy = true; back.disabled = true;
        try { await call('bry_market_cancel', { p_id: m.id }); toast('벼룩시장', `${nameOf(m.item)} ×${m.qty}을(를) 거뒀다. 곧 소지품에 돌아온다.`); window.BiryeongServer?.poll?.(); }
        catch (e) { toast('벼룩시장', errText(e)); }
        finally { busy = false; await load(); }
      });
      li.append(h('b', '', nameOf(m.item)), h('span', '', `남은 ${m.qty}개`), h('em', '', `한 개 ${m.price}냥`), back);
      ul.append(li);
    }
    wrap.append(ul);
    return wrap;
  }

  window.BiryeongMarket = { render, reload: load };
})();
