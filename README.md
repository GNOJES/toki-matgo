# 토끼맞고

**패는 없어도, 마주 앉은 것처럼.** 가족·친구 두 사람이 각자 스마트폰으로 치는 한국식 맞고 모바일웹. 기본 화투 48장 + 보너스 쌍피 2장, 게임머니/베팅/미션 없음.

혼자 치기는 브라우저에서 실행한다. **친구와 치기는 Vercel 프런트엔드 + Firebase Anonymous Auth / Realtime Database**를 사용한다. 방장 브라우저가 기존 엔진으로 판정하고 Firebase에 최종 상태를 저장한다. 별도 상시 Node 서버나 Cloud Functions는 필요 없다.

## 실행

Node.js 24 이상 권장(현재 검증 Node 26), npm 사용. Firebase 에뮬레이터에는 **Java 21 이상**도 필요하다.

```sh
npm ci
npm run dev             # http://localhost:3000, .env.local의 실제 Firebase 사용
```

현재 로컬 `.env.local`은 프로젝트 `toki-matgo` 설정으로 구성되어 있다. 이 파일은 Git에 포함하지 않는다. 다른 PC에서는 `.env.example`을 `.env.local`로 복사해 아래 값을 입력한다. Firebase Console에 Anonymous Authentication을 활성화하고 Rules를 적용한 뒤 친구와 치기를 실행한다. 설정 없이도 혼자 치기는 가능하다.

운영 데이터를 쓰지 않는 개발·테스트는 별도 터미널 두 개에서 실행한다.

```sh
npm run emulators       # demo-toki-matgo: Auth 9099, Database 9000, 관리 UI 4000
npm run dev:firebase    # http://localhost:3000, 에뮬레이터용 설정 자동 적용
```

브라우저 일반 창과 시크릿 창을 열어 서로 다른 익명 사용자로 접속한다. 일반 창에서 친구와 치기 → 이름 입력 → 방 만들기 → 링크/코드/QR 공유, 시크릿 창에서 참가하면 자동으로 시작한다. 같은 브라우저의 일반 탭들은 동일 UID를 공유하므로 두 명 테스트에 사용하지 않는다.

## Firebase Console 설정

프로젝트 `toki-matgo`, Realtime Database 주소는 `https://toki-matgo-default-rtdb.asia-southeast1.firebasedatabase.app`이다.

1. Authentication → Sign-in method → **Anonymous 활성화**. 현재 사용자가 활성화 완료한 상태다.
2. Realtime Database → **Rules**에서 [database.rules.json](database.rules.json)의 **전체 내용**으로 교체하고 Publish한다. 현재 잠금 모드는 적용 전까지 방 만들기/참가를 차단한다. 상세 접근 권한과 적용 절차는 [Firebase 운영 안내](docs/FIREBASE.md)에 있다.
3. Project settings → General → Web 앱 설정에서 환경변수를 확인한다. Firebase Storage나 Firestore를 활성화할 필요는 없다. Cloud Functions도 사용하지 않는다.
4. 새 프로젝트를 만드는 경우 Realtime Database는 먼저 잠금 모드로 생성한 다음 동일 Rules를 적용한다. 공개 read/write 테스트 모드로 바꾸지 않는다.

Firebase web config는 브라우저에 포함되는 공개 설정이다. 실제 권한은 익명 인증 UID와 Database Rules로 제한한다. 서비스 계정 키/Admin SDK 자격증명은 이 앱에 넣지 않는다.

## Vercel 환경변수와 배포

Vercel → 프로젝트 → Settings → Environment Variables에 아래 **7개 변수**를 Production에 등록한다. Preview에서도 실제 Firebase를 사용할 경우 같은 변수들을 Preview에도 등록한다.

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDg7tXY4mgxsAXp5di_icvlDd-BPL3bT5U
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=toki-matgo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://toki-matgo-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=toki-matgo
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=toki-matgo.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=651336244726
NEXT_PUBLIC_FIREBASE_APP_ID=1:651336244726:web:7d331c7f2cf5da26cebbd7
```

`NEXT_PUBLIC_FIREBASE_USE_EMULATORS`는 Vercel에서 등록하지 않거나 `false`로 설정한다. `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST`도 필요 없다. `NEXT_PUBLIC_REALTIME_URL`, `FRONTEND_ORIGIN`, 게임 서버용 `PORT`는 더 이상 사용하지 않는다.

1. GitHub `GNOJES/toki-matgo`를 Import한다. Framework는 Next.js, Root Directory는 저장소 루트, Production Branch는 `main`이다.
2. 위 환경변수를 입력한다. 저장소 `vercel.json`의 Build Command는 `npm run build:vercel`이고 Output Directory는 기본값이다. Vercel에 `NEXT_BUILD_DIR`를 설정하거나 `npm run start:server`를 실행하지 않는다.
3. Firebase Rules를 Publish하고 Vercel을 Deploy/Redeploy한다. `NEXT_PUBLIC_` 값은 빌드 시 포함되므로 변수 변경 후에는 재배포가 필요하다.
4. 실제 휴대폰 두 대로 배포 URL을 연다. 한쪽에서 방을 만들고 상대에게 초대 링크/QR/숫자 4자리 코드를 전달한다. 두 기기가 같은 Wi-Fi일 필요는 없다. 양쪽 인터넷 연결과 방장 브라우저가 필요하다.
5. 카드 내기·먹을 패 선택·고/스톱·한 판 더, 게스트 새로고침, 방장 일시 연결 해제/복귀, 나가기를 확인한다. 자세한 체크리스트는 [QA](docs/QA.md)를 참고한다.

## 검증

```sh
npm test                # 기존 규칙/legacy 테스트 + Firebase host 판정 단위 테스트
npm run typecheck
npm run test:firebase   # Auth/Database 에뮬레이터 자동 시작·종료, 보안 + 실제 SDK 통합
npm run test:e2e        # 에뮬레이터 + Next 자동 시작, 두 브라우저 대전/모바일 회귀
npm run build          # .next-prod standalone 프로덕션 빌드
npm run test:pwa        # 프로덕션 캐시·오프라인 싱글플레이
```

처음에는 `npx playwright install chromium webkit`으로 테스트 브라우저를 설치한다. 에뮬레이터 테스트를 실행할 때 수동 실행 중인 에뮬레이터를 종료해 포트 충돌을 피한다. 테스트는 `demo-toki-matgo`와 로컬 Auth/Database를 사용하며 실제 프로젝트 DB에 쓰지 않는다. E2E는 `.next-firebase`, 자체 운영 빌드는 `.next-prod`를 사용한다. 결과는 `playwright-report`, 실패 trace는 `test-results`에 저장한다.

4자리 방 코드 버전으로 업데이트할 때는 **`database.rules.json`의 새 규칙을 Firebase Console에 다시 게시한 뒤** 새 방을 만든다. 기존 6자리 방은 저장된 참가 정보로 재접속만 지원하며 새로 만들지는 않는다.

## 연결과 운영 한계

익명 UID와 방 코드를 유지한 같은 브라우저는 새로고침/짧은 네트워크 단절 후 같은 자리로 돌아온다. 어느 쪽이 끊기든 판정을 멈추고 상대 이름과 대기 시간을 표시한다. 2분부터 기다림을 끝내는 버튼도 표시하며 자동 패배 처리는 하지 않는다. 대기 중에도 나가기 버튼/뒤로가기 확인으로 홈에 돌아올 수 있다. 브라우저 저장소나 익명 계정이 사라지면 자리 복구는 보장하지 않는다. 자동 방장 교체는 없다.

신뢰하는 친구 둘을 위한 구조다. UI에는 상대 손패 장수만 표시하지만 **DB에는 전체 손패/덱을 포함한 상태가 있다**. 참가자가 개발자 도구로 조사하면 볼 수 있으며 방장 자체의 조작도 막지 않는다. 공개 경쟁 게임용 치팅 방지 구조가 아니다.

방은 생성 후 24시간 유효하다. 명시적으로 나가면 방을 종료하고 삭제한다. 새 방을 만들 때 이 브라우저가 저장한 자신의 만료/종료 방을 정리하고, 배정하려는 숫자 코드가 만료 방의 코드이면 삭제 후 재사용한다. 사용 중인 코드는 Firebase 트랜잭션으로 중복 배정되지 않게 보호한다. 모든 참가자가 저장소를 지우거나 다시 접속하지 않으면 오래된 기록이 남을 수 있어 Firebase Console에서 수동 정리가 필요하다. Firebase 무료 사용량 한도를 넘는 이용까지 무제한 무료를 보장하지는 않는다.

## 기존 서버와 PWA

`server/index.ts`, `server/rooms.ts`, 관련 Socket.IO 의존성과 `dev:server` / `start:server` 명령은 **legacy 비교·별도 정리 대상**으로 보존한다. 현재 프런트는 이 서버에 연결하지 않으며 배포/개발에 실행할 필요가 없다. Firebase와 기존 서버를 동시에 운영하는 전환 경로는 없다.

자체 호스팅은 `npm run build` 후 `npm start`로 프런트를 실행한다. 빌드의 `.next-prod/standalone`에 정적 에셋도 복사한다. PWA는 production에서만 서비스워커를 등록하며 최초 온라인 로드 후 오프라인 혼자 치기를 지원한다. 멀티플레이는 인터넷이 필요하다. 배포 개정 시 `public/sw.js`의 캐시 버전을 갱신한다.

## 플레이 기록

홈 화면의 **최근 기록**에서 이 브라우저로 완료한 혼자 치기·친구와 치기 결과를 확인한다. 최근 판 목록은 100개까지 저장하며, 혼자 치기 누적 승패·무승부·획득 점수는 목록 제한과 관계없이 계속 유지한다. 새 게임 시작이나 브라우저 재접속으로 누적 기록이 초기화되지 않는다. **혼자 치기 기록 초기화**를 확인하면 혼자 치기 누적 통계와 최근 판을 지우며 친구 기록은 유지한다. 브라우저 저장 공간을 지우면 기록도 삭제되며 기기 간 동기화는 하지 않는다.

## 개발 도구와 문서

개발 서버 `/?debug=1` → 혼자 치기 → 하단 개발: seed, 뻑/따닥/폭탄/흔들기/자뻑 fixture, 직접 분배, 원본 상태/덱, 이벤트, 연출 건너뛰기. 운영 빌드에서는 표시하지 않는다.

- [Firebase 운영 안내](docs/FIREBASE.md): 데이터 구조, Rules, 설정·재접속·정리·실기기 테스트
- [규칙 명세](docs/RULES.md): 공식 한게임 맞고 문서와 구현 해석·계산 순서
- [구조](docs/ARCHITECTURE.md): 엔진, Firebase transport, 판정·연출 동기화
- [QA](docs/QA.md): 자동 검증과 실기기 확인 항목
- [에셋](docs/ASSETS.md): Marcus Richert 원본 화투 대응표·CC BY-SA 출처, 보너스/뒷면


### 출시 검증과 Rules 변경 배포

- `npm run build` / Vercel 빌드는 Firebase 환경변수 누락·프로젝트 불일치·프로덕션 에뮬레이터 설정을 거절한다. Vercel 빌드에서는 단위 테스트도 실행한다.
- `.github/workflows/ci.yml`의 `release-checks`가 타입·단위·Firebase Rules/통신·모바일 E2E·프로덕션 오프라인 테스트를 실행한다. 테스트는 demo 에뮬레이터를 사용한다.
- GitHub main 브랜치 보호에서 **release-checks 필수 통과**를 설정한다. 워크플로 파일만으로 브랜치 보호나 Vercel 자동 배포 대기를 강제할 수는 없다. 보호 설정 전에는 검사 통과를 확인한 뒤 main에 병합한다.
- 이번 데이터 구조 변경은 **Rules 게시 → 프런트엔드 배포 → 두 기기 새로고침·새 방 시작** 순서다. 상세 절차와 롤백은 [Firebase 운영 안내](docs/FIREBASE.md#2026-10-04-출시-전-개선-버전-적용-순서)를 따른다.
