# 구조

## 엔진

`src/game-engine`은 React, DOM, 통신에 의존하지 않는 TypeScript. 카드 metadata → seeded shuffle → `createGame` → `applyAction` → immutable `nextState` + `events`. `calculateScore`는 독립 pure function. `assertInvariant`는 개발/운영 모두 성공 action마다 카드와 정규 턴 보존을 확인한다.

PLAY / SELECT_FLOOR / GO_STOP / FINISHED. 턴 보류 카드는 `TurnState`에 소유하며 바닥 선택 후 뒤집기, 뒤집은 패 선택을 이어간다. 폭탄 후 뒤집기 권리도 정규 턴 수를 소비한다. 보너스는 hand/deck/floor 경로가 분리되어 있다.

## 프런트엔드

Next.js App Router + React. 화면은 한국어 모바일 전용 세로 게임판. 한글 제품명은 토끼맞고, 영어 저장소 이름은 toki-matgo. 손패는 5 × 2이고 월 표식을 붙이지 않는다. 상대 손패는 이름 옆 장수만 표시, 획득은 광/열끗/띠/피 그룹. 패 내기·먹을 패 선택은 엔진 action에 연결되며 바닥패 확대는 UI 상태만 바꾼다. 같은 월의 바닥패는 각 폭의 1/3만 겹쳐 뒷패의 2/3가 보인다. 맞는 손패는 노란 테두리 빛으로 표시한다. 두 장 중 선택이 필요한 경우 손패·뒤집은 패의 타격을 보류하고 SELECT_FLOOR 후 선택한 개별 패의 좌표로 이동한다. 덱 위치에서 앞뒤 면을 회전하며 뒤집고, 맞지 않으면 숨긴 실제 빈 바닥 슬롯을 먼저 확보해 직접 이동한다. 바닥은 월순으로 재정렬하지 않는다. `floor-layout.ts`가 월별 자리와 개별 패의 겹침 위치를 유지하고, 새 패는 빈 자리에 들어간다. 중앙 덱 주위를 둘러싼 고정 좌표를 사용하고 덱과 바닥패 크기를 맞췄다. 타격은 네 가지 회전·어긋남 중 하나로 재생하고, 충격 고리와 빛줄기·소리·진동을 더한다. 효과 글자는 이동 중인 패보다 높은 레이어에서 표시한다.

`useAppBack`은 Next의 history 필드를 유지하는 같은 URL의 보호 entry를 만든다. 첫 실제 사용자 입력 때 base와 guard를 새로 만들어 Chrome이 입력 전 기록을 건너뛰는 경우를 방어하며, 매 화면 렌더마다 history를 늘리지 않는다. 열린 native dialog가 Android Back/Escape를 받고 별도의 앱 CloseWatcher는 만들지 않는다. 창이 없는 Escape는 keyup에서 대기실 복귀 확인을 연다. native close 이벤트도 React의 창 상태에 반영한다. 미지원 브라우저나 history Back은 보호 entry를 복구하고 최상위 dialog의 cancel 동작을 실행한다. 설정 → 맞고 안내 등의 중첩 창은 한 단계씩 닫힌다. 열린 창이 없으면 친구 입력 화면은 홈으로, 게임/대기실은 나가기 확인으로 이동한다. 홈에서는 홈을 유지한다. 필수 패 선택·고/스톱·결과 창은 기존의 취소 불가 판정을 유지한다. 게임·대기실이나 열린 팝업에서 실제 문서 이탈이 발생하면 beforeunload로 브라우저 확인을 요청한다. 새로고침에도 이 확인이 표시될 수 있다. 이벤트 listener는 unmount 때 모두 해제한다.

싱글플레이 authoritative state는 React 밖 ref에 있고 UI는 `projectState`만 렌더링. CPU `chooseAction`도 동일한 개인별 projection만 받는다. 멀티플레이 타입은 type-only import, Firebase transport는 친구와 치기 진입 때 동적으로 로드한다.

UI presenter가 events를 직렬 재생하고 마지막에 authoritative projection으로 맞춘다. 손패 이동 400ms, 매칭 400ms, 뒤집기 400ms + 확인 650ms, 회수 450ms, 점수 350ms, 특수 850ms. 속도는 1 / 0.65 / 0.35, reduced motion 0.12. CPU 대기 700–1400ms. 싱글 새 판은 선 안내에서 게임 시작을 누를 때까지 CPU 행동과 손패 입력을 대기한다. 이탈/새 판 때 generation token으로 이전 연출을 무효화한다. Firebase 상태 수신과 애니메이션은 분리된다.

## Firebase transport와 방장 판정

`src/multiplayer/firebase-client.ts`는 web config, 익명 인증과 local persistence, 개발 전용 에뮬레이터 연결을 담당한다. `firebase-transport.ts`는 방 코드 생성, guestUid 원자 선점, presence, action 제출·수신, host 상태 트랜잭션, ready/다음 판/나가기를 담당한다. `host.ts`는 통신 없이 기존 엔진을 호출하는 판정·정산·idempotence 함수다. UI는 `MultiplayerTransport`와 개인별 `RoomMessage`를 받으며 Firebase SDK를 직접 호출하지 않는다.

Guest/Host → 자신의 `actions/{uid}/{seq}` 작성 → Host 수신 → state 트랜잭션에서 기존 `applyAction` → 최종 GameState + events + receipt 저장 → 양쪽 UI 갱신. Host만 셔플/분배/다음 판 생성과 최종 상태 저장을 한다. Guest가 독자적으로 결과를 계산하는 lockstep 경로는 없다.

숫자 4자리 방 코드와 초대 URL/QR UX를 유지한다. 인증 UID는 브라우저에 유지되며 localStorage에는 code/UID를 보관한다. 같은 UID는 같은 참가자다. guest slot을 트랜잭션으로 선점하며 제3자 참여를 차단한다. 각 UID action 순번, round, game stateVersion, 턴/phase/소유권/준비 상태를 검증한다. 처리한 순번은 같은 요청이 다시 와도 state를 변경하지 않는다. invalid 요청도 오류 receipt로 소비하여 다음 정상 action의 순번을 이어간다. 정산은 같은 state 트랜잭션에서 한 번만 반영한다.

`state.data`는 HostState 전체를 JSON 문자열로 저장한다. RTDB에서 빈 배열/null이 없어지는 문제를 피하고 엔진의 정확한 자료형을 유지한다. `state.version`은 행동 처리 결과를 포함한 revision이며 게임의 stateVersion과 구분한다. 상세 모델/Rules는 [Firebase 운영 안내](FIREBASE.md)를 참고한다.

## 정보와 보안

일반 화면은 기존 `projectState`를 사용해 자신의 hand, 상대 handCount, deckCount를 렌더링한다. **Firebase에는 상대 손패와 미래 덱을 포함한 전체 GameState가 저장된다.** 두 참가자는 개발자 도구로 이를 볼 수 있다. 신뢰하는 친구 두 명이라는 요구사항에 따른 선택이며 과거 서버의 비밀 상태 보장과 다르다.

Database Rules는 비인증 접근과 전역 rooms 목록을 차단한다. 기존 참가자만 전체 방을 읽고 Host만 최종 state를 쓰며 각 참가자는 자기 actions/player 정보만 작성한다. 가입을 위해 코드가 있는 익명 인증 사용자는 최소 meta를 읽을 수 있다. guestUid 선점 후 변경은 금지한다. 별도 서버/Cloud Functions/anti-cheat는 추가하지 않는다.

## 연출 동기화

새 게임 버전의 events를 각 UI가 직렬 연출한 뒤 `ready(round, version)`을 기록한다. 양쪽 연결과 ready가 현재 판/버전에 도달해야 다음 행동이 가능하다. 단순 presence/ready 갱신은 기존 events를 재실행하지 않는다. 재접속/새로고침은 최신 상태로 복원하고 지난 연출을 건너뛴다. 다음 판은 두 명의 NEXT_ROUND 요청이 모여야 생성된다.

## 연결과 방 정리

SDK 자동 재접속, `.info/connected`, 세션별 `connections/{UUID}`와 `onDisconnect().remove()`를 사용한다. 일시 단절에는 방을 삭제하지 않는다. Host가 끊기면 Guest에게 방장 대기 표시, Guest가 끊기면 Host에게 친구 대기 표시를 보여주고 게임을 멈춘다. 같은 익명 UID의 새로고침은 동일 자리로 복귀한다. Host 자동 교체와 익명 UID 분실 복구는 없다.

생성 후 24시간 만료. 명시적 나가기는 참가자가 방을 종료·삭제한다. 새 방을 만들 때 동일 방장의 저장된 이전 방을 모두 확인해 만료/종료 방을 정리한다. 처리한 행동은 마지막 요청만 남겨 정리한다. 새 코드 후보가 만료 방이면 삭제한 뒤 번호를 재사용한다. 활성 방은 트랜잭션으로 중복 배정을 막는다. 서버의 주기적 전역 청소는 없으며 필요시 Console에서 수동 제거한다.

## Legacy

`server/index.ts` / `server/rooms.ts` 및 Socket.IO 실행 명령은 비교·향후 정리 대상으로 보존한다. 현재 프런트는 이 서버나 `NEXT_PUBLIC_REALTIME_URL`에 연결하지 않는다. legacy 서버 테스트는 기존 회귀 기록으로만 유지한다. 운영의 기본 멀티플레이 경로는 Firebase 하나다.

## PWA

manifest, 192/512 PNG와 SVG 아이콘, standalone, safe area, dvh, production service worker. 카드/아이콘 precache, 사용한 Next static chunks cache. 첫 온라인 로드 후 네트워크 없이 홈/싱글플레이 가능. Firebase/API/RSC 응답은 캐시하지 않는다. `predev` / `prebuild` / `prebuild:vercel`에서 `version-card-assets.mjs`가 카드 파일의 SHA-256으로 `card-assets.json`과 워커 캐시 버전을 자동 생성한다. 카드 주소에 내용 해시를 붙여 옛 워커에서도 새 그림을 구분한다. 설치 중 브라우저 HTTP 캐시를 재검증하고, 준비가 끝난 워커는 skipWaiting / claim으로 탭 종료 없이 적용한다. React의 단일 공유 구독은 워커가 보낸 카드 주소를 반영하며 진행 중인 게임을 새로고침하지 않는다. 이전 캐시의 Next chunks는 현재 캐시에 옮겨 오프라인 상태의 열린 게임을 보호한다. 캐시 정리는 toki 접두사에 한정하고, 이미지 조회는 현재 버전 캐시만 사용한다. 재접속·화면 복귀 및 화면이 열린 동안 5분 간격으로 워커 업데이트를 확인한다.

바닥은 중앙 덱을 피하는 12개 고정 위치를 사용한다. 화면 높이에 맞춰 덱과 바닥패가 같은 크기로 표시되며, 각 카드의 작은 정지 각도와 겹침 순번도 캡처 뒤 유지한다. 뻑 보너스는 `GameView.bonusAttachments`로 해당 월 더미에 표시한다. 상대 손패는 이름 옆 장수만 표시하며 패 뒷면 행과 손패 확대 안내 행은 제거했다.

손패 보너스는 바닥 착지와 분리한 `bonus` → `bonus-capture` 연출로 중앙 확인 후 소유자의 피 영역으로 이동한다. `PI_TRANSFERRED`는 `data-captured-card-id`로 상대 피의 실제 위치를 측정하며, 국진 피도 피 그룹으로 이동한다. 획득패 원본은 전송 중만 숨기고 완료 후 이벤트대로 양쪽 상태를 갱신한다. 폭탄 패스 권리는 엔진의 `bombPasses`를 손패의 폭탄 카드로 표현하며, 각 카드를 누르면 기존 `PASS` 행동을 제출한다. UI 토큰은 50장 물리 덱에 추가하지 않는다. 바닥 신규 월은 중앙 가까운 좌우 자리부터 채우며 위아래 획득 영역 사이에 간격과 구분선을 둔다.
