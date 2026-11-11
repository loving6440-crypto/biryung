// 무구보관소 (산 탐사) — 무구 강화 장소와 NPC 자리(armorySmith)
import { NPC_SLOTS } from './npcSlots.js'
export const ARMORY = {
  id: 'armory',
  label: '무구보관소',
  desc:
    '학교가 수시로 철통같이 감시하고 있는 무구들의 창고(어떻게 감시하길래 누가 몰래 들어갈 때마다 귀신같이 알아채는지는 아무도 모른다). 자신이 정식으로 학교에 승인을 받은 무구가 아니면 사용할 수 없는 것이 원칙이지만, 날을 갈고 무기를 꾸미는 정도의 행동은 자유롭게 할 수 있도록 허락되어 있다.',
}
// 무구 강화 담당 NPC 자리(빈 자리). 초록동색 NPC 는 옮기지 않았다 → npcSlots.js 의 armorySmith 를 채우면 된다.
export const ARMORY_KEEPER = NPC_SLOTS.armorySmith

/** 방문/대화 시 선택되는 일반 대사. RNG 주입으로 테스트 가능. */
export function pickArmoryKeeperLine(rng = Math.random) {
  const lines = ARMORY_KEEPER.lines ?? []
  if (!lines.length) return null
  return lines[Math.min(lines.length - 1, Math.max(0, Math.floor(rng() * lines.length)))].text
}

/** 선물 후 호감도에 따라 해금되는 대사 중 가장 높은 단계의 반응. */
export function armoryKeeperGiftLine(affinity) {
  return [...(ARMORY_KEEPER.giftLines ?? [])].reverse().find(line => affinity >= line.minAffinity)?.text ?? null
}
