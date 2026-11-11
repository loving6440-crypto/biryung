/**
 * 비령 v0.3 — 비령 독립형 게임 데이터 진입점.
 * 원본 데이터 ID/수치 변경 없음. UI에서 아직 import하지 않음.
 */
export { ITEMS, STORE_ITEMS, EQUIP_SLOTS, DEFAULT_EQUIP, itemOf, ENH_MAX, ENH_ITEMS } from '../rules/items.js'
export { ENEMIES, BESTIARY_ENEMIES, ALL_ENEMIES, enemyById, PSYCHICS, PASSIVE_PSYCHICS, ownedPsychics, ownedPassives } from '../rules/battle.js'
export { STAT_KEYS, STAT_META, STAT_MIN, STAT_MAX, STAT_START_POINTS } from '../rules/constants.js'
export { HUNT_SITES, HUNT_PATHS, HUNT_SPECIES, HUNT_KINDS, HUNT_ATTEMPTS } from '../rules/huntSites.js'
export { TRAILS, TRAIL_SPECIES } from '../rules/huntTrails.js'
export { RECIPES, WORKSHOP } from '../rules/crafting.js'
export { B08_RECIPES, B08_COOK_RECIPES } from '../rules/recipesB08.js'
export { B16_ITEM_EFFECTS } from '../rules/itemEffectsB16.js'
export { V79_ITEMS } from '../rules/v79Items.js'
export { V79_SHEET_DATA } from '../rules/v79SheetData.js'
