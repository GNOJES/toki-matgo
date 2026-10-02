# QA 기록과 실기기 확인

검증일 2026-10-02. 자동 브라우저는 Playwright Chromium / WebKit, 대표 390×844. 실제 Android/iPhone 기기를 원격 조작한 검증은 아니다.

## 자동 검증

| 검증                                             | 결과                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Vitest 엔진/방/fixture 65개                      | 통과                                                            |
| seed 0–999 전체 판 AI 시뮬레이션                 | 모두 종료, 매 action 50장/턴 보존                               |
| TypeScript strict                                | 통과                                                            |
| Next.js 16.3.8 production standalone build       | 통과                                                            |
| 360×800 / 375×812 / 390×844 / 412×915 · Chromium | 4개 통과, 페이지 스크롤 없음                                    |
| 동일 4개 viewport · WebKit                       | 4개 통과, 확대/설정 조작                                        |
| 싱글 3판 · Chromium                              | 고/스톱, 종료 결과, 다음 판 통과                                |
| 멀티 2 context · Chromium                        | 생성/URL 참여, 바닥/점수/턴/종료/다음 판 동일                   |
| 숨김 정보 · 실제 수신 WebSocket                  | initial/event/reconnect payload에 상대 손패 ID 없음             |
| 재접속 · Chromium                                | B offline → A 연결 대기 → B online/새로고침 → 같은 version 복원 |
| production PWA · Chromium                        | 첫 로드 캐시 → offline 새로고침 → 싱글 패 내기, debug 비노출    |

`npm test`, `npm run typecheck`, `npm run test:e2e`, `npm run build`, `npm run test:pwa`로 재현. Playwright report/trace는 git 제외. 모바일 스크린샷은 `test-results/mobile-*.png`; 대표 화면은 `docs/screenshots`.

## 규칙 회귀

Deck: 48 기본 + 쌍피 2 = 50, 12월×4, 고유 ID, seed 재현, shuffle identity, 10/10/8, 초기 바닥 보너스 선 획득.

매칭: 0/1/2/3장, 손패 매칭 2장 선택, 덱 매칭 2장 선택, 잘못된 선택 거절. 순차 event 순서 fixture.

특수: 뻑/보너스 부착, 자뻑 2피, 상대 뻑 1피, 쪽/쓸, 따닥, 첫따닥 7점, 첫뻑/2연뻑/3연뻑 7+14+21 및 3뻑 7점 합계49, 불연속 3뻑, 흔들기, 3장 폭탄/2회 패스, 2장 폭탄 거절, 총통10, 허당7, 나가리, 마지막 정규 턴 뻑/쪽 제외, 마지막 스톱.

점수: 3/비3/4/5광, 열끗5, 고도리, 띠5, 홍/청/초단, 비띠 제외, 피10, 쌍피, 국진 단일분류/전환검증, 1~5고, 고 후 기본점수 증가 요건, 흔들기+폭탄 배수, 피박 경계7/8, 광박 유무, 멍따, 고박, 전판나가리, 복합 배수 계산 순서.

보너스: 초기 floor / hand 보충 / 연속 deck reveal / 뻑 floor 부착 / 둘 다 획득4피 / 보너스 단독 탈취 없음.

보안: 서버가 클라이언트 player 값을 덮어씀, 현재 turn/phase/소유권 검증, 중복 sequence 상태불변, 오래된 version 거절, 이전 round 거절, 무효 token 거절. 각 projection에 상대 hand/future deck 없음. 정상적인 흔들기는 선언한 세 장만 공개되므로 그 세 장은 더 이상 숨김 정보가 아니다.

## 수동 브라우저 확인

화투 교체 후 Marcus Richert 원본 48장의 광/열끗/띠/피와 한국식 11월 오동·12월 비 대응을 contact sheet로 확인했다. Chromium/WebKit 4개 크기의 E2E 10개와 빌드·타입 검사 모두 통과했다. production PWA는 WebP 48장 캐시를 확인하고 오프라인 재로딩 후 손패 10장의 실제 이미지 로딩과 패 내기를 검증했다. 모바일 화면 검증은 총통으로 즉시 끝나는 무작위 분배를 피하도록 테스트 context에 고정 RNG를 사용한다.

Codex 내장 브라우저 390×844에서 홈, 실제패 기본 속도의 내 패 내기/덱 뒤집기/회수/CPU 응답을 확인. 5개 필수 영역과 손패 10장이 모두 보이고 scrollHeight=844. 확대/설정/선 marker/상대 뒷면 장수 표시 확인. JavaScript error 로그 없음.

## 출시 전 실기기 QA — 미확인

- iPhone Safari / 홈 화면 standalone: 노치 safe area, 동적 주소창, audio unlock, Web Share, 길게 누르기, 확대/VoiceOver.
- Android Chrome / 홈 화면 설치: navigation bar, 진동/소리 토글, TalkBack.
- 실제 스마트폰 두 대에서 Wi-Fi ↔ LTE 전환, 백그라운드/전화 수신 후 복구, 장시간 대기.
- 작은 기기에서 광/열끗/띠/피 그림을 실제 화투 사용자들이 구별하는지; Marcus Richert 원본 화투 디자인 시인성 검토.
- 가장 많은 바닥패/획득패, 여러 폭탄, 고 횟수, orientation 복귀, 큰 OS 글자 설정.
- 한게임 실제 2026 맞고 앱의 세부 동작과 RULES.md의 명시적 해석(선고르기, 동시총통, 고박, 마지막 특수 예외)을 비교 확인.
- production TLS/WS proxy, FRONTEND_ORIGIN, 다중 기기 접속, 서버 재시작 운영 대응.

## 알려진 운영 한계

MemoryRoomStore는 서버 재시작을 넘어서 보존하지 않는다. 한 프로세스/한 replica 기준. 끊긴 방은 모두 끊어진 시점부터 30분 유지. 장기 영속/다중 replica는 저장소/adapter/원자 업데이트 추가 필요. 인터넷 서비스로 실제 배포하거나 실기기 상용 품질을 인증한 상태는 아니다.
