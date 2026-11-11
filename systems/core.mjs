/** 秘靈 · 비령 — 독립형 전투·개척 규칙 모듈.
 *  시스템 로직은 과거 초록동색 C.01에서 복사한 독립 스냅샷이며,
 *  상대 게임의 서버, API, DB, 인증, 저장소에 대한 import/접속이 없다.
 *  현재 사이트 UI 또는 백엔드 API에 아직 연결되지 않았다.
 */
export { STAT_KEYS, STAT_META, STAT_MIN, STAT_START_POINTS, HP_MAX, MP_MAX } from './rules/constants.js';
export * as SoloBattle from './rules/battle.js';
export * as PartyBattle from './rules/mbattle.js';
export * as Pioneer from './rules/huntField.js';
export * as PioneerSites from './rules/huntSites.js';
export * as StatCalculator from './rules/statCalc.js';
export * as Equipment from './rules/items.js';
export * as BossSlots from './rules/bossSlots.js';
export * as PioneerSaveMigration from './rules/huntMigration.js';
export * as VerifiedPioneer from './rules/verifiedExpeditionRules.js';
export * as VerifiedEconomyRules from './rules/verifiedEconomyRules.js';
export * as Data from './data/index.mjs';
