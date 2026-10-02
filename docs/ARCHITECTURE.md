# 구조

## 엔진

`src/game-engine`은 React, DOM, 통신에 의존하지 않는 TypeScript. 카드 metadata → seeded shuffle → `createGame` → `applyAction` → immutable `nextState` + `events`. `calculateScore`는 독립 pure function. `assertInvariant`는 개발/운영 모두 성공 action마다 카드와 정규 턴 보존을 확인한다.

PLAY / SELECT_FLOOR / GO_STOP / FINISHED. 턴 보류 카드는 `TurnState`에 소유하며 바닥 선택 후 뒤집기, 뒤집은 패 선택을 이어간다. 폭탄 후 뒤집기 권리도 정규 턴 수를 소비한다. 보너스는 hand/deck/floor 경로가 분리되어 있다.

## 프런트엔드

Next.js App Router + React. 화면은 한국어 모바일 전용 세로 게임판. 손패는 5 × 2, 상대 손패는 실제 장수만큼 뒷면, 획득은 광/열끗/띠/피 그룹. DOM 이벤트는 엔진 action에만 연결된다.

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
