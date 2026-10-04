# Production readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; implement and verify sequentially.

**Goal:** Resolve audit findings 1, 4–11 without changing code-only admission or trusted-host gameplay (findings 2, 3 explicitly accepted by user).

**Architecture:** Preserve Vercel + free Firebase RTDB. Bound room ownership and action storage with Rules; keep host transactions. Fix client failure barriers, engine turn continuation, persistent history transactions, and version-consistent PWA caches. Gate deployments with tests and configuration validation.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Firebase RTDB / Vitest / Playwright.

**Spec:** User's 2026-10-04 production audit and instruction to implement all findings except 2 and 3. This document records the concrete implementation decisions.

## Global constraints
- Four-digit rooms, anonymous authentication, trusted host, no paid scheduled functions.
- One active owned room per UID; 10-second creation cooldown. Existing own room may be resumed; new allocation must not bypass quota by deleting its index.
- One bounded pending action per participant; preserve sequence receipts and deduplication across tabs.
- Existing history migrated once without losing accumulated totals; reset and saves must serialize.
- Keep old running tabs working while updating offline shell. Never clear another app's caches.
- Prepare reviewable Rules and rollout instructions before production deployment; do not deploy incompatible client before Rules.

## Review focus
- Colliding room claims, reservation interruption, same UID multiple tabs.
- Offline writes completing after timeout, and errors during presentation.
- Manual versus end-of-turn chrysanthemum Go decisions.
- Concurrent history reset/save plus blocked/unsupported local persistence.
- Two different Next builds during worker upgrade and offline reload.

## Tasks and checks

### 1. Bound requests and isolate invalid queue entries (audit 1, 4)
Files: database.rules.json, src/multiplayer/{firebase-transport,host}.ts, new request validation helper, firebase-tests and tests/firebase-host.test.ts.
- [x] RED: reject fractional sequences, unknown/oversized fields and non-mailbox writes; malformed legacy request cannot block valid request.
- [x] Implement one `actions/{uid}/pending` mailbox; immutable same sequence, monotonic replacements; validate exact bounded action fields in Rules and host.
- [x] GREEN: Firebase Rules and transport tests, host tests.

### 2. Bound room ownership (audit 1)
Files: database.rules.json, firebase-transport.ts, new room allocation helper if useful, firebase-tests.
- [x] RED: second active room denied; index deletion/cooldown bypass denied; concurrent allocations yield one owner; expired/deleted rooms can be replaced after cooldown.
- [x] Implement `roomOwners/{uid}` durable reservation with code/createdAt/expiresAt. Room creation requires matching reservation. Keep 24-hour expiry and lazy cleanup.
- [x] GREEN: room lifecycle and collision tests. Document rollout/legacy-client refresh.

### 3. Make write timeout end the UI operation (audit 5)
Files: firebase-transport.ts, transport tests.
- [x] RED: disconnect between connectivity check and transaction; action rejects within deadline before reconnect.
- [x] Cover transaction + receipt with deadline; handle eventual write rejection/receipt without unhandled promises or duplicate application.
- [x] GREEN: timeout/reconnect/dedup tests.

### 4. Acknowledge recovered presentations (audit 8)
Files: MatgoApp.tsx, e2e recovery test.
- [x] RED: inject rendering failure; both players must regain ability to act without reload.
- [x] Share success/recovery readiness completion for current generation, preserving required floor choices.
- [x] GREEN: two-player recovery test.

### 5. Continue the correct turn after manual chrysanthemum Go (audit 6)
Files: game-engine/{types,engine}.ts, tests/kukjin.test.ts, e2e/go-stop.spec.ts, docs/RULES.md.
- [x] RED: manual conversion + Go retains current player/hand/deck; end-turn conversion + Go advances once.
- [x] Track decision origin; clear it after decision. Stop remains immediate. Older snapshots default to end-turn behavior.
- [x] GREEN: engine invariants, complete-game simulations, both Go paths.

### 6. Serialize history persistence (audit 11)
Files: new src/lib/history-store.ts, MatgoApp.tsx, history tests/E2E.
- [x] RED: two contexts finishing simultaneously preserve both records/totals; reset interleaving is ordered; migrate legacy localStorage once.
- [x] Use IndexedDB readwrite transaction for authoritative records; notify tabs and retain localStorage as compatibility/read cache. Surface persistence failures.
- [x] GREEN: history migration, concurrency, reset, reload tests.

### 7. Atomic offline shell and bounded old cache retention (audit 7, 10)
Files: public/sw.js, register-pwa.ts, version-card-assets.mjs, new postbuild shell manifest generator, e2e-production/update.spec.ts.
- [x] RED: actual distinct shell/chunk sets; upgrade old open tab then offline reload must hydrate new shell; obsolete builds pruned while active clients remain supported.
- [x] Precache shell with exact required JS/CSS before activation; separate build identity from card asset version; retain current + previous shell generations and safely support active old tabs.
- [x] GREEN: PWA offline install/update tests and cache-bound test.

### 8. Release gates and configuration validation (audit 9)
Files: package.json, scripts/validate-env.mjs, .github/workflows/ci.yml, README.md, docs/FIREBASE.md.
- [x] RED: missing/mismatched production Firebase config fails prebuild; emulator paths remain usable for tests.
- [x] CI: install locked dependencies, Java 21, typecheck/unit/Rules tests, browser tests, production build/PWA tests; document required GitHub checks.
- [x] Document exact Rules/client deployment order, accepted security model, remaining account-wide anti-abuse limits.
- [x] GREEN: validator tests and complete release commands.

### 9. Final review and delivery
- [x] Review aggregate diff against exclusions 2 and 3; test all relevant suites/build; no changes to production DB for testing.
- [x] Commit coherent steps; determine available Firebase deployment credentials. Firebase CLI unavailable: provide final exact Rules and stage frontend pending user's Console publication.
- [x] Report completed steps, actual test evidence, rollout state and any remaining external configuration.

## Progress / rulings
- Starting point: 2eede79, clean working tree. Existing audit probes in /tmp are evidence; production source unchanged.
- Ruling: user requested plan AND implementation in sequence; proceed inline without a redundant plan approval stop.
- Ruling: use a feature branch to avoid an automatic Vercel production deployment before Rules are ready.

- 2026-10-04 implementation checkpoint: Tasks 1–6 implemented. Unit tests 93 passed; Rules/transport 11 passed before adding concurrent allocation case; animation recovery + Go UI passed after correcting test to assert only current actor canPlay; native IndexedDB concurrency/reset/migration tests passed.
- Task 7: exact offline HTML/assets manifest and build-versioned worker implemented; two production PWA tests passed including a distinct second-build script loaded offline. Added obsolete-cache count assertion for final run.
- Task 8: production configuration guard, release-checks workflow and Rules-first rollout docs added. Production branch not published.
- Ruling: room-code collisions after a committed reservation require a 10-second retry instead of changing an unconsumed reservation's code. This keeps the server cooldown unambiguous and closes rapid reservation reassignment; cost is a rare retry message.
- Ruling: retained this plan as the progress ledger rather than adding a second scratch ledger; task evidence and decisions remain reviewable in the same file.
- Ruling: PWA update test uses real built Next HTML/chunks plus a distinct required script/HTML for the next deployment, instead of rebuilding Next twice; this exercises missing-new-chunk failure while keeping test runtime low.

- Final fixes: closed-room reactivation bypass reproduced in emulator, then blocked by terminal status validation. Late failure of an expired write no longer rejects its newer same-sequence retry (RED→GREEN). Malformed legacy action containers can be removed by the host (RED→GREEN).
- Final PWA fix: manifest/shell rollout race reproduced against the actual worker; installation now checks HTML SHA-256 before activation (RED→GREEN). Hashed Next assets match deployment query variants; production tests also exercise NEXT_DEPLOYMENT_ID.
- Verification: 95 unit tests; 14 Firebase Rules/transport tests; 61 Chromium/WebKit scenarios; 2 production PWA scenarios; typecheck and production build. Native history concurrency and recovery tests are included in those suites.
- Independent reviewer supplied two reproduced findings (terminal room closure and shell hash race), both fixed. Reviewer then stopped due to workspace credits; remaining aggregate review was performed directly. No unresolved known Critical/High findings from this review; this is not a guarantee against undiscovered defects.
- Ruling: retain existing authorization to upload repository changes, but keep changes on codex/production-readiness until Rules publication. Firebase CLI has no logged-in account, so Console publication and production smoke test remain external rollout steps. Do not merge main automatically.
- Ruling: no second scratch-ledger/brief system was created; this document is the durable plan and evidence record. No cost to runtime behavior; less automated skill bookkeeping.
- Delivery: implementation and local validation complete; commit/push feature branch. User must publish the linked complete Rules before main deployment; CI required-check settings must be enabled in GitHub.
- Production rollout follow-up: Vercel Next 16 adapter stores the home prerender under `server/route-cache/APP_PAGE/<source hash>/$/index.html`, unlike standalone output. Added fallback using the installed Next route-cache convention and regression tests for both layouts. Confirmed a real `NEXT_ADAPTER_PATH` build succeeds before redeploying. Firebase Rules are already published by the user.
- Production artifact follow-up: existing public/sw.js is snapshotted before the postbuild script by Vercel, while newly generated shell files are collected afterward. Moved worker identity generation to prebuild; postbuild only consumes that identity. Regression tests assert worker bytes remain unchanged and manifest identity matches. Unit 97/97 and PWA 2/2 passed after correction.
