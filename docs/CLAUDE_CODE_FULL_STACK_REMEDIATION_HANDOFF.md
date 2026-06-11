---
id: focus-feed-claude-code-full-stack-remediation-handoff
date: 2026-06-11
tags: [focus-feed, claude-code, security, network, billing, scalability, handoff]
---

# Focus Feed 전체 스택 개선 - Claude Code CLI Handoff

이 문서는 `docs/FOCUS_FEED_FULL_STACK_AUDIT_2026-06-11.md`의 진단을
Claude Code CLI가 작은 배포 단위로 해결하도록 만든 실행 프롬프트다.

UI/PWA 세부 수용 기준은 `docs/CLAUDE_CODE_QA_REMEDIATION_HANDOFF.md`도 함께 참고한다.

## 사용 방법

저장소 루트에서 Claude Code CLI를 실행하고 아래 마스터 프롬프트를 전달한다.
한 세션에서 전부 수정하지 않는다. 권장 세션 분리 표에 따라 Phase 단위로 진행한다.

## 마스터 프롬프트

```text
당신은 Focus Feed 저장소의 시니어 Next.js 보안·플랫폼·제품 엔지니어다.

작업 위치:
C:\Users\백요한\OneDrive\바탕 화면\Yohan_Workspace\Youtube-Summary

최종 목표:
2026-06-11 전체 스택 감사에서 확인된 데이터 노출, 인증·팀 권한, 취약 의존성,
외부 API 비용·장애 전파, Stripe 무결성, PWA·모바일 UX, 개인정보·운영 격차를
작은 배포 단위로 해결한다.

반드시 먼저 읽을 문서:
1. AGENTS.md
2. docs/FOCUS_FEED_FULL_STACK_AUDIT_2026-06-11.md
3. docs/CLAUDE_CODE_QA_REMEDIATION_HANDOFF.md
4. docs/MILESTONES.md
5. docs/PRD.md
6. docs/DEPLOYMENT_CHECKLIST.md
7. docs/DATA_PROTECTION.md
8. CLAUDE.md

절대 규칙:
- 사용자가 명시적으로 요청하지 않았으므로 git commit/push를 하지 않는다.
- .env.local과 비밀값을 출력·수정·커밋하지 않는다.
- 현재 worktree에는 다른 사용자/에이전트의 미커밋 변경이 있다.
  시작 시 `git status --short`, 대상 파일마다 `git diff -- <file>`을 확인하고 보존한다.
- 관련 없는 리팩터·파일 이동·전체 포맷 변경을 하지 않는다.
- 보안 결함을 UI에서 숨기는 방식으로 해결하지 않는다.
- Service Role을 사용하는 모든 변경 경로는 내부에서 현재 사용자와 권한을 재검증한다.
- migration은 반복 실행 가능하고 롤백/데이터 처리 계획을 포함해야 한다.
- 실제 운영 Stripe 결제, 사용자 삭제, 대량 DB 변경을 실행하지 않는다.
- 각 Task는 가능한 한 1~4개 코드 파일과 1개 migration/test 묶음에 제한한다.
- 각 Phase 종료 시 변경 파일, 검증 결과, 남은 위험, 운영자 작업을 보고한다.

감사 기준선:
- 익명 `POST /api/playlists/save`가 실제 200과 DB ID를 반환했다.
- Supabase anon REST로 playlists, summaries, trend_cache 실제 행이 조회됐다.
- 감사 중 생성한 audit-probe 데이터는 삭제 완료됐다.
- 현재 Supabase에는 teams, team_members, team_invites가 없다.
- 제공된 003_teams.sql은 팀 테이블 RLS를 활성화하지 않는다.
- 로컬 프로덕션 응답에 주요 보안 헤더가 없다.
- `npm audit --omit=dev`: moderate 4, high 1, critical 1.
- 현재 next는 16.1.6이며 npm audit의 안전 업데이트 후보는 16.2.9다.
- protobufjs 7.5.4, ws 8.19.0 등 전이 취약점이 있다.
- YouTube/Gemini 키는 감사 당시 만료돼 실제 요청이 400으로 실패했다.
- lint, unit, build는 감사 전 기준선에서 통과했지만 unit 1개, E2E 2개뿐이다.

진행 순서:
Phase 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

Phase 0~5의 P0/P1을 완료하기 전 Phase 10 기능 확장을 구현하지 않는다.

==================================================
Phase 0. 기준선 고정과 긴급 차단
==================================================

목표:
기존 변경을 보존하고, 공개 데이터·외부 쓰기·비용 공격 표면을 우선 차단한다.

Task BASE-01 - 변경 경계 기록
- `git status --short`
- `git diff --stat`
- 이번 Phase 대상 파일의 개별 diff 확인
- artifacts와 scripts/ux-audit.mjs는 감사 산출물로 보존

완료 기준:
- 기존 변경과 이번 변경의 경계가 Phase 보고에 명시됨.

Task BASE-02 - 실패를 재현하는 최소 테스트 먼저 추가
대상 후보:
- e2e/security-boundaries.spec.ts
- src/lib 내부 권한·경로 유틸 test

최소 테스트:
- 익명 playlist save -> 401
- 익명 playlist 목록 -> 로그인 안내, DB 데이터 비노출
- `//evil.example`, `\\evil`, absolute URL -> `/` 폴백
- Notion sync 비권한 호출 -> 거절

주의:
- 운영 데이터 mutation으로 테스트하지 않는다.
- Supabase test project가 없으면 route/unit mock으로 먼저 고정한다.

Task BASE-03 - 임시 기능 차단
정식 수정 전 노출을 막아야 할 경우에만 최소 feature flag를 사용한다.

대상:
- 익명 서버 playlist 저장
- 공유 Notion 자동 동기화
- 공개 trend force refresh
- 프로덕션 Notion health/debug endpoint

정책:
- 기본값은 안전한 비활성.
- 환경 변수가 없으면 외부 쓰기·진단 API가 열리지 않아야 한다.
- feature flag는 영구 권한 검사의 대체물이 아니다.

검증:
- npm run lint
- 관련 unit/route tests

==================================================
Phase 1. 플랫폼 의존성과 HTTP 보안
==================================================

Task PLAT-01 - Next.js 보안 업데이트
대상:
- package.json
- package-lock.json

구현:
- `next`와 `eslint-config-next`를 호환되는 보안 수정 버전으로 함께 갱신.
- 감사 당시 npm 제안은 16.2.9였지만 작업 시점 `npm audit` 결과를 다시 확인.
- `npm audit fix --force`는 사용하지 않는다.
- Next release note의 Proxy/App Router 변경을 확인하고 src/proxy.ts 회귀 테스트.

완료 기준:
- Next 관련 high 권고가 제거됨.
- 앱 라우트, server action, proxy, image가 build/E2E에서 정상.

Task PLAT-02 - 전이 취약점 제거
대상:
- @google/genai
- @supabase/supabase-js
- lockfile

구현:
- protobufjs, @protobufjs/utf8, ws, brace-expansion의 안전 버전 유입 경로를 확인.
- 먼저 직접 상위 패키지의 호환 minor/patch 업데이트를 시도.
- overrides는 상위 패키지 호환성을 테스트할 수 있을 때만 사용.

완료 기준:
- `npm audit --omit=dev`에 critical/high 0.
- 남는 moderate는 실제 도달 가능성과 후속 계획을 문서화.

Task PLAT-03 - CI dependency gate
대상:
- .github/workflows/ci.yml
- package.json 또는 scripts

구현:
- 프로덕션 high/critical에서 실패하는 audit 단계 추가.
- 네트워크 일시 오류와 실제 취약점 실패를 구분.
- Dependabot/Renovate 도입은 저장소 정책에 맞을 때 별도 PR 단위.

Task PLAT-04 - 보안 헤더
대상:
- next.config.ts
- 필요 시 CSP helper/test

헤더:
- Content-Security-Policy
- Strict-Transport-Security(프로덕션 HTTPS)
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Permissions-Policy
- frame-ancestors 또는 X-Frame-Options

주의:
- YouTube iframe, Supabase OAuth, Stripe redirect, Next runtime을 깨지 않도록 report-only로 관찰 후 강화 가능.
- inline script nonce를 즉흥 구현하지 않는다.

검증:
- npm run lint
- npm run build
- npm run test:e2e
- 로컬 프로덕션 헤더 스모크

==================================================
Phase 2. 데이터 경계·플레이리스트·RLS
==================================================

Task DATA-01 - playlist 로그인·소유권 강제
대상:
- src/app/api/playlists/save/route.ts
- src/app/actions/playlists.ts
- src/app/playlists/page.tsx
- 관련 클라이언트

구현:
- 서버 저장·조회·이름 변경·삭제는 로그인 사용자만.
- client가 전달한 userId를 신뢰하지 않음.
- Service Role mutation은 `.eq("user_id", currentUser.id)` 포함.
- rename/delete 서버 액션 내부에서 cookies 세션을 다시 확인.
- 비로그인 라디오 큐는 브라우저 메모리/로컬 전용으로 유지.

완료 기준:
- 익명 save 401.
- 익명 목록은 전역 null 행을 표시하지 않음.
- 사용자 A가 사용자 B playlist를 조회·수정·삭제할 수 없음.

Task DATA-02 - RLS migration
새 migration 예:
- docs/supabase-migrations/005_security_rls_hardening.sql

정책:
- playlists: auth.uid() = user_id인 본인 행만 CRUD.
- summaries: 브라우저 직접 DB 접근이 필요 없으면 RLS 활성화 후 client policy 없음.
- trend_cache: 브라우저 직접 DB 접근이 필요 없으면 RLS 활성화 후 client policy 없음.
- Service Role 서버 경로만 우회.

주의:
- 기존 user_id IS NULL playlist를 먼저 격리·백업·삭제할 운영 SQL을 별도 구간으로 작성.
- 자동으로 임의 사용자에게 귀속하지 않는다.
- 데이터 정리 전 user_id NOT NULL을 바로 적용하지 않는다.

Task DATA-03 - DB 제약과 최소 권한
구현:
- 정리 후 playlists.user_id NOT NULL 검토.
- playlist title/items 크기 정책.
- summaries.video_id unique 확인.
- trend_cache bucket unique 또는 단일 최신 행 전략.
- 공개 anon/auth GRANT와 RLS 조합을 문서화.

완료 기준:
- anon REST canary에서 playlists/summaries/trend_cache 데이터 0.
- Service Role 서버 기능은 정상.

Task DATA-04 - 입력 스키마와 크기 제한
대상:
- playlist, bookmark, custom-source, team API
- server actions의 videoId/title/goals

구현:
- 저장소에 새 검증 라이브러리를 넣기 전 기존 패턴을 확인.
- YouTube video/channel ID 형식, title/name 길이, 배열 개수, category allowlist 검증.
- custom source import 파일/JSON 크기와 총 채널 수 상한.
- cookie budget은 문자열 길이가 아니라 UTF-8 byte 기준.
- raw DB error를 사용자 응답에 반환하지 않음.

검증:
- boundary unit tests
- 413/400 route tests

==================================================
Phase 3. 인증·팀·권한 불변식
==================================================

Task AUTH-01 - same-origin 내부 경로 sanitizer
대상:
- src/app/auth/callback/route.ts
- src/app/auth/callback/client/page.tsx
- src/app/login/LoginForm.tsx
- src/lib/safe-redirect.ts + test

정책:
- 정확히 한 개 `/`로 시작하는 내부 path만 허용.
- `//`, backslash, scheme, control character 거부.
- URL query는 보존하되 origin 변경 불가.

Task AUTH-02 - Supabase 세션 프록시 강화
대상:
- src/proxy.ts

구현:
- SDK 쿠키 포맷 직접 파싱 의존을 최소화.
- getUser timeout/error 시 전체 사이트 500이 되지 않는 fail-safe.
- 민감 라우트의 실제 인증은 route/action의 getUser/RLS가 담당.
- Next 보안 업데이트 후 segment-prefetch 우회 회귀 테스트.

Task AUTH-03 - 재검증 API origin 검증
대상:
- src/app/api/revalidate/route.ts

구현:
- Referer는 `new URL(referer).origin === request.nextUrl.origin`으로 비교.
- 프로덕션에서는 secret 우선.
- 사용자 UI 새로고침은 별도 same-origin 인증된 경로 또는 server action 검토.

Task TEAM-01 - 팀 스키마/RLS 배포 가능 migration
대상:
- docs/supabase-migrations/003_teams.sql 또는 후속 migration

구현:
- teams, team_members, team_invites RLS 활성화.
- team_members의 본인 membership 조회 정책.
- teams 직접 client 접근이 필요하면 membership 기반 select.
- team_invites는 Service Role 전용.
- 정책 재귀를 피하고 API 권한 검사와 역할을 명확히 분리.

완료 기준:
- 현재 연결 Supabase에 적용 전 수동 SQL 체크리스트.
- 적용 후 verify:supabase 통과.
- anon 직접 조회 차단.

Task TEAM-02 - 안전한 초대 수락
대상:
- invite route
- join page
- 새 POST accept route 또는 server action
- migration/RPC

구현:
- GET은 초대 정보 표시만 하고 mutation 금지.
- 명시적 “가입” POST에서 로그인 이메일과 invite.email 일치 확인.
- raw token 대신 token hash 저장을 검토.
- 만료·사용 여부·멤버 insert·invite consume을 한 DB transaction/RPC로 처리.
- 로그인 redirect에도 AUTH-01 sanitizer 적용.

Task TEAM-03 - 소유자 불변식
대상:
- team members route
- DB RPC/constraint 가능성 검토

정책:
- admin은 owner를 제거·강등할 수 없음.
- 마지막 owner 제거·강등 금지.
- owner 이전은 명시적 transaction.
- 자기 나가기는 별도 leave endpoint.

Task TEAM-04 - 팀 브리핑 제품 의미 정리
결정:
- 팀 공용 소스와 팀 사용량을 만들거나,
- 현재 기능을 “팀 목표를 사용한 개인 브리핑”으로 정확히 이름·문서화.

테스트:
- invite email mismatch
- expired/reused token
- last owner invariant
- cross-team member ID
- team table missing/degraded state

==================================================
Phase 4. 외부 연동·AI·네트워크·비용
==================================================

Task EXT-01 - Notion 쓰기 권한
보수적 기본 정책:
- 사용자별 Notion OAuth가 아직 없으므로 공유 token 경로는 owner 전용.
- 비owner/비로그인 호출 거절.
- 재생 완료 자동 동기화는 기본 비활성 또는 제거하고 명시적 사용자 동의 사용.
- PRD의 Notion 상태와 코드를 일치.

추가:
- videoId/title/hint 검증.
- idempotency key로 중복 페이지 방지.
- Notion API 실패 시 부분 생성된 RESOURCE/SUMMARY 상태를 추적.

Task EXT-02 - 공개 비용·진단 API 보호
대상:
- youtube resolve-channel
- notion health
- debug-youtube
- trend refresh

정책:
- resolve-channel은 캐시 + 사용자/IP rate limit + 채널 총량 제한.
- Notion health/YouTube debug는 dev 또는 ops secret 전용.
- 오류 본문·DB ID·외부 서비스 내부 메시지를 공개하지 않음.
- trend force refresh는 owner/admin 또는 cron 전용.

Task EXT-03 - briefing cron 재설계
현재 문제:
- cron secret은 있으나 내부 action이 로그인 쿠키를 요구.

결정:
- owner system briefing이라면 명시적 system principal과 별도 사용량 정책.
- 사용자 briefing이라면 cron route 제거.
- 임의 goals query 길이 제한.

Task RATE-01 - 분산 레이트리밋
구현 선택:
- 기존 Supabase를 이용한 atomic RPC/table 또는 승인된 Redis/플랫폼 rate limit.
- 인스턴스 간 공유, TTL, user/IP key, retry-after 지원.
- 신뢰할 프록시 헤더 정책 정의.

Task RATE-02 - 원자적 사용량 예약
구현:
- check와 increment를 하나의 DB transaction/RPC로 합침.
- 요청 ID 기반 중복 차감 방지.
- 캐시 hit는 차감하지 않음.
- 외부 AI 실패 시 예약 해제 또는 실패도 사용량으로 보는 제품 정책을 문서화.

Task NET-01 - 공통 외부 요청 timeout
대상:
- YouTube/RSS/Gemini/Notion/Stripe/transcript

구현:
- 공급자별 합리적 timeout.
- 사용자 취소와 서버 timeout을 구분.
- idempotent GET만 제한적 retry + jitter.
- 결제/Notion write는 무작정 retry하지 않고 idempotency 사용.

Task NET-02 - fan-out과 응답 크기 제어
- 소스 fetch concurrency 제한.
- RSS Content-Length와 실제 읽기 byte 상한.
- XML parse 실패·대형 응답 격리.
- 사용자당 custom source 최대 수.
- import batch upsert와 부분 실패 보고.

Task NET-03 - 소스별 상태
- RSS도 ready/request_failed/timeout/invalid_content 상태 집계.
- source별 lastSuccessAt, lastError를 UI에 노출할 최소 모델 설계.
- 모든 소스 실패와 일부 실패를 구분.

Task AI-01 - 비용 예산
- 사용자 동작당 최대 모델 호출 횟수 명시.
- 품질 재생성 횟수를 환경/플랜별 제한.
- 모델 latency, input/output token, 재생성 횟수 metric.

Task AI-02 - untrusted content와 출력 검증
- 프롬프트에 외부 콘텐츠가 명령이 아닌 데이터임을 명시하고 구분자 사용.
- ranking/trend score 범위, 문자열 길이, 배열 크기 검증.
- raw 모델 응답 전체 로그 제거/마스킹.
- output token 상한과 timeout.

검증:
- timeout/retry unit tests
- distributed rate integration test
- 동시 10요청 사용량 테스트
- Notion/resolve/trend 비권한 테스트

==================================================
Phase 5. Stripe 결제 무결성
==================================================

Task BILL-01 - checkout 중복 방지
대상:
- checkout-session route
- user_plan schema

구현:
- 현재 plan과 기존 active/trialing subscription 확인.
- 이미 구독 중이면 새 checkout 생성 금지, portal로 안내.
- Stripe customer_id 저장.
- checkout session 생성에 사용자 기준 idempotency key.
- client UI뿐 아니라 API에서 강제.

Task BILL-02 - webhook 신뢰성
구현:
- stripe_event_id unique 테이블로 event idempotency.
- 모든 DB mutation error 확인. 실패 시 5xx로 Stripe retry 유도.
- subscription status에 따라 entitlement 계산.
- checkout/subscription/customer/user mapping 검증.
- refund에서 “첫 subscription” 추측 제거.
- PII 로그 최소화.

Task BILL-03 - 고객 포털·해지
구현:
- 인증된 billing portal session endpoint.
- 프로필에 “결제 관리/해지” 링크.
- portal 미설정 시 정확한 안내.
- 약관의 해지·환불 표현과 실제 동작 일치.

Task BILL-04 - Stripe 테스트
- Stripe 공식 fixture 기반 webhook tests.
- duplicate event
- DB failure -> 5xx
- canceled/unpaid/deleted status
- duplicate checkout
- 다른 사용자 subscription ID 주입

실제 카드 결제는 수행하지 않는다.

==================================================
Phase 6. PWA·모바일·접근성·표현
==================================================

Task PWA-01 - 서비스 워커 캐시
- navigation은 network-first + offline fallback.
- 정적 immutable asset만 cache-first.
- auth callback, login, pricing, profile, team, RSC payload, user page는 캐시 제외.
- cache.put 전 response.ok/type 확인.
- 명시적 cache version과 이전 캐시 정리.

Task PWA-02 - manifest와 아이콘
- app.webmanifest 하나를 canonical로 사용.
- 실제 정사각형 192/512 아이콘 참조.
- maskable 아이콘 검토.
- 잘못된 manifest.webmanifest 중복 제거 또는 redirect.

Task UX-01 - 공통 modal primitive
- body scroll lock
- 배경 inert/aria-hidden
- focus trap/restore
- Escape/overlay close
- 중첩 modal z-index 정책

Q&A, 모바일 메뉴, 라디오 drawer, 가사 modal을 같은 primitive에 맞춘다.

Task UX-02 - 모바일 하단 충돌
- Q&A와 라디오 footer가 동시에 있을 때 입력·버튼이 가리지 않음.
- safe-area-inset-bottom 반영.
- 360x800, 393x852, 430x932에서 검증.

Task UX-03 - 터치 타깃·필터
- 주요 interactive 최소 44x44.
- 필터/보기 전환은 좁은 화면에서 줄바꿈 또는 가로 스크롤.
- 클릭 가능한 텍스트와 아이콘의 accessible name 확인.

Task UX-04 - 모바일 탐색 parity
- teams, pricing, landing, profile/로그인 접근 경로를 데스크톱과 맞춤.
- 긴 source/category 링크 목록은 prefetch fan-out 측정 후 선택적 비활성.

Task UX-05 - 표현 품질
- RSS entity decode를 parse 경계에서 1회 수행.
- RSS 상태 표시.
- ThemeToggle 실제 노출.
- welcome/auth/connection 안내의 중복과 우선순위 정리.

상세 수용 기준:
docs/CLAUDE_CODE_QA_REMEDIATION_HANDOFF.md의 Phase 2~5 참고.

==================================================
Phase 7. 성능·확장성
==================================================

Task PERF-01 - YouTube quota 최적화
- avatar hydration과 feed avatar 조회 중복 제거.
- 채널 metadata cache를 단일 helper로 통합.
- source당 API 호출 수를 metric으로 기록.
- invalid/expired key는 반복 fan-out 전에 circuit open.

Task PERF-02 - 캐시 stampede·보존
- trend single-flight 또는 DB advisory/lock.
- trend_cache bucket unique upsert.
- 보존 기간과 cleanup.
- 홈/트렌드의 중복 feed 수집 감소.

Task PERF-03 - 링크 프리패치·RSC 비용
- 모바일/데스크톱 메뉴의 대량 링크 prefetch를 측정.
- 긴 동적 목록에는 `prefetch={false}` 적용 여부를 데이터로 결정.
- 단일 클릭 navigation은 정상 유지.

Task PERF-04 - 자산 최적화
- OG 이미지를 1200x630 근처, 합리적 용량으로 재인코딩.
- 192/512 아이콘을 실제 크기로 생성·압축.
- 미사용 중복 이미지를 참조 검색 후 제거.
- visual regression 확인.

Task PERF-05 - 데이터 증가 대응
- bookmarks/playlists/teams 목록 pagination.
- feed 500개 전체 hydration 비용 측정.
- 필요 시 virtualized list는 별도 Phase로 분리.
- trend_cache와 audit/event 테이블 인덱스 확인.

성능 완료 기준:
- 외부 공급자가 느려도 응답 상한이 존재.
- source 수 증가 시 무제한 동시 호출이 없음.
- asset budget과 API quota budget이 문서화됨.

==================================================
Phase 8. 개인정보·계정 수명주기
==================================================

Task LEGAL-01 - 데이터 흐름 문서
대상:
- privacy page
- PRD
- DATA_PROTECTION

반영:
- Gemini로 전송되는 자막/제목/피드/목표/Q&A
- Notion으로 전송되는 분석과 사용자 맥락
- localStorage의 목표/Q&A/요약/시청 기록
- Supabase/Stripe/Google/Notion 처리 목적과 보유 정책
- 실제 법률 검토가 필요한 표현은 운영자 확인 항목으로 분리

Task ACCOUNT-01 - 계정 데이터 내보내기
- bookmarks, playlists, custom sources, goals 등 범위 결정.
- 서버 데이터와 localStorage 데이터를 구분.
- JSON export 스키마 version.
- 다른 사용자의 팀 데이터 제외.

Task ACCOUNT-02 - 계정 삭제
- 재인증/명시적 확인.
- Stripe 활성 구독 처리 순서.
- 팀 sole owner 처리.
- Supabase auth user와 연결 데이터 삭제.
- localStorage/sessionStorage/cache/service worker 데이터 삭제 UI.
- 비동기 삭제면 상태와 재시도 설계.

Task LEGAL-02 - 약관·제품 약속 정합성
- “언제든 해지”, “설정에서 탈퇴” 등 실제 미구현 문구를 기능과 맞춤.
- Pro “무제한”의 fair-use/rate limit 표현 결정.
- AI 결과 한계와 외부 콘텐츠 책임 문구 검토.

==================================================
Phase 9. 관측성·테스트·배포 운영
==================================================

Task OBS-01 - 구조화 로그와 redaction
- request ID/correlation ID.
- route, provider, status, latency, retry만 기록.
- token, cookie, raw model output, 외부 오류 body, user email/ID 로그 최소화.
- dev/prod 로그 레벨 분리.

Task OBS-02 - 핵심 지표
- feed provider 성공률/latency
- YouTube quota 추정
- Gemini 호출/재생성/실패/비용 추정
- Stripe webhook lag/failure
- auth callback failure
- PWA update/cache error

Task OPS-01 - health/readiness 분리
- 공개 liveness는 민감 정보 없이.
- ops readiness는 secret 보호.
- 외부 공급자 전체 점검은 비용·rate를 고려해 캐시.
- 테이블 오류 메시지 직접 노출 금지.

Task OPS-04 - Supabase 검증 강화
대상:
- scripts/verify-supabase-schema.mjs
- 별도 SQL/check 문서

검증 항목:
- table/column existence
- NOT NULL/unique/index
- RLS enabled
- 필요한 policy
- anon canary가 개인 데이터 0건
- atomic usage/team invite RPC

Service Role 조회 성공만으로 통과시키지 않는다.

Task TEST-01 - unit/route
- safe redirect
- playlist ownership
- input bounds
- usage atomicity
- role invariant
- provider error classification
- RSS entity/status

Task TEST-02 - E2E 프로젝트
- Desktop Chromium
- Mobile Chrome
- 가능하면 Mobile Safari/WebKit

시나리오:
- 익명 핵심 페이지
- 모바일 menu/modal/Q&A/radio
- PWA manifest/SW
- playlist auth boundary
- no horizontal overflow
- 44px touch target 핵심 목록

Task TEST-03 - 인증·외부 연동 계약 테스트
- 실제 Google OAuth를 CI에서 자동 결제/로그인하지 않음.
- Supabase test project/storageState가 있으면 별도 protected job.
- Stripe fixture, Notion/Gemini/YouTube mock contract.

Task TEST-04 - CI gate
필수:
- npm ci
- lint
- unit
- build
- E2E desktop/mobile
- production dependency audit

선택/보호 job:
- Supabase schema/RLS
- external integration smoke

최종 배포 체크:
- npm run lint
- npm run test:unit
- npm run build
- npm run test:e2e
- npm test
- npm run verify:supabase
- npm audit --omit=dev

==================================================
Phase 10. 안정화 후 제품 확장
==================================================

주의:
이 Phase는 P0/P1과 결제·계정 수명주기가 완료된 뒤 PRD 결정부터 한다.

Task PROD-01 - 소스 온보딩·건강 상태
- 추천 소스 템플릿
- URL/handle 검증 미리보기
- 마지막 동기화, 실패 이유, 재시도
- 사용자별 source cap과 quota 설명

Task PROD-02 - 선택적 기기 간 동기화
- 목표, 키워드, Q&A, 시청 기록별 opt-in.
- local-only와 cloud-sync를 명확히 표시.
- 충돌 해결과 export/delete 포함.

Task PROD-03 - 검색·저장된 보기
- 서버 검색 인덱스 또는 제한된 최근 피드 검색.
- source/category/keyword/date 조합 저장.
- pagination/cursor 기반.

Task PROD-04 - 팀 협업
- 팀 공용 source
- 팀 plan/usage
- invite revoke/list
- role audit log
- shared briefing snapshot

Task PROD-05 - 알림·다이제스트
- 이메일/웹 푸시 opt-in
- 빈도·quiet hours
- unsubscribe
- 동일 콘텐츠 중복 방지

Task PROD-06 - 개인 연동
- 사용자별 Notion OAuth
- 명시적 export 대상 선택
- Todoist OAuth 여부는 별도 제품 결정
- PWA 안정화 후 네이티브 래퍼 ROI 평가

Phase 10 결과는 구현 전에 PRD/MILESTONES의 새 마일스톤과 수용 기준으로 먼저 작성한다.

==================================================
최종 보고 형식
==================================================

1. 해결한 P0/P1
2. Phase/Task별 변경 파일
3. migration과 운영 DB 적용 순서
4. 자동 테스트와 실제 브라우저 검증
5. dependency audit 전후
6. 보안·성능·비용 지표 전후
7. 운영자가 해야 할 외부 작업
8. 남은 위험과 Phase 10 제품 결정
9. git status 요약

절대 하지 말 것:
- 비밀값 출력·교체·커밋
- 기존 미커밋 변경 되돌리기
- 승인 없는 commit/push
- 운영 사용자 데이터로 파괴적 보안 테스트
- 실제 카드 결제
- audit fix --force
- 테스트를 약화해 외부 API 장애를 숨기기
- 모든 Phase를 한 거대한 변경으로 합치기
```

## 권장 Claude Code 세션 분리

| 세션 | 범위 | 종료 조건 |
|---:|---|---|
| 1 | Phase 0 | 실패 테스트와 긴급 차단, 기존 변경 보존 확인 |
| 2 | Phase 1 | high/critical audit 0, build/E2E 통과 |
| 3 | Phase 2 | playlist ownership + RLS migration + anon canary |
| 4 | Phase 3 | redirect/team invite/owner invariant 테스트 통과 |
| 5 | Phase 4 | Notion·비용 API 보호, atomic usage, timeout |
| 6 | Phase 5 | Stripe fixture 전체 통과, portal 경로 |
| 7 | Phase 6 | PWA + 360/393/430 모바일 수용 기준 |
| 8 | Phase 7 | quota·latency·asset budget 확인 |
| 9 | Phase 8 | privacy/account export/delete 설계·구현 |
| 10 | Phase 9 | CI, RLS 검증, 관측성, 최종 회귀 |
| 11 | Phase 10 | PRD 승인된 기능만 별도 구현 |

## 운영자 승인/수동 작업

Claude Code가 코드만으로 완료할 수 없는 작업:

1. 만료된 YouTube Data API 키와 Gemini 키 교체.
2. Supabase migration의 운영 DB 적용과 null playlist 처리 결정.
3. Stripe Customer Portal 설정과 테스트 모드 webhook 확인.
4. 개인정보처리방침·약관의 법률 검토.
5. 실제 Google OAuth, Stripe 테스트 결제, iOS Safari PWA 검증.
6. 외부 관측성·분산 레이트리밋 공급자 도입 시 계정/비용 승인.

