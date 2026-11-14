// 도트 자료(틀 · 색 · 아이템별 배정)를 render_icons.py 가 읽을 JSON 으로 내보낸다.
const R = await import('../biryeong/reskin.data.js')
console.log(JSON.stringify({ ITEM_PIXELS: R.ITEM_PIXELS, PIXEL_PALETTES: R.PIXEL_PALETTES, PIXEL_TEMPLATES: R.PIXEL_TEMPLATES }))
