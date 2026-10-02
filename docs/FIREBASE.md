# Firebase 운영 안내

## 현재 프로젝트

- Project ID: `toki-matgo`
- Auth domain: `toki-matgo.firebaseapp.com`
- RTDB: `https://toki-matgo-default-rtdb.asia-southeast1.firebasedatabase.app`
- Anonymous Authentication: 사용자 활성화 완료
- 현재 Database: 잠금 모드. 아래 Rules를 사용자가 Publish해야 사용 가능
- 로컬 `.env.local`: 제공받은 7개 web config 값으로 구성, Git 제외
- Vercel 등록 값: [README의 환경변수 블록](../README.md#vercel-환경변수와-배포)

아직 이 저장소 작업으로 운영 Firebase Rules를 변경하거나 Vercel에 환경변수를 등록하지 않았다. 에뮬레이터 검증과 운영 Console 설정은 별개다.

## 최종 Security Rules 적용

**최종 원본은 [database.rules.json](../database.rules.json)이다.** 파일 전체를 복사해 Firebase Console → `toki-matgo` → Build → Realtime Database → Rules에 붙여넣고 Publish한다. 일부 노드만 붙이거나 기본 잠금 Rules와 합치지 않는다. 파일에는 최상위 `rules` 객체도 포함되어 있다.

CLI를 사용하는 경우에도 동일 파일을 적용할 수 있다.

```sh
npx firebase login
npx firebase deploy --only database --project toki-matgo
```

CLI 로그인/배포는 사용자가 실행하는 운영 변경이다. 에뮬레이터용 demo 프로젝트 ID로 운영 배포하지 않는다. 적용 후 사이트의 서로 다른 브라우저에서 방 생성/참가를 확인한다. `permission_denied`가 나면 Rules가 해당 RTDB 인스턴스에 Publish됐는지, 익명 인증이 활성화됐는지, 배포 빌드에 URL/projectId가 맞는지 확인한다.

Rules의 범위:

| 경로                  | 읽기                         | 쓰기                                                            |
| --------------------- | ---------------------------- | --------------------------------------------------------------- |
| `/rooms` 목록         | 금지                         | 금지                                                            |
| `/rooms/{code}`       | 방장/게스트만 전체 조회      | 새 방 생성자만 생성, 참가자만 종료·만료 방 삭제                 |
| `meta`                | 코드를 아는 익명 인증 사용자 | 참가자만 제한된 갱신; guestUid 최초 점유는 자신의 UID로 한 번만 |
| `players/{uid}`       | 참가자                       | 자기 이름/presence/ready만                                      |
| `state`               | 참가자                       | 방장만, version 1씩 증가, 문자열 크기 제한                      |
| `actions/{uid}/{seq}` | 참가자                       | 자기 action 최초 작성만, 변경 금지; 처리 후 삭제는 방장만       |

비인증 사용자는 모든 rooms 접근이 차단된다. 방 코드 확인과 참가 트랜잭션을 위해 **최소 meta는 코드가 있는 익명 사용자에게 읽기를 허용**한다. 이를 통해 참가 전에도 방 없음/만료/정원 오류를 안내한다. 게임 상태·행동·플레이어 정보와 전체 방 목록을 제3자에게 공개하지 않는다. `guestUid`는 원자 트랜잭션으로 선점하므로 두 사람이 동시에 참가해도 한 명만 성공한다. 게스트가 자신을 제거하고 세 번째 사람으로 바꾸는 것도 막는다.

Rules는 게임 규칙 자체를 계산하지 않는다. 방장이 저장한 JSON의 게임 내용은 신뢰하며 기존 엔진이 턴/phase/카드 소유권과 유효한 선택을 판정한다. 개발자 도구 접근 및 악의적인 방장 조작은 이 버전의 허용된 한계다.

## 데이터 구조와 판정 흐름

```text
rooms/{6자리 코드}
  meta: hostUid, guestUid?, status, createdAt, updatedAt, expiresAt
  players/{uid}
    name
    connections/{브라우저 세션 UUID}: true
    ready: {round, version}
  actions/{uid}/{10자리 sequence}
    uid, sequence, round, stateVersion, action, createdAt
  state
    version: host revision
    data: JSON 문자열(전체 HostState)
```

`state.data`는 GameState, events, round, 승수/점수, 처리한 각 UID의 순번, 행동 처리 결과, 다음 판 준비를 함께 저장한다. RTDB에서 빈 배열과 null이 변형되는 문제를 피하기 위해 JSON 문자열을 사용한다. `state.version`은 잘못된 요청의 처리 결과를 포함한 revision이고, 엔진 `game.stateVersion`은 실제 게임 행동 버전이다. 두 값은 목적이 다르다.

Host/Guest 모두 같은 경로에 action을 기록한다. Host가 순차 수신 후 state 트랜잭션에서 기존 `applyAction`을 실행한다. UID로 player를 결정해 클라이언트의 player 주장을 덮어쓴다. 이미 처리한 sequence는 다시 실행하지 않는다. 순번 누락, 다른 판/오래된 버전, 차례 위반, 준비 전 행동은 게임 상태를 변경하지 않고 오류 receipt를 기록한다. 각 플레이어의 sequence는 다음 판에도 이어진다.

실제 action 타입은 기존 엔진의 `PLAY_CARD`(흔들기 선택 포함), `SELECT_FLOOR`, `BOMB`, `PASS`, `GO`, `STOP`, `SET_KUKJIN`과 transport의 `NEXT_ROUND`이다. 별도의 Firebase 게임 규칙은 없다.

첫 참가 후 셔플/분배는 Host만 한다. 다음 판도 두 명의 NEXT_ROUND 준비가 확인된 뒤 Host가 한 번 생성한다. 승수/점수 정산과 상태 생성이 같은 트랜잭션 안에서 처리된다. Guest는 별도 셔플이나 최종 state 작성을 하지 않는다.

두 화면은 동일 authoritative state를 각각 `projectState`로 렌더링한다. 상대 손패는 UI에서 뒷면이지만 전체 원본은 참가자 DB 조회에 포함된다. 각 화면의 이벤트 연출 종료 후 ready를 기록하고, 양쪽의 같은 판/버전 ready가 모여야 다음 패를 낼 수 있다. 재로딩에서는 지나간 이벤트를 다시 연출하지 않고 최신 상태로 복원한다.

## 로컬 테스트

단일 플레이는 Firebase 없이 `npm run dev`만 실행한다. 실제 Firebase와 연결하려면 `.env.local` 설정 + Console Rules가 필요하다.

운영 DB를 사용하지 않는 테스트:

```sh
npm ci
# Java 21 이상 설치 및 JAVA_HOME/PATH 설정
npx playwright install chromium webkit
npm run test:firebase
npm run test:e2e
```

자동 실행 명령은 로컬 에뮬레이터를 시작하고 종료한다. Auth/RTDB는 각각 9099/9000, E2E Next는 3004이다. `demo-toki-matgo`를 사용하고 `.env.local`보다 우선하는 demo 설정을 주입하므로 운영 프로젝트에 테스트 방을 만들지 않는다.

직접 두 브라우저를 조작할 때는 `npm run emulators`와 `npm run dev:firebase`를 별도 터미널에서 실행해 localhost:3000을 연다. 일반 창 + 시크릿 창 또는 Chrome + Safari를 사용한다. 일반 탭 두 개는 같은 익명 UID를 공유한다. Emulator UI는 http://127.0.0.1:4000이다. 이 프로젝트는 에뮬레이터를 기본 127.0.0.1에 바인딩하며 LAN에 개방하지 않는다.

로컬에서 실제 폰을 사용하려면 실제 Firebase 설정으로 `npm run dev`를 실행하고 PC의 LAN IP:3000으로 접속한다. `next.config.ts`의 allowedDevOrigins에도 PC IP를 추가한다. 서비스워커/홈 설치/Web Share는 HTTPS 또는 localhost가 필요하므로 최종 폰 검증은 Vercel의 HTTPS URL로 진행한다.

## 실제 두 휴대폰 확인

1. 두 폰에서 동일 Vercel URL 접속, 한쪽 이름 입력 후 방 만들기.
2. 코드/초대 링크/QR 전달, 상대 폰으로 참가. 손패 10장/바닥/선/점수 일치 확인.
3. 서로 몇 턴 진행하며 같은 월 2장 선택, 특수 패, 고/스톱, 결과를 확인.
4. 두 명 모두 한 판 더를 눌러 다음 판이 같은 분배로 시작하는지 확인.
5. 게스트 새로고침 → 동일 이름/자리/최신 상태로 복귀.
6. 방장 Wi-Fi/LTE 전환 또는 잠깐 네트워크 끊기 → 게스트 연결 대기 표시, 방장 복귀 → 같은 판 계속.
7. 짧게 화면 잠금/다른 앱 전환 후 복귀. OS가 브라우저를 장시간 정지할 경우 복귀까지 판정이 멈출 수 있다.
8. 확대 창/설정 뒤로가기는 창만 닫힘, 게임 뒤로가기는 나가기 확인. 한 명이 명시적으로 나가면 상대에 종료 안내.

## 재접속·정리·제약

Firebase 익명 UID는 브라우저 로컬 인증 persistence로 유지된다. 방 코드/UID는 localStorage에 보관한다. presence는 세션별 연결 노드를 쓰며 `onDisconnect().remove()`로 해제한다. 네트워크 단절 감지는 서버 타임아웃까지 지연될 수 있다. SDK가 자동 연결 복구 후 presence를 다시 등록한다. 새로고침도 같은 UID이면 같은 참가자로 복귀한다. 브라우저 저장소 삭제/다른 브라우저/시크릿 창 종료 후 익명 계정 분실은 별도 사용자로 취급한다.

Host가 끊기면 Guest는 대기하고 나갈 수 있다. 서버가 대신 게임을 진행하거나 자동으로 Host를 교체하지 않는다. 명시적 나가기와 일시 단절/새로고침은 구분한다. 명시적 나가기는 방 전체 종료·삭제, 단절은 보존이다.

방의 유효기간은 생성부터 24시간이다. 새 방 생성 시 이 브라우저가 저장한 자신의 이전 방 중 최대 8개를 확인해 만료/종료 방을 제거한다. 처리 완료 action은 마지막 요청/receipt만 남기도록 정리한다. 전역 목록 조회, cron, Cloud Functions는 쓰지 않는다. UID를 잃거나 복귀하지 않는 사용자의 버려진 방은 자동 전역 청소할 주체가 없으므로 Console 수동 삭제가 필요할 수 있다.

같은 UID의 여러 탭은 하나의 참가자이고, 동일 순번 트랜잭션/처리로 중복 행동을 막는다. 두 명 테스트에는 다른 인증 저장소를 사용한다. 무제한 규모/무료 보장, 경쟁 서비스의 치팅 방지, 영구 계정 복구는 범위 밖이다. Firebase 무료 플랜의 실제 사용량은 Console에서 확인한다.

기존 `server/index.ts` / `server/rooms.ts`와 Socket.IO 명령은 legacy이며 Firebase의 운영 경로에서는 실행하지 않는다. 최종 프런트에는 Node 게임 서버 import/URL 연결이 없다.

참고: [익명 인증](https://firebase.google.com/docs/auth/web/anonymous-auth), [인증 persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), [RTDB 트랜잭션](https://firebase.google.com/docs/database/web/read-and-write), [presence / onDisconnect](https://firebase.google.com/docs/database/web/offline-capabilities), [Security Rules](https://firebase.google.com/docs/database/security), [Emulator 테스트](https://firebase.google.com/docs/rules/unit-tests).
