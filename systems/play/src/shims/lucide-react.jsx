// 비령 play — lucide-react 대체 모듈.
// 원래 초록동색 화면은 lucide-react 아이콘을 썼다. 비령 저장소에는 그 패키지를 두지 않으므로,
// 같은 이름의 작은 아이콘 컴포넌트를 여기서 만든다. 선 아이콘(화살표 · 더하기 등)은 직접 그리고,
// 나머지는 뜻이 비슷한 글자 하나를 같은 크기의 칸에 그린다. 화면 코드는 고치지 않아도 된다.
// 새 아이콘이 필요하면 아래 GLYPH 또는 PATHS 에 한 줄 더하면 된다(없는 이름은 ◆ 로 보인다).
import { forwardRef } from 'react'

const PATHS = {
  X: 'M6 6l12 12M18 6L6 18',
  Plus: 'M12 5v14M5 12h14',
  Minus: 'M5 12h14',
  Check: 'M5 12.5l4.5 4.5L19 7',
  ArrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  ArrowRight: 'M5 12h14M13 6l6 6-6 6',
  ArrowUp: 'M12 19V5M6 11l6-6 6 6',
  ArrowDown: 'M12 5v14M6 13l6 6 6-6',
  ChevronLeft: 'M15 6l-6 6 6 6',
  ChevronRight: 'M9 6l6 6-6 6',
  ChevronsDown: 'M7 6l5 5 5-5M7 13l5 5 5-5',
  Square: 'M5 5h14v14H5z',
  Pause: 'M8 5v14M16 5v14',
  Play: 'M7 5l12 7-12 7z',
  Search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  RotateCcw: 'M4 4v6h6M4.5 10A8 8 0 1 1 6 16.5',
  RotateCw: 'M20 4v6h-6M19.5 10A8 8 0 1 0 18 16.5',
  RefreshCw: 'M20 5v5h-5M4 19v-5h5M18.5 10A7 7 0 0 0 6 7.5M5.5 14A7 7 0 0 0 18 16.5',
  CheckCircle2: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6',
  Grid3x3: 'M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16',
  Upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  LogOut: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  Send: 'M4 12l16-8-6 16-3-7z',
  Pencil: 'M15 5l4 4L8 20H4v-4z',
  Mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  Lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  Heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  Zap: 'M13 3L5 13h6l-1 8 8-10h-6z',
  Clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  Eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  Volume2: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  Trash2: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  Flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  Moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  Sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  Users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
  ZoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20M10.5 8v5M8 10.5h5',
}
const GLYPH = {
  Archive: '箱', Backpack: '囊', BedDouble: '寢', BookMarked: '冊', BookOpen: '書', BookOpenText: '書', Brain: '腦', Candy: '飴',
  ClipboardList: '錄', Coins: '錢', Compass: '羅', CookingPot: '釜', Dice5: '⚄', Dices: '⚅', Flame: '火', Footprints: '步', Gift: '贈',
  GraduationCap: '學', Hammer: '鎚', Hourglass: '⧗', KeyRound: '鍵', Languages: '言', Layers: '層', Map: '圖', MessageCircle: '話',
  Mountain: '山', Music: '♪', Newspaper: '報', Palette: '彩', PawPrint: '獸', Scale: '衡', ScrollText: '卷', Settings2: '設',
  Shield: '盾', ShoppingBag: '賣', Signpost: '標', Sparkles: '✦', Sprout: '芽', Store: '店', Swords: '⚔', Trophy: '盃', Type: '字',
  UserPlus: '友', UserRoundPlus: '友', UserRoundX: '絶', UsersRound: '衆', Utensils: '食', Warehouse: '庫', Wind: '風',
}

function makeIcon(name) {
  const Icon = forwardRef(function Icon({ size = 24, color = 'currentColor', strokeWidth = 2, className = '', absoluteStrokeWidth: _a, ...rest }, ref) {
    const d = PATHS[name]
    const common = { ref, width: size, height: size, viewBox: '0 0 24 24', className: `lucide lucide-${name.toLowerCase()} ${className}`.trim(), 'aria-hidden': rest['aria-label'] ? undefined : true, ...rest }
    if (d) return <svg {...common} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    return (
      <svg {...common} fill={color}>
        <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="17" fontFamily="'Noto Serif KR','Noto Sans KR',serif">{GLYPH[name] ?? '◆'}</text>
      </svg>
    )
  })
  Icon.displayName = name
  return Icon
}

export const ICON_NAMES = [...new Set([...Object.keys(PATHS), ...Object.keys(GLYPH)])]

export const Archive = makeIcon('Archive')
export const ArrowDown = makeIcon('ArrowDown')
export const ArrowLeft = makeIcon('ArrowLeft')
export const ArrowRight = makeIcon('ArrowRight')
export const ArrowUp = makeIcon('ArrowUp')
export const Backpack = makeIcon('Backpack')
export const BedDouble = makeIcon('BedDouble')
export const BookMarked = makeIcon('BookMarked')
export const BookOpen = makeIcon('BookOpen')
export const BookOpenText = makeIcon('BookOpenText')
export const Brain = makeIcon('Brain')
export const Candy = makeIcon('Candy')
export const Check = makeIcon('Check')
export const CheckCircle2 = makeIcon('CheckCircle2')
export const ChevronLeft = makeIcon('ChevronLeft')
export const ChevronRight = makeIcon('ChevronRight')
export const ChevronsDown = makeIcon('ChevronsDown')
export const ClipboardList = makeIcon('ClipboardList')
export const Clock = makeIcon('Clock')
export const Coins = makeIcon('Coins')
export const Compass = makeIcon('Compass')
export const CookingPot = makeIcon('CookingPot')
export const Dice5 = makeIcon('Dice5')
export const Dices = makeIcon('Dices')
export const Eye = makeIcon('Eye')
export const Flag = makeIcon('Flag')
export const Flame = makeIcon('Flame')
export const Footprints = makeIcon('Footprints')
export const Gift = makeIcon('Gift')
export const GraduationCap = makeIcon('GraduationCap')
export const Grid3x3 = makeIcon('Grid3x3')
export const Hammer = makeIcon('Hammer')
export const Heart = makeIcon('Heart')
export const Hourglass = makeIcon('Hourglass')
export const KeyRound = makeIcon('KeyRound')
export const Languages = makeIcon('Languages')
export const Layers = makeIcon('Layers')
export const Lock = makeIcon('Lock')
export const LogOut = makeIcon('LogOut')
export const Mail = makeIcon('Mail')
export const Map = makeIcon('Map')
export const MessageCircle = makeIcon('MessageCircle')
export const Minus = makeIcon('Minus')
export const Moon = makeIcon('Moon')
export const Mountain = makeIcon('Mountain')
export const Music = makeIcon('Music')
export const Newspaper = makeIcon('Newspaper')
export const Palette = makeIcon('Palette')
export const Pause = makeIcon('Pause')
export const PawPrint = makeIcon('PawPrint')
export const Pencil = makeIcon('Pencil')
export const Play = makeIcon('Play')
export const Plus = makeIcon('Plus')
export const RefreshCw = makeIcon('RefreshCw')
export const RotateCcw = makeIcon('RotateCcw')
export const RotateCw = makeIcon('RotateCw')
export const Scale = makeIcon('Scale')
export const ScrollText = makeIcon('ScrollText')
export const Search = makeIcon('Search')
export const Send = makeIcon('Send')
export const Settings2 = makeIcon('Settings2')
export const Shield = makeIcon('Shield')
export const ShoppingBag = makeIcon('ShoppingBag')
export const Signpost = makeIcon('Signpost')
export const Sparkles = makeIcon('Sparkles')
export const Sprout = makeIcon('Sprout')
export const Square = makeIcon('Square')
export const Store = makeIcon('Store')
export const Sun = makeIcon('Sun')
export const Swords = makeIcon('Swords')
export const Trash2 = makeIcon('Trash2')
export const Trophy = makeIcon('Trophy')
export const Type = makeIcon('Type')
export const Upload = makeIcon('Upload')
export const UserPlus = makeIcon('UserPlus')
export const UserRoundPlus = makeIcon('UserRoundPlus')
export const UserRoundX = makeIcon('UserRoundX')
export const Users = makeIcon('Users')
export const UsersRound = makeIcon('UsersRound')
export const Utensils = makeIcon('Utensils')
export const Volume2 = makeIcon('Volume2')
export const Warehouse = makeIcon('Warehouse')
export const Wind = makeIcon('Wind')
export const X = makeIcon('X')
export const Zap = makeIcon('Zap')
export const ZoomIn = makeIcon('ZoomIn')
