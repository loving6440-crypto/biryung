/** D.06.7a: worksheet purchase prices vs live source export + the shipped prebuilt browser bundle */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const sheet = JSON.parse(readFileSync(join(root, 'systems/data/user-updated-workbook.json'), 'utf8'))['아이템'];
const purchase = new Map(sheet.filter((x) => typeof x['5'] === 'number').map((x) => [x.id, x['5']]));
const r = spawnSync(process.execPath, [join(root, 'systems/sheets/export.mjs')], {encoding:'utf8', cwd:root, maxBuffer:32*1024*1024});
if (r.status !== 0) throw new Error(r.stderr || 'export failed');
const actual = new Map(JSON.parse(r.stdout).items.map((x) => [x.id, x.price]));
for (const [id, price] of purchase) if (actual.get(id) !== price) throw new Error(`Export mismatch ${id}: sheet ${price}, runtime ${actual.get(id)}`);
const js = readFileSync(join(root, 'play/play.js'),'utf8');
const m = js.match(/\b[A-Za-z_$][\w$]*=\{picnic:(\d+)(,chocolate:\d+[^}]*\})/);
if (!m) throw new Error('Browser retail map not detected');
const map = 'picnic:'+m[1]+m[2];
for (const id of ['picnic','chocolate','st-tangerine','st-seaweed']) {
  const key = /^[a-zA-Z_$][\w$]*$/.test(id) ? id : `"${id}"`;
  if (!map.includes(`${key}:${purchase.get(id)}`)) throw new Error(`Browser UI price differs for ${id}`);
}
if (!js.includes(`"friendship-letter":{price:${purchase.get('friendship-letter')},kind:"tool"`)) throw new Error('Browser UI friendship-letter price differs');
console.log(`가격 검증 통과: 시트 구매가격 ${purchase.size}개 / 게임 데이터 ${purchase.size}개 / 변경된 정적 매점가격 5개`);
