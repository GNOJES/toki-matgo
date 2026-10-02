# 구조

## 엔진

`src/game-engine`은 React, DOM, 통신에 의존하지 않는 TypeScript. 카드 metadata → seeded shuffle → `createGame` → `applyAction` → immutable `nextState` + `events`. `calculateScore`는 독립 pure function. `assertInvariant`는 개발/운영 모두 성공 action마다 카드와 정규 턴 보존을 확인한다.

PLAY / SELECT_FLOOR / GO_STOP / FINISHED. 턴 보류 카드는 `TurnState`에 소유하며 바닥 선택 후 뒤집기, 뒤집은 패 선택을 이어간다. 폭탄 후 뒤집기 권리도 정규 턴 수를 소비한다. 보너스는 hand/deck/floor 경로가 분리되어 있다.

## 프런트엔드

Next.js App Router + React. 화면은 한국어 모바일 전용 세로 게임판. 한글 제품명은 토끼맞고, 영어 저장소 이름은 toki-matgo. 손패는 5 × 2이고 월 표식을 붙이지 않는다. 상대 손패는 실제 장수만큼 뒷면, 획득은 광/열끗/띠/피 그룹. 패 내기·먹을 패 선택은 엔진 action에 연결되며 바닥패 확대는 UI 상태만 바꾼다. 같은 월의 바닥패는 각 폭의 1/3만 겹쳐 뒷패의 2/3가 보인다. 맞는 손패는 노란 테두리 빛으로 표시한다. 두 장 중 선택이 필요한 경우 손패·뒤집은 패의 타격을 보류하고 SELECT_FLOOR 후 선택한 개별 패의 좌표로 이동한다. 덱 위치에서 앞뒤 면을 회전하며 뒤집고, 맞지 않으면 숨긴 실제 빈 바닥 슬롯을 먼저 확보해 직접 이동한다. 타격은 작은 회전과 눌림·반동, 착지 시 소리/진동으로 표시하며 타격한 패 위에 비스듬히 유지한 뒤 획득한다.

`useAppBack`은 Next의 history 필드를 유지하는 같은 URL의 보호 entry를 만든다. 첫 실제 사용자 입력 때에도 한 번 활성화하며, 매 화면 렌더마다 history를 늘리지 않는다. CloseWatcher를 지원하는 브라우저에서는 열린 dialog가 네이티브 Android Back/Escape를 받고, dialog가 없을 때만 앱 CloseWatcher가 대기실 복귀 확인을 연다. native close 이벤트도 React의 창 상태에 반영한다. 미지원 브라우저나 history Back은 보호 entry를 복구하고 최상위 dialog의 cancel 동작을 실행한다. 설정 → 맞고 안내 등의 중첩 창은 한 단계씩 닫힌다. 열린 창이 없으면 친구 입력 화면은 홈으로, 게임/대기실은 나가기 확인으로 이동한다. 홈에서는 홈을 유지한다. 필수 패 선택·고/스톱·결과 창은 기존의 취소 불가 판정을 유지한다. 이벤트 listener는 unmount 때 모두 해제한다.

싱글플레이 authoritative state는 React 밖 ref에 있고 UI는 `projectState`만 렌더링. CPU `chooseAction`도 동일한 개인별 projection만 받는다. 서버 모듈은 type-only import이며 클라이언트 번들로 실행 코드가 들어가지 않는다.

UI presenter가 events를 직렬 재생하고 마지막에 authoritative projection으로 맞춘다. 손패 이동 400ms, 매칭 400ms, 뒤집기 400ms + 확인 650ms, 회수 450ms, 점수 350ms, 특수 850ms. 속도는 1 / 0.65 / 0.35, reduced motion 0.12. CPU 대기 700–1400ms. 이탈/새 판 때 generation token으로 이전 연출을 무효화한다. 서버 동기화와 애니메이션은 분리된다.

## 지속 연결 서버

`server/index.ts`: 독립 Node.js + Socket.IO. 프런트 정적 빌드와 별도 프로세스이며 서버리스 함수로 실행하지 않는다. `RoomStore` interface와 `MemoryRoomStore` 구현. 초기 서비스는 단일 replica에 배포해야 한다.

방 코드는 crypto RNG 6자리. 각 참가자는 crypto RNG 256-bit token을 받는다. nickname와 room token은 localStorage. URL/QR에는 공개 방 코드만 넣고 token은 넣지 않는다. `room:enter`로 생성/참여/세션 복구. token 재접속 시 예전 socket을 끊어 같은 참가자의 이중 제어를 방지한다.

각 socket을 `(room, player)`에 바인딩한다. 클라이언트가 보낸 player 값은 무시하고 서버 바인딩으로 덮어쓴다. round, action sequence와 stateVersion을 확인한 뒤 엔진이 phase/turn/소유권/바닥 선택을 검증한다. 성공 sequence 재전송은 상태를 다시 변경하지 않는다.

## 숨김 정보

각 수신자별 `projectState`를 만들어 전송. 자신 hand만 존재. 상대는 handCount만 존재. deck은 deckCount만 존재. 이벤트에는 이미 낸 패/뒤집은 패/획득된 패/의도적으로 공개 선언한 흔들기 세 장만 존재. 보너스 손패 보충 카드와 미래 덱은 이벤트에 담지 않는다. 통째 원본 상태를 broadcast하는 경로가 없다. debug 원본 상태는 개발 싱글플레이에서만 가능하며 멀티 원본 state는 프런트에 존재하지 않는다.

## 연출 동기화

행동 후 두 session의 readyVersion은 이전 값. UI가 event 재생을 끝내면 `game:ready(version)`을 보낸다. 두 연결의 readyVersion이 authoritative version과 같아야 새 행동 가능. 상대 속도 설정이 느려도 판을 따라갈 수 있다. 재접속은 event를 재실행하지 않고 최신 상태 복원 후 준비된 것으로 처리한다.

## 연결 복구

Socket.IO 자동 재접속. 새로고침하면 localStorage의 code/token으로 동일 자리 재입장. 상대에게 연결 대기 상태를 보여주며 턴을 멈춘다. 기본 턴 제한 없음. 모든 참가자가 끊어진 방은 마지막 disconnect 후 30분 보관. 서버 재시작 시 MemoryRoomStore 소실(운영상 한계). 영속성이 필요하면 RedisRoomStore와 socket adapter, 공유 잠금/원자 action 처리를 함께 도입해야 한다.

## PWA

manifest, 192/512 PNG와 SVG 아이콘, standalone, safe area, dvh, production service worker. 카드/아이콘 precache, 사용한 Next static chunks cache. 첫 온라인 로드 후 네트워크 없이 홈/싱글플레이 가능. socket/API/RSC 응답은 캐시하지 않는다. 프런트 개정 시 sw cache version도 갱신할 것.
