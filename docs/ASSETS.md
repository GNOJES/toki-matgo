# 화투 에셋

## 기본 화투 48장

사용자가 지정한 [Marcus Richert의 Set of Hwatu](https://www.marcusrichert.com/images/hwatu/)를 사용한다. 2021-02-22 공개, Louie Mantia, Jr.의 Hanafuda 그림을 바탕으로 한국 화투에 맞게 색상과 일부 선을 수정한 디자인이다. 라이선스는 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

- 원본 SVG: `assets/hwatu/hwatu-source.svg`. 공개 SVG를 브라우저의 SVG DOM에서 직렬화한 파일이며 그림의 경로·색상은 그대로다.
- 게임용: `public/cards/m1-0.webp` ~ `m12-3.webp`, 256×417 무손실 WebP 48장. 원본 카드 영역을 분할하고 투명 영역을 흰색으로 합성해 축소·변환했다. 그림을 다시 그리거나 월 숫자·추가 표식을 덧붙이지 않았다.
- 재생성: `npm run assets`. 원본은 저장소에 포함되므로 작가 사이트에 접속할 필요가 없다. `sharp`를 이용한다.
- 대응표: `assets/hwatu/mapping.json`. 엔진 ID, 원본 PNG 이름, SVG 시트의 월/영역, 원본 SHA-256을 기록한다.

원본 SVG 시트는 일본식 순서인 11번째 버들/비, 12번째 오동이다. 엔진의 한국식 11월 오동·12월 비에 맞춰 교환한다. 일반 월의 시트는 특수패/피/띠/피 순서이므로 엔진의 특수패/띠/피/피에 맞춰 재배치한다. 8월은 광/열끗/피/피, 11월 쌍피는 붉은 아래 면의 `Hwatu_November_Kasu_2.png`, 12월 쌍피는 `Hwatu_December_Kasu.png`에 대응한다.

원작자와 라이선스 링크는 게임의 설정 화면에 표시하며, 출처·변경 내역은 `public/cards/LICENSE.txt`로 배포한다. 원본과 변환한 48장 이미지에는 CC BY-SA 4.0을 유지한다. 이 이미지 라이선스가 앱 코드 전체에 적용된다고 표시하지 않는다.

## 보너스·뒷면·아이콘·소리

보너스 쌍피 2장은 크림색 바탕·빨간 테두리·수묵담채 느낌의 귀여운 토끼 캐릭터과 큰 숫자 2를 넣은 SVG 카드다. 토끼는 내장 imagegen으로 생성한 그림을 사용하며, 원본은 `assets/rabbit/ink-mascot.png`에 보관한다. 빨강·초록 배경과 캐릭터 방향으로 구분한다. [한게임 공식 보너스패 안내](https://hangame-images.toastoven.net/hangame/pc/gostop/introduce/html/duelgo/guide_duelgo03_04.html)의 큰 숫자와 캐릭터 구성을 참고했으며 원본 그림을 복사하지 않았다. 뒷면과 앱 아이콘은 기존 직접 제작한 SVG를 유지한다. 생성 소스는 `scripts/generate-card-extras.mjs`. 이들은 위 작가의 48장 세트에 포함되지 않는다. 소리는 Web Audio로 생성한 짧은 잡음이며 외부 게임 사운드를 사용하지 않는다.

PWA 캐시 버전은 `toki-v7-ink-rabbit`이다. 기존 캐시를 정리하고 WebP 48장과 최신 화면을 미리 저장한다.
