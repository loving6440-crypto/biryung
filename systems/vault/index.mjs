/**
 * 秘靈 · 비령 — 초록동색 C.01 콘텐츠 보관고 진입점 (코드에서 쓸 때).
 *
 *   import * as Vault from './systems/vault/index.mjs'
 *   Vault.bundles()                         // 꺼내기 묶음
 *   Vault.entry('game/items')               // 파일 정보
 *   Vault.catalog('game/items').ITEMS       // 게임 데이터(JSON)
 *   await Vault.load('game/battle')         // 게임 규칙 모듈을 그대로 import (Node 에서 되는 것만)
 *
 * 비령 화면 · 서버와는 아직 연결하지 않았다. 필요할 때 여기서 꺼내 쓴다.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const VAULT = dirname(fileURLToPath(import.meta.url))
export const manifest = JSON.parse(readFileSync(join(VAULT, 'manifest.json'), 'utf8'))
const byId = Object.fromEntries(manifest.entries.map((e) => [e.id, e]))

export const entries = () => manifest.entries
export const entry = (id) => byId[id] ?? null
export const bundles = () => manifest.bundles
export const pathOf = (id) => (byId[id] ? join(VAULT, byId[id].path) : null)

/** 게임 데이터(카탈로그 JSON)의 exports 객체 */
export function catalog(id) {
  const e = byId[id]
  if (!e?.catalog) throw new Error(`${id}: 데이터 카탈로그가 없다`)
  return JSON.parse(readFileSync(join(VAULT, e.catalog), 'utf8')).exports
}

/** 게임 규칙 모듈 import (react 등이 필요 없는 game-logic 만) */
export async function load(id) {
  const e = byId[id]
  if (!e) throw new Error(`없는 id: ${id}`)
  if (e.kind !== 'game-logic' || !e.nodeImportable) throw new Error(`${id}: Node 에서 바로 불러오는 모듈이 아니다 (화면 코드 · react 필요)`)
  return import(pathToFileURL(join(VAULT, e.path)).href)
}
