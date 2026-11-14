# 초상(포트레잇) 넣는 자리

대사 창의 인물 칸은 금색 액자 안에 **머리색 단색 인장**으로 채워져 있다. 그림이 생기면 여기에 넣고 `config.js` 에 적는다.

```js
window.BIRYEONG_PORTRAITS = {
  '서창현': 'assets/portraits/changhyeon.png',
  '윤진서': 'assets/portraits/jinseo.png',
  '비':     'assets/portraits/bi.png',
  '△△':    'assets/portraits/god.png',      // 플레이어가 이름을 지어 주는 신
  '연호수': 'assets/portraits/hosu.png',
  '비령':   'assets/portraits/biryeong.png',
  'PC':     'assets/portraits/pc.png',
  '생활관 사감': 'assets/portraits/extra-dorm.png',   // 엑스트라는 화자 이름 그대로
};
```

- 정사각형(권장 256×256 이상). 액자 안쪽에 꽉 차게 잘린다.
- 적지 않은 인물은 계속 인장으로 나온다. 인장 색은 `quest.js` 의 `CAST`(머리색)에서 바꾼다.
