// 사당 문지기 NPC 자리(빈 자리). 초록동색 NPC 는 옮기지 않았다 → npcSlots.js 의 shrineKeeper 를 채우면 된다.
// 이 자리에서 쓰는 글: name · portrait · intro(대화 활동 설명) · button(버튼 글) · appear(마주쳤을 때 지문) · codex · lines
import { NPC_SLOTS } from './npcSlots.js'
export const SHRINE_KEEPER = NPC_SLOTS.shrineKeeper
if (!SHRINE_KEEPER.button) SHRINE_KEEPER.button = '문지기와 대화한다'
if (!SHRINE_KEEPER.intro) SHRINE_KEEPER.intro = ''
