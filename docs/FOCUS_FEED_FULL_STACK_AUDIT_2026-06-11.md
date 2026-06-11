---
id: focus-feed-full-stack-audit-2026-06-11
date: 2026-06-11
tags: [focus-feed, audit, security, network, engineering, ux, scalability]
---

# Focus Feed 전체 스택 감사 보고서

이 문서는 2026-06-11 기준 실제 브라우저 사용, 로컬 프로덕션 HTTP,
Supabase 공개 anon 경계, 의존성 취약점, 정적 코드 검토를 합친 진단이다.

구현 지시는 `docs/CLAUDE_CODE_FULL_STACK_REMEDIATION_HANDOFF.md`를 따른다.

## 1. 감사 범위와 증거

### 실제 실행

- 데스크톱과 모바일(393x852)에서 홈, 트렌드, 랜딩, 로그인, 요금제,
  북마크, 플레이리스트, 개인정보, 약관을 실제 탐색했다.
- 모바일 메뉴, Q&A, 필터, 라디오 관련 상호작용과 터치 크기, 오버플로,
  콘솔·네트워크 오류를 수집했다.
- `next start` 로컬 프로덕션 서버에서 응답 헤더와 익명 API를 확인했다.
- 감사 중 만든 `audit-probe` 플레이리스트 1건은 정확한 ID 조건으로 삭제했다.

### 데이터·보안 경계

- Supabase 공개 anon 키로 레코드 내용은 출력하지 않고 테이블별 익명 조회 여부만 확인했다.
- `npm run verify:supabase`로 현재 연결된 스키마의 필수 테이블 존재 여부를 확인했다.
- `npm audit --omit=dev`로 프로덕션 의존성 취약점을 확인했다.

### 코드 검토

- 인증 콜백, 서버 액션, API 라우트, Service Role 사용 경로, 팀 초대·권한,
  Stripe, Gemini, Notion, 피드 수집, 서비스 워커, CI, 개인정보 문서를 검토했다.

## 2. 즉시 결론

현재 상태는 공개 베타나 결제 사용자 확대 전에 P0/P1 보완이 필요하다.

| 우선순위 | 핵심 결론 |
|---|---|
| P0 | 익명 플레이리스트 저장과 Supabase REST 직접 조회가 실제로 가능하다. |
| P0 | `next@16.1.6`과 전이 `protobufjs@7.5.4`에 high/critical 권고가 있다. |
| P0 | 팀 테이블은 현재 Supabase에 없고, 제공된 팀 migration은 RLS를 켜지 않는다. |
| P0/P1 | 공유 Notion DB 쓰기 액션에 호출자 권한 검사가 없고 자동 쓰기도 존재한다. |
| P1 | 팀 초대 이메일 미검증, GET 가입 변경, 소유자 불변식 붕괴가 있다. |
| P1 | 사용량 카운터와 레이트리밋이 동시성·서버리스 환경에서 우회될 수 있다. |
| P1 | Stripe 중복 구독·웹훅 실패 누락·해지 포털 부재로 결제 상태가 어긋날 수 있다. |
| P1 | 외부 API 타임아웃·응답 크기·동시성 제한이 없어 장애가 전체 SSR을 지연시킬 수 있다. |
| P1 | 보안 헤더가 없고 인증 `next` 파라미터 검증이 약하다. |
| P1 | 개인정보처리방침·약관이 Gemini/Notion 전송, 탈퇴, 구독 해지 구현과 불일치한다. |

## 3. 런타임에서 확정된 항목

### SEC-01 익명 플레이리스트 데이터 노출

확정 증거:

- 비로그인 `POST /api/playlists/save`가 실제 `200`과 DB ID를 반환했다.
- 비로그인 `/playlists`에서 기존 `user_id IS NULL` 데이터가 브라우저 간 공유됐다.
- Supabase anon REST 조회에서 `playlists` 실제 행이 반환됐다.
- rename/delete 서버 액션은 `playlistId`만 조건으로 Service Role 변경을 수행한다.

영향:

- 다른 익명 사용자의 큐·제목·영상 ID가 노출될 수 있다.
- 서버 액션 ID를 얻은 호출자가 소유권 없이 이름 변경·삭제를 시도할 수 있다.

조치: `DATA-01`~`DATA-04`.

### SEC-02 공개 DB 테이블 경계

Supabase anon 조회 결과:

| 테이블 | 익명 조회 결과 |
|---|---:|
| `playlists` | 실제 행 1건 반환 |
| `summaries` | 실제 행 1건 반환 |
| `trend_cache` | 실제 행 1건 반환 |
| `user_plan` | 0건 |
| `usage_daily` | 0건 |
| `custom_sources` | 0건 |
| `bookmarks` | 0건 |

`summaries`와 `trend_cache`가 제품상 공개 캐시여도 브라우저의 직접 DB 접근이
필요한 구조는 아니다. 최소 권한 원칙에 따라 서버 전용으로 닫는 편이 안전하다.
이번 감사에서는 익명 쓰기 권한은 변경을 만들지 않기 위해 시험하지 않았다.

조치: `DATA-02`, `DATA-03`.

### DEP-01 프로덕션 의존성 취약점

`npm audit --omit=dev` 결과:

- total 6: moderate 4, high 1, critical 1
- `next@16.1.6`: App Router/Proxy 우회, RSC·이미지·연결 DoS 등 다수 권고
- `protobufjs@7.5.4`: critical RCE 및 code/prototype injection 계열 권고
- `ws@8.19.0`, `brace-expansion@2.0.2`, `postcss@8.4.31` 권고
- npm이 제시한 Next 안전 업데이트 후보는 `16.2.9`

유입 경로:

- `protobufjs`, `@protobufjs/utf8`, `brace-expansion`, `ws` 일부는 `@google/genai`
- `ws`는 `@supabase/realtime-js`에서도 사용
- 취약 Next 범위와 현재 앱의 App Router·`src/proxy.ts` 사용이 겹친다.

조치: `PLAT-01`~`PLAT-03`.

### OPS-01 Supabase 스키마 미적용

`npm run verify:supabase` 결과:

- OK: `user_plan`, `usage_daily`, `custom_sources`, `bookmarks`, `playlists`
- FAIL: `teams`, `team_members`, `team_invites` 없음

따라서 현재 연결 환경에서 팀 기능은 완성된 운영 기능이 아니다.
또한 `docs/supabase-migrations/003_teams.sql`은 세 테이블에 RLS를 활성화하지 않는다.

조치: `TEAM-01`, `OPS-04`.

### WEB-01 보안 응답 헤더 부재

로컬 프로덕션 홈 응답에서 아래 헤더가 모두 비어 있었다.

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options`
- `Cross-Origin-Opener-Policy`

조치: `PLAT-04`.

## 4. 보안·인증 진단

### AUTH-01 인증 후 이동 경로 검증

`next.startsWith("/")`만 검사해 `//host`, 백슬래시, 비정상 경로를 거르지 않는다.
특히 클라이언트 폴백은 `window.location.replace(url)`을 사용한다.

조치:

- 단일 `sanitizeInternalPath` 유틸을 만들고 서버·클라이언트·로그인 폼에서 공유한다.
- 한 개의 `/`로 시작하는 same-origin path만 허용한다.
- `//`, `\\`, scheme, control character를 거부하고 `/`로 폴백한다.

작업: `AUTH-01`.

### AUTH-02 프록시 세션 갱신의 취약한 내부 포맷 의존

`src/proxy.ts`는 Supabase 인증 쿠키 내부 JSON/JWT를 직접 해석해 만료를 추정한다.
성능 최적화 의도는 타당하지만 SDK 쿠키 포맷 변화에 취약하고,
`getUser()` 네트워크 실패 예외 처리도 없다.

작업: `AUTH-02`.

### TEAM-02 초대 대상 이메일 미검증

초대 생성 시 이메일을 받지만 가입 시 로그인 사용자의 이메일과 비교하지 않는다.
링크를 전달받은 다른 계정도 가입할 수 있다.

작업: `TEAM-02`.

### TEAM-03 GET 요청이 팀 가입을 수행

`/teams/join?token=...` 페이지 조회만으로 멤버 upsert와 초대 삭제가 실행된다.
명시적 확인 없이 상태가 바뀌고 링크 스캐너·실수 방문에 취약하다.

작업: `TEAM-02`.

### TEAM-04 소유자 불변식 붕괴

- admin이 owner를 제거할 수 있다.
- owner가 마지막 owner인 자신을 `member`로 낮출 수 있다.
- 권한 변경과 멤버 제거가 트랜잭션으로 보호되지 않는다.

작업: `TEAM-03`.

### EXT-01 Notion 공유 DB 무권한 쓰기

`syncVideoToNotionAction`은 사용자 인증·owner 검사·레이트리밋이 없다.
`MyFocusSection`은 버튼 호출뿐 아니라 추천 영상 재생 완료 시 자동 동기화도 수행한다.
코드는 PRD의 “Notion OAuth는 향후” 상태와도 불일치한다.

영향:

- 사용자 입력과 AI 생성물이 운영자의 공유 Notion DB에 기록될 수 있다.
- Gemini·Notion 비용과 DB 오염 위험이 있다.

작업: `EXT-01`.

### EXT-02 공개 진단·쿼터 소비 엔드포인트

- `/api/youtube/resolve-channel`: 인증·분산 레이트리밋 없이 YouTube 쿼터 소비
- `/trends?refresh=1`: 누구나 캐시를 우회해 Gemini 재계산 요청 가능
- `/api/notion/health`: 공개 상태에서 DB ID·제목·외부 API 오류 반환
- `/api/debug-youtube`: 프로덕션 토글 시 별도 secret 없이 외부 오류 본문 반환

작업: `EXT-02`, `RATE-01`.

### SEC-03 재검증 Referer 비교

`referer.startsWith(appOrigin)`은 `https://target.example.attacker.tld` 같은 접두 도메인을
동일 출처로 오인할 수 있다. URL 파싱 후 정확한 `origin` 비교가 필요하다.

작업: `AUTH-03`.

## 5. 결제·사용량 진단

### BILL-01 중복 구독 가능

checkout API는 현재 Pro 여부나 기존 활성 subscription을 확인하지 않는다.
UI 버튼이 숨겨져도 API 직접 호출로 여러 Checkout Session과 중복 구독을 만들 수 있다.

작업: `BILL-01`.

### BILL-02 웹훅 DB 실패를 성공으로 응답

여러 `upsert`/`update` 결과의 error를 검사하지 않고 `200 received`를 반환한다.
Stripe 재시도가 멈춰 결제와 `user_plan`이 어긋날 수 있다.

추가 문제:

- event idempotency 저장소 없음
- subscription status별 `pro/free` 전환이 불완전
- 환불 시 고객의 첫 subscription을 선택해 잘못된 구독을 처리할 수 있음

작업: `BILL-02`.

### BILL-03 해지 경로 부재

약관은 “언제든 해지”를 약속하지만 고객 포털·해지 API·UI가 없다.
프로필에는 로그아웃만 있다.

작업: `BILL-03`, `LEGAL-02`.

### USAGE-01 원자적이지 않은 사용량

현재 흐름은 `checkUsageLimit` 후 AI 호출, 성공 후 read-modify-upsert다.
동시 요청은 둘 다 허용되고 같은 카운트를 덮어쓸 수 있다.

작업: `RATE-02`.

### RATE-01 서버리스에서 공유되지 않는 레이트리밋

`Map` 기반 인메모리 버킷은 인스턴스·리전마다 분리되고 재시작 시 초기화된다.
Pro “무제한”도 실제로는 인스턴스별 버스트 제한만 받는다.

작업: `RATE-01`.

## 6. 네트워크·성능·확장성 진단

### NET-01 외부 요청 타임아웃 부재

YouTube, RSS, Gemini, Notion, Stripe, transcript 호출에 일관된 timeout과
`AbortSignal`이 없다. 한 공급자 지연이 SSR과 서버 액션을 오래 붙잡을 수 있다.

작업: `NET-01`.

### NET-02 응답 크기·동시성 상한 부재

- RSS XML 전체를 메모리에 읽고 파싱한다.
- 커스텀 소스 수에 비례해 모든 YouTube/RSS 호출을 한꺼번에 시작한다.
- DB 커스텀 소스에는 실질적인 총 개수 상한이 없다.
- import는 큰 JSON과 많은 항목을 허용하고 DB insert를 순차 실행한다.

작업: `NET-02`, `DATA-04`.

### PERF-01 YouTube API 중복 호출

홈에서 채널 avatar hydration을 하고 `fetchYouTubeFeed`가 다시 avatar를 조회한다.
한 소스당 playlist, video details, avatar 외에 hydration 채널 조회가 추가될 수 있다.

작업: `PERF-01`.

### PERF-02 트렌드 stampede와 무한 캐시 행

- 캐시 miss/강제 새로고침 동시 요청을 묶는 single-flight가 없다.
- `trend_cache`는 매번 insert하며 보존 기간 정리가 없다.
- 홈과 트렌드 페이지에서 피드 수집이 중복될 수 있다.

작업: `PERF-02`.

### PERF-03 모바일 메뉴 링크 프리패치 fan-out

메뉴를 열 때 다수 카테고리·소스 RSC 요청이 시작됐다가 abort되는 현상이 관찰됐다.
큰 링크 목록에는 선택적 `prefetch={false}`가 적합한지 측정해야 한다.

작업: `PERF-03`.

### PERF-04 정적 자산

- `public/` 전체 약 5.2MB
- OG 이미지 2848x1504, 약 3.1MB
- `icon-192.png`, `icon-512.png` 모두 실제 640x640이며 각 약 400KB
- manifest는 정사각형 아이콘 대신 595x420 로고를 192/512로 선언

작업: `PWA-02`, `PERF-04`.

## 7. AI·데이터 품질 진단

### AI-01 한 사용자 동작이 여러 모델 호출로 증폭

요약·인사이트는 최대 3회 생성과 각 품질 평가로 한 동작당 최대 6회 Gemini 호출이
가능하다. 사용자 한도와 실제 모델 비용이 직접 일치하지 않는다.

작업: `AI-01`.

### AI-02 출력·프롬프트 안전성

- 외부 RSS·YouTube 제목/설명/자막을 명시적 untrusted delimiter 없이 프롬프트에 넣는다.
- 일부 JSON 파서는 필드 길이·점수 범위까지 검증하지 않는다.
- 실패 시 raw 모델 응답을 로그에 남기는 경로가 있다.
- 모델 호출에 출력 토큰 상한과 timeout이 없다.

직접 코드 실행형 도구는 없으므로 즉시 RCE 성격은 아니지만,
랭킹·Q&A·Notion 기록의 내용 무결성에 영향을 줄 수 있다.

작업: `AI-02`.

### FUNC-01 브리핑 cron 경로가 로그인 요구와 충돌

`/api/briefing`은 cron secret으로 호출되지만 내부 `rankFeedByGoalsAction`은
쿠키 로그인 사용자를 요구한다. 일반 cron 호출에는 사용자 쿠키가 없어 성공할 수 없다.

작업: `EXT-03`.

### FUNC-02 팀 브리핑이 팀 데이터가 아님

팀 목표는 읽지만 피드 소스와 사용량은 요청한 개인 사용자의 쿠키·플랜을 사용한다.
팀원마다 결과가 달라질 수 있고 팀 공용 소스·비용 정책이 없다.

작업: `TEAM-04`.

### FUNC-03 RSS 장애 상태가 숨겨짐

`sourceStatus.rss`는 항상 `"ready"`이며 RSS fetch는 실패 시 빈 배열을 반환한다.
모든 RSS가 실패해도 UI가 정상으로 오인할 수 있다.

작업: `NET-03`.

## 8. UI/UX·접근성 추가 진단

기존 상세는 `docs/CLAUDE_CODE_QA_REMEDIATION_HANDOFF.md`에 있다.

추가 핵심:

- modal focus trap은 있으나 body scroll lock과 배경 inert 처리가 없다.
- Q&A는 공통 modal primitive를 사용하지 않아 focus trap·restore가 일관되지 않다.
- Q&A와 라디오 하단 UI의 z-index·safe-area 충돌이 있다.
- 모바일 메뉴에는 데스크톱의 팀·요금제·소개 링크가 없어 기능 발견성이 다르다.
- 여러 버튼이 44px보다 작다.
- 테마 토글 컴포넌트가 실제 탐색 UI에 없다.
- RSS HTML entity가 사용자에게 그대로 보인다.
- 라디오 큐는 새로고침 시 사라지고 플레이리스트 관리 UI는 코드와 노출이 불일치한다.

작업: `UX-01`~`UX-05`.

## 9. 개인정보·법적·계정 수명주기

### LEGAL-01 개인정보처리방침 누락

실제 처리하지만 문서에 충분히 드러나지 않는 항목:

- Gemini로 전송되는 자막, 제목, 피드 문맥, 목표, Q&A 이력
- Notion으로 전송·생성되는 영상 분석과 사용자 맥락
- 브라우저 localStorage의 목표, Q&A, 요약, 시청 기록
- 구체적인 보유·삭제 기준과 국외 처리 가능성

작업: `LEGAL-01`.

### ACCOUNT-01 탈퇴·내보내기·로컬 데이터 삭제 부재

개인정보처리방침은 설정 또는 탈퇴로 삭제할 수 있다고 하지만 제품에는 없다.
DB 데이터 삭제, Stripe 상태 확인, 로컬 저장소 삭제를 묶은 수명주기 설계가 필요하다.

작업: `ACCOUNT-01`, `ACCOUNT-02`.

## 10. 엔지니어링·운영 성숙도

### OBS-01 관측성 부재

구조화 로그, request ID, 외부 공급자 latency/error metric, Gemini 비용 지표,
Sentry/OpenTelemetry 연동이 없다. 현재는 `console.*`와 문자열 로그 중심이다.

작업: `OBS-01`, `OBS-02`.

### TEST-01 회귀 검증 폭 부족

- unit test: rate limit 1개
- E2E: desktop Chromium 2개 smoke
- 모바일, WebKit, 인증 경계, Stripe, 팀, PWA, RLS canary 없음
- CI에 dependency audit와 스키마 정책 검증이 없음

작업: `TEST-01`~`TEST-04`.

### OPS-02 검증 스크립트가 정책을 확인하지 않음

`verify-supabase-schema.mjs`는 Service Role로 테이블 조회만 한다.
RLS, policy, NOT NULL, unique, 함수, 인덱스, 익명 차단을 확인하지 않는다.

작업: `OPS-04`.

## 11. 확장 기능 우선순위

P0/P1 해결 전에는 기능 확장을 먼저 하지 않는다.

안정화 후 권장 순서:

1. 소스 온보딩과 소스별 마지막 성공 시각·장애 이유
2. 계정 데이터 내보내기·탈퇴·Stripe 포털
3. 목표·필터·Q&A·시청 기록의 선택적 기기 간 동기화
4. 서버 검색·페이지네이션·저장된 보기
5. 팀 공용 소스·역할·감사 로그·초대 관리
6. 이메일/푸시 다이제스트와 알림 설정
7. 사용자별 Notion OAuth와 명시적 내보내기
8. PWA 안정화 후 네이티브 래퍼 여부 결정

작업: `PROD-01`~`PROD-06`.

## 12. 권장 실행 순서

1. 의존성·DB 노출·Notion 쓰기 경계 긴급 차단
2. 플레이리스트·인증·팀 권한
3. 사용량 원자성·분산 레이트리밋·외부 timeout
4. Stripe 결제 무결성
5. PWA·모바일·접근성
6. 성능·관측성·테스트·문서
7. 계정 수명주기와 기능 확장

