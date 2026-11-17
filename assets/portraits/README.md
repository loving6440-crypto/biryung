# 얼굴 그림(프사) 넣는 자리

대사 창의 얼굴 칸은 이렇게 나온다.

- **메인 인물(윤진서 · 연호수 · △△ · 비 · 서창현)** — 그림 자리. 아래처럼 적어 두면 그 인물의 대사마다 저절로 붙는다. 적지 않으면 빈 액자로 나온다.
- **비령** — 한자 「秘靈」.
- **그 밖의 인물(엑스트라)** — 글자 없는 단색 원. 인물마다 색이 다르다.

## 넣는 법

1. 그림 파일을 이 폴더(`assets/portraits/`)에 올린다. 정사각형(256×256 이상 권장)이면 액자 안에 꽉 차게 잘린다.
2. `config.js` 의 `BIRYEONG_PORTRAITS` 에 「화자 이름: 파일 주소」를 적는다.

```js
window.BIRYEONG_PORTRAITS = {
  '윤진서': 'assets/portraits/jinseo.png',
  '연호수': 'assets/portraits/hosu.png',
  '△△':    'assets/portraits/god.png',      // 플레이어가 이름을 지어 주는 신
  '비':     'assets/portraits/bi.png',        // 「해원」으로 나오는 대사에도 같이 붙는다
  '서창현': 'assets/portraits/changhyeon.png',
};
```

- 엑스트라에게도 그림을 주고 싶으면 같은 식으로 화자 이름 그대로 적으면 된다(예: `'생활관 사감': 'assets/portraits/extra-dorm.png'`).
- 엑스트라의 색은 `quest.js` 의 `TONES`(자동 배정) · `FIXED_TONE`(이름을 정해 고정)에서 바꾼다.
