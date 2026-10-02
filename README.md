# 토끼맞고

**패는 없어도, 마주 앉은 것처럼.** 가족·친구 두 사람이 각자 스마트폰으로 치는 한국식 맞고 모바일웹. 기본 화투 48장 + 보너스 쌍피 2장, 게임머니/베팅/미션 없음.

## 실행

Node.js 22 이상(현재 검증 Node 26). npm 사용, 의존성 버전은 package-lock.json 고정.

```sh
npm ci
npm run dev          # 프런트 http://localhost:3000
npm run dev:server   # 별도 터미널: Socket.IO http://localhost:3002
```

혼자 치기는 프런트만 필요. 친구와 치기는 둘 다 실행. 브라우저에서 방 만들기 → 코드/URL/QR 공유 → 다른 기기로 입장.

로컬 기본 3002는 다른 서비스가 사용 중인 3001과 충돌을 피하기 위해 선택했다. 포트 변경 시 서버 PORT와 프런트 NEXT_PUBLIC_REALTIME_URL을 함께 맞출 것. `.env.example`을 참고한다. Next는 `.env.local`을 자동으로 읽지만 독립 서버는 읽지 않으므로 서버 환경변수는 shell/호스팅에서 직접 설정한다.

스마트폰에서 같은 Wi-Fi로 개발 서버 접근:

```sh
FRONTEND_ORIGIN=http://192.168.0.10:3000 PORT=3002 npm run dev:server
```

`next.config.ts`의 allowedDevOrigins에 자신의 개발 PC IP도 추가한다. 폰에서 `http://192.168.0.10:3000`을 연다. 기본 프런트 realtime 주소는 현재 hostname + :3002. 홈 화면 설치/서비스워커/Web Share에는 HTTPS 또는 localhost가 필요하다.

## 검증

```sh
npm test            # 엔진, 1000 seed 전체 판, 방/보안/재접속
npm run typecheck
npm run test:e2e    # 로컬 두 서버를 자동 시작/기존 서버 재사용
npm run build
npm run test:pwa     # production PWA: 캐시 후 오프라인 싱글
```

Playwright 브라우저가 없는 머신은 `npx playwright install chromium webkit`을 먼저 실행한다. E2E는 4개 모바일 크기, 3판 싱글, 2개의 독립 context로 친구 플레이, 실제 WebSocket payload 숨김 정보, 재접속/새로고침과 다음 판을 검사한다. 결과는 `playwright-report`, 실패 trace는 `test-results`.

## 프로덕션

빌드는 `.next-prod`에 출력해 개발 서버 `.next`와 격리한다. 정적 에셋도 복사한 standalone 출력으로 `npm start`를 실행한다. 서버를 옮길 때 `.next-prod/standalone` 폴더 전체를 배포하면 프런트에는 별도 npm 설치가 필요 없다. realtime 서버는 원본 server/src와 production 의존성으로 별도 실행한다.

```sh
NEXT_PUBLIC_REALTIME_URL=https://realtime.example.com npm run build
npm start
FRONTEND_ORIGIN=https://matgo.example.com PORT=3002 npm run start:server
```

프런트는 Next.js를 지원하는 호스팅에 배포. realtime은 Railway/Render/Fly.io/VPS 등의 **계속 실행되는 Node 프로세스**에 배포하고 TLS/WS 업그레이드를 지원하는 proxy 뒤에 둔다. Vercel 함수 안에서 WebSocket 서버를 실행하지 않는다. `/health`는 health check endpoint. 단일 realtime replica가 기본이다.

회원가입 없이 방 token으로 같은 참가자를 복원한다. 브라우저 저장소 삭제 시 참가 자리 복구 불가. MemoryRoomStore이므로 서버 재시작 시 진행 중 방은 소실된다. 모두 끊어진 방은 30분 유지. 공유 링크에는 개인 참가 token이 포함되지 않는다. 여러 replica/무중단 영속 복구가 필요하면 RoomStore 영속화와 공유 Socket.IO adapter 및 원자 행동 처리를 추가해야 한다.

PWA는 production에서만 service worker 등록. 이미 로드한 정적 코드와 카드로 오프라인 싱글플레이를 지원한다. 멀티플레이는 연결 필요. 배포 업데이트 시 `public/sw.js` 캐시 버전 갱신.

## Vercel 배포

1. Vercel에서 GitHub `GNOJES/toki-matgo` 저장소를 Import한다. Production Branch는 `main`, Root Directory는 저장소 루트, Framework는 Next.js를 선택한다.
2. 저장소의 `vercel.json`이 Build Command를 `npm run build:vercel`로 지정한다. Output Directory는 Next.js 기본값을 유지한다. 자체 호스팅용 `npm run build` / `npm start`와는 별도이며 Vercel에서는 `npm start`를 실행하지 않는다. `NEXT_BUILD_DIR` 환경변수도 설정하지 않는다.
3. 혼자 치기는 추가 환경변수 없이 배포할 수 있다. 친구와 치기를 쓰려면 위의 별도 realtime 서버를 먼저 배포하고, Vercel의 `NEXT_PUBLIC_REALTIME_URL`에 그 서버의 HTTPS 주소를 넣은 뒤 빌드/재배포한다. 이 변수는 브라우저 코드에 빌드 시 포함된다.
4. realtime 호스팅에는 `FRONTEND_ORIGIN=https://실제-프로덕션-도메인`을 설정한다. 커스텀 도메인과 Preview URL도 사용할 경우 허용할 정확한 origin을 쉼표로 추가한다. `PORT`는 호스팅 제공 값에 맞추며 시작 명령은 `npm run start:server`, health check 경로는 `/health`이다.
5. 배포 후 싱글플레이·홈 화면 설치·오프라인 재로딩을 확인하고, 서로 다른 기기에서 방 생성·초대 링크·재접속을 확인한다.

Vercel Functions는 이 프로젝트의 상시 Socket.IO 서버를 호스팅하지 않는다. 프런트만 배포한 상태에서는 싱글플레이를 사용할 수 있고, 친구 대전에는 별도 서버가 필요하다. 참고: [Vercel 빌드 설정](https://vercel.com/docs/builds/configure-a-build), [WebSocket 안내](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

## 개발 도구

개발 서버에서 `/?debug=1` → 혼자 치기 → 하단 `개발`. RNG seed, 뻑/따닥/폭탄/흔들기/자뻑 fixture, JSON 직접 분배, 원본 상태/덱, 이벤트, 연출 건너뛰기. 운영 빌드에서는 사용 불가. 멀티 state 원본은 서버에만 있다.

## 문서

- [규칙 명세](docs/RULES.md): 공식 한게임 **맞고** 문서와 구현 해석, 계산 순서
- [구조](docs/ARCHITECTURE.md): 엔진, 개인별 projection, action sequence, 연출/재접속
- [QA](docs/QA.md): 자동 검증과 실기기 확인 항목
- [에셋](docs/ASSETS.md): Marcus Richert 원본 화투, 카드 대응표·CC BY-SA 출처, 보너스/뒷면

공식 가이드에서 확인되지 않은 선고르기 세부 방식 등은 RULES.md에 명시했다. 실제 2026 앱과 모든 세부 동작이 동일하다고 검증한 상태는 아니다. 시뮬레이션/브라우저 검증을 실기기에서의 상용 품질 인증으로 간주하지 않는다.
