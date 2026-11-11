// 비령 vault — 초록동색 온라인 모듈(net/online.js) 자리의 '연결 안 됨' 어댑터.
// 초록동색 서버(채팅 · 파티 · 장터 · 우편 · 랭킹 · 다인 전투 · 판놀이 등)와는 연결하지 않는다.
// 이 파일은 같은 이름의 함수를 모두 내보내되, 네트워크 호출 없이 '서버 없음' 결과만 돌려준다.
// 비령 서버에 붙일 때는 이 파일만 비령 API 로 다시 쓰면 화면 코드는 그대로 쓸 수 있다.
import { useSyncExternalStore } from 'react'

const OFFLINE_STATE = Object.freeze( {
  status: 'offline', // offline | connecting | online
  me: null, // { id, name }
  online: [], // [{ id, name, partyId }]
  history: { rp: [], talk: [], party: [] },
  unread: { rp: 0, talk: 0, party: 0 },
  party: null, // { id, members: [{ id, name, online }] }
  invite: null, // { from: { id, name } }
  notices: [], // [{ id, text }]
  mb: null, // 진행 중인 다인 전투 { bid, view }
  mbInvite: null, // { bid, from, enemy, expires } — 다인 전투 초대를 받았다
  mbLobby: null, // { bid, enemyId, waiting, joined } — 내가 건 다인 전투에서 응답을 기다리는 중
  mailUnread: 0, // 사물함에서 아직 안 읽은 쪽지 · 선물 수
  mailTick: 0, // 새 쪽지가 올 때마다 +1 (열려 있는 사물함이 다시 불러오는 신호)
  bgmPlaylist: [], // 관리자가 올린 배경음악(평소 곡) 재생목록: [{ id: 유튜브 영상ID, title }]. 비어 있으면 로컬 mp3.
  editReq: null, // 관리자의 스탯 · 디버프 수정 요청(동의 대기) { rid, adminName, changes, expires }
  editResult: null, // 내가 관리자일 때 받은 결과 { rid, status, targetName }
  club: null, // 내가 속한 동아리 { id, joinedAt, log: [...] } (없으면 null)
  omok: null, // 진행 중인 오목 { gid, size, board, turn, players, winner, win }
  omokInvite: null, // { from: { id, name } } — 오목 신청을 받았다
  yut: null, // 진행 중인 윷놀이 { gid, players, pieces, left, turn, phase, throws, pendingBranch, lastRoll, winner, log }
  yutInvite: null, // { lid, from: { id, name } } — 윷놀이 신청을 받았다
  yutLobby: null, // { lid, waiting: [names] } — 내가 건 윷놀이 신청에서 응답을 기다리는 중
  rummi: null, // 진행 중인 루미큐브 { gid, players, counts, hand, poolLeft, table, turn, hasPlayed, firstMeld, left, winner, log }
  rummiInvite: null, // { lid, from: { id, name } } — 루미큐브 신청을 받았다
  rummiLobby: null, // { lid, waiting: [names] } — 내가 건 루미큐브 신청에서 응답을 기다리는 중
  yacht: null, // 진행 중인 요트 다이스 { gid, players, scorecards, dice, rollsLeft, turn, left, winner, tie, log }
  yachtInvite: null, // { lid, from: { id, name } } — 요트 다이스 신청을 받았다
  yachtLobby: null, // { lid, waiting: [names] } — 내가 건 요트 다이스 신청에서 응답을 기다리는 중
})

const NOT_CONNECTED = { ok: false, error: 'not-connected', message: '비령 서버 어댑터가 아직 연결되지 않았다.' }
const notConnected = () => async () => NOT_CONNECTED
const noop = () => {}
const subscribe = () => () => {}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => OFFLINE_STATE)
}
export const MAIL_MAX = 1000
export const notify = noop
export const onGift = () => noop
export const onMarketSold = () => noop
export const connect = noop
export const disconnect = noop
export const setActiveChannel = noop
export const dismissNotice = noop
export const clearEditResult = noop
export const closeOmok = noop
export const closeYut = noop
export const closeRummi = noop
export const closeYacht = noop
export const mbClose = noop
export const sendChat = notConnected()
export const fetchFriends = notConnected()
export const respondFriendRequest = notConnected()
export const changeFriend = notConnected()
export const inviteToParty = notConnected()
export const respondInvite = notConnected()
export const sendGift = notConnected()
export const sendNote = notConnected()
export const fetchMailbox = notConnected()
export const markMailRead = notConnected()
export const fetchMailPeople = notConnected()
export const fetchAllMail = notConnected()
export const requestEdit = notConnected()
export const respondEdit = notConnected()
export const applyClub = notConnected()
export const leaveClub = notConnected()
export const fetchClubMembers = notConnected()
export const fetchStudents = notConnected()
export const sendClubChat = notConnected()
export const inviteOmok = notConnected()
export const respondOmok = notConnected()
export const moveOmok = notConnected()
export const resignOmok = notConnected()
export const inviteYut = notConnected()
export const respondYut = notConnected()
export const rollYutDice = notConnected()
export const applyYutThrow = notConnected()
export const chooseYutBranch = notConnected()
export const resignYut = notConnected()
export const inviteRummi = notConnected()
export const respondRummi = notConnected()
export const commitRummi = notConnected()
export const endRummiTurn = notConnected()
export const resignRummi = notConnected()
export const inviteYacht = notConnected()
export const respondYacht = notConnected()
export const rollYacht = notConnected()
export const scoreYacht = notConnected()
export const resignYacht = notConnected()
export const marketFetch = notConnected()
export const marketList = notConnected()
export const marketBuy = notConnected()
export const marketCancel = notConnected()
export const marketClaim = notConnected()
export const getVerifiedEconomyStatus = notConnected()
export const getVerifiedWallet = notConnected()
export const getVerifiedMarket = notConnected()
export const verifiedEconomyAction = notConnected()
export const leaveParty = notConnected()
export const disbandParty = notConnected()
export const sendPartyStats = notConnected()
export const mbStart = notConnected()
export const mbRespond = notConnected()
export const mbCancel = notConnected()
export const mbAct = notConnected()
export const mbSurvive = notConnected()
export const mbItem = notConnected()
export const mbFlee = notConnected()
export const sendCard = notConnected()
export const fetchCard = notConnected()
export const fetchRanking = notConnected()
export const startRankedSession = notConnected()
export const submitScore = notConnected()
export const verifyAdminKey = notConnected()
export const fetchBgmPlaylist = notConnected()
export const adminSetBgmPlaylist = notConnected()
export const adminSetChatTitle = notConnected()
export const fetchMembers = notConnected()
export const fetchNewspaper = notConnected()
export const submitStory = notConnected()
export const fetchPendingStories = notConnected()
export const publishStory = notConnected()
export const rejectStory = notConnected()
