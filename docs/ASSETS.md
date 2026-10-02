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

보너스 쌍피 2장은 크림색 바탕·빨간 테두리·수묵담채 느낌의 귀여운 토끼 캐릭터와 큰 숫자 2를 넣은 SVG 카드다. 토끼는 내장 imagegen으로 생성한 그림을 사용하며, 원본은 `assets/rabbit/ink-mascot.png`에 보관한다. 빨강·초록 배경과 캐릭터 방향으로 구분한다. [한게임 공식 보너스패 안내](https://hangame-images.toastoven.net/hangame/pc/gostop/introduce/html/duelgo/guide_duelgo03_04.html)의 큰 숫자와 캐릭터 구성을 참고했으며 원본 그림을 복사하지 않았다. 뒷면과 앱 아이콘은 기존 직접 제작한 SVG를 유지한다. 생성 소스는 `scripts/generate-card-extras.mjs`. 이들은 위 작가의 48장 세트에 포함되지 않는다. 소리는 Web Audio로 생성한 짧은 잡음이며 외부 게임 사운드를 사용하지 않는다.

PWA 캐시와 카드 주소 버전은 파일 내용의 SHA-256에서 자동 생성한다. 개발/배포용 빌드 전에 `scripts/version-card-assets.mjs`가 실행된다. 새 워커는 탭 종료 없이 적용되며 열린 화면의 카드 주소도 갱신한다. 오프라인 카드 표시는 유지한다.

## 페이지 공유 썸네일

`public/social/toki-matgo-301e6e82ee94.jpg`는 1200×630 JPEG다. 큰 한글 제목·화투패를 든 토끼·녹색 먹빛과 한지 배경을 Codex 내장 imagegen으로 생성했다. 원본과 프롬프트는 `assets/social/`에 보관하며, 참고한 화투 그림의 출처와 CC BY-SA 4.0 표시는 `public/social/LICENSE.txt`에 포함한다. 파일 내용 해시를 주소에 넣어 새 이미지 배포 시 캐시와 구분한다.

`src/app/layout.tsx`의 Open Graph와 Twitter metadata가 같은 이미지를 사용한다. 이미지 주소는 운영 도메인을 기준으로 절대 주소로 출력한다. 방 초대 링크의 쿼리 값을 바꾸지 않도록 공유 metadata에서 별도 `og:url`이나 canonical 주소를 덮어쓰지 않는다.
