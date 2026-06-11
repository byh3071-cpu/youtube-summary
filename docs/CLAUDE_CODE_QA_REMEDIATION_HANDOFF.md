---
id: focus-feed-claude-code-qa-remediation-handoff
date: 2026-06-11
tags: [focus-feed, claude-code, handoff, qa, security, pwa, mobile]
---

# Focus Feed QA Remediation - Claude Code CLI Handoff

이 문서는 2026-06-11 실제 브라우저 감사에서 발견된 문제를 Claude Code CLI가
작은 단위로 안전하게 해결하도록 전달하는 실행 프롬프트다.

> **우선 문서**: 보안·DB·인증·결제·네트워크까지 포함한 실행 순서는
> `docs/CLAUDE_CODE_FULL_STACK_REMEDIATION_HANDOFF.md`를 먼저 따른다.
> 본 문서는 그중 PWA·모바일 UI/UX·브라우저 회귀의 상세 수용 기준으로 사용한다.

## 사용 방법

저장소 루트에서 Claude Code CLI를 열고 아래 `마스터 프롬프트` 전체를 전달한다.
한 세션에서 무리하게 모두 처리하지 말고, 각 Phase의 검증과 보고를 끝낸 뒤 다음
Phase로 진행한다.

## 마스터 프롬프트

```text
당신은 Focus Feed 저장소의 시니어 Next.js 엔지니어다.

작업 위치:
C:\Users\백요한\OneDrive\바탕 화면\Yohan_Workspace\Youtube-Summary

목표:
2026-06-11 실제 사용자 브라우저 감사에서 발견된 보안, PWA, 모바일 UI/UX,
외부 API 장애 안내, 회귀 테스트 문제를 작은 배포 단위로 해결한다.

반드시 먼저 읽을 문서:
1. AGENTS.md
2. docs/MILESTONES.md
3. docs/PRD.md
4. docs/DEPLOYMENT_CHECKLIST.md
5. docs/MOBILE_QA_CHECKLIST.md
6. docs/DATA_PROTECTION.md
7. CLAUDE.md

작업 원칙:
- 사용자가 명시적으로 요청하지 않았으므로 git commit, push를 하지 않는다.
- .env.local, API 키, Supabase 키 등 비밀값을 출력하거나 수정·커밋하지 않는다.
- 현재 worktree에는 다른 에이전트/사용자의 미커밋 변경이 있다. 시작 시
  `git status --short`와 대상 파일의 `git diff`를 읽고 기존 변경을 보존한다.
- 관련 없는 리팩터, 포맷 변경, 파일 이동을 하지 않는다.
- 각 Task는 가능한 한 1~3개 파일에 한정한다.
- 각 Phase 종료 시 lint, 관련 테스트, 가능하면 build를 실행한다.
- 테스트가 실패하면 제품 결함, 환경 문제, 테스트 문제를 구분해 보고한다.
- 새 문서나 제품 동작 변경이 있으면 PRD/MILESTONES/체크리스트 중 필요한 문서만 갱신한다.
- 각 Phase 완료 보고에는 변경 파일, 동작 변화, 검증 결과, 남은 위험을 포함한다.
- 막히지 않는 한 질문만 하고 멈추지 말고 합리적인 보수적 결정을 내려 구현한다.

현재 확인된 기준선:
- `npm run lint`: 통과
- `npm run test:unit`: 1개 테스트 통과
- `npm run build`: 통과
- 기존 Playwright E2E는 데스크톱 Chromium 2개 스모크만 존재한다.
- 로컬 Playwright 브라우저 실행 파일이 없을 수 있다. 필요하면 시스템 Chrome을
  사용하거나 `npx playwright install chromium` 필요 여부를 명확히 보고한다.
- 로컬 .env.local의 YouTube Data API 키와 Gemini 키는 감사 당시 만료되어
  실제 호출이 HTTP 400 `API key expired`로 실패했다. 키 값 자체는 다루지 않는다.
- 비로그인 `/playlists`에서 `user_id IS NULL` 플레이리스트가 여러 브라우저에
  공용 노출되는 동작이 확인됐다.
- 모바일 393x852에서 메뉴와 Q&A는 열리지만, 모달 스크롤 잠금과 Q&A/라디오
  푸터 겹침, 필터 행 압축, 44px 미만 터치 타깃이 확인됐다.
- RSS 제목에서 `&quot;`, `&#039;`, `&amp;` 같은 HTML 엔티티가 노출됐다.
- ThemeToggle 컴포넌트는 있으나 실제 UI에서 접근할 수 없다.

진행 순서:
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5

각 Phase를 완료하고 검증 결과를 기록한 뒤 다음 Phase로 넘어가라.
보안 문제인 Phase 1을 P0로 가장 우선한다.

==================================================
Phase 0. 기준선과 운영 복구 경계
==================================================

목표:
코드 결함과 운영 환경 결함을 분리하고 이후 변경의 기준선을 고정한다.

Task 0.1 - 변경 충돌 조사
- `git status --short` 실행.
- 이후 수정 대상 파일마다 `git diff -- <file>` 확인.
- 현재 미커밋 변경을 만든 주체를 추측하지 말고 그대로 보존.
- 감사 산출물 `artifacts/`와 `scripts/ux-audit.mjs`는 제품 코드가 아님을 인지.
  삭제하거나 커밋 대상으로 만들지 말고 그대로 둔다.

완료 기준:
- 기존 변경과 이번 작업 변경의 경계가 보고서에 명시됨.

Task 0.2 - 외부 API 오류 분류 개선 계획 확인
- `src/lib/youtube.ts`, Gemini 공통 클라이언트/액션, `src/lib/env.ts`를 읽는다.
- API 키 만료는 코드로 새 키를 만들 수 없는 운영 작업임을 명시한다.
- 단, 만료/무효 키를 `request_failed`가 아닌 설정 오류로 분류할 코드 보완은
  Phase 4에서 수행한다.

Task 0.3 - 운영자 체크리스트 추가
- 비밀값 없이 아래 운영 작업을 `docs/DEPLOYMENT_CHECKLIST.md`에 체크 항목으로 추가:
  - YouTube Data API v3 키 교체 및 실제 channels/playlistItems 요청 확인
  - Gemini 키 교체 및 generateContent 최소 요청 확인
  - Stripe 미사용 환경이면 경고와 의도적 비활성 상태 구분
- 키 값이나 프로젝트 ID는 문서에 기록하지 않는다.

검증:
- `npm run lint`

Phase 0 종료 보고 후 Phase 1로 진행.

==================================================
Phase 1. P0 플레이리스트 소유권과 익명 데이터 격리
==================================================

목표:
익명 플레이리스트의 전역 공유와 소유권 없는 변경/삭제를 제거한다.

정책 결정:
- 서버 DB 플레이리스트는 로그인 사용자만 저장·조회·수정·삭제할 수 있다.
- 비로그인 큐 자체는 현재 브라우저 메모리에서 사용할 수 있지만 서버 저장은 금지한다.
- 기존 `user_id IS NULL` 행은 사용자에게 노출하지 않는다.
- 기존 익명 DB 행을 자동으로 특정 사용자에게 귀속하지 않는다.

Task 1.1 - 저장 API 로그인 필수화
대상:
- `src/app/api/playlists/save/route.ts`
- 필요 시 `src/app/actions/playlists.ts`

구현:
- 쿠키 세션 사용자를 확인하고 비로그인이면 401과 한국어 오류를 반환.
- 클라이언트가 넘긴 userId는 신뢰하지 않는다.
- 서버 액션에는 인증된 user ID만 전달.
- 저장 row의 `user_id`는 null이 될 수 없게 경로를 제한.

테스트:
- 비로그인 POST `/api/playlists/save` -> 401.
- 빈 items 로그인 요청 -> 400.
- 로그인 사용자 저장 -> 해당 user_id로 저장.

Task 1.2 - 목록 조회 로그인 필수화
대상:
- `src/app/playlists/page.tsx`

구현:
- 비로그인 사용자는 저장 목록을 조회하지 않고 로그인 안내/CTA 표시.
- `query.is("user_id", null)` 경로 제거.
- 로그인 사용자만 `.eq("user_id", user.id)`로 조회.
- 익명 행이 화면에 나오지 않는 회귀 테스트 추가.

Task 1.3 - 이름 변경/삭제 소유권 검증
대상:
- `src/app/actions/playlists.ts`
- 해당 호출 컴포넌트

구현:
- rename/delete 액션 내부에서 쿠키 세션의 현재 사용자를 직접 확인.
- update/delete 조건에 `.eq("user_id", user.id)` 추가.
- 대상이 없거나 소유자가 아니면 일반적인 실패 메시지 반환.
- service role 사용 시에도 소유권 조건을 절대 생략하지 않는다.
- 가능하면 액션 인자로 userId를 받지 않는다.

Task 1.4 - DB 마이그레이션/정책 점검
대상:
- `docs/supabase-migrations/001_plan_usage_playlists.sql`
- 필요하면 새 번호의 보완 마이그레이션
- `docs/DATA_PROTECTION.md`

구현:
- `playlists.user_id` 존재 여부와 FK/index/RLS 정책을 현재 코드와 대조.
- 새 마이그레이션이 필요하면 재실행 가능한 SQL로 작성.
- 기존 null 행 처리 정책은 삭제가 아니라 운영자 수동 검토 대상으로 문서화.
- RLS가 있어도 service role 코드의 명시적 user_id 조건을 유지.

Task 1.5 - 집중 테스트
- 저장 API 인증 테스트.
- 목록 격리 테스트.
- rename/delete 타 사용자 ID 거부 테스트.
- 기존 테스트 도구 패턴을 우선 사용. 무리한 테스트 프레임워크 추가 금지.

Phase 1 완료 기준:
- [ ] 비로그인 서버 저장 불가
- [ ] 비로그인 `/playlists`에서 어떤 DB 플레이리스트도 노출되지 않음
- [ ] 사용자 A가 사용자 B의 playlist ID로 rename/delete 불가
- [ ] 로그인 사용자는 자신의 플레이리스트 저장·조회 가능
- [ ] 관련 문서와 마이그레이션이 현재 코드와 일치
- [ ] lint, unit, build 통과

검증:
- `npm run lint`
- `npm run test:unit`
- `npm run build`

Phase 1에서 보안 수용 기준이 충족되지 않으면 다음 Phase로 진행하지 말고 원인을 해결.

==================================================
Phase 2. PWA 업데이트 안정성과 manifest 정합성
==================================================

목표:
오래된 HTML/청크 조합을 방지하고 설치 아이콘과 데스크톱 동작을 바로잡는다.

Task 2.1 - 서비스 워커 캐시 정책 재설계
대상:
- `public/sw.js`
- 필요 시 `src/components/PwaInstaller.tsx`

권장 정책:
- navigation 요청: network-first. 네트워크 실패 때만 명시적 offline fallback 사용.
- `/_next/static/` 해시 자산: cache-first 허용.
- 이미지 등 일반 정적 자산: stale-while-revalidate 또는 보수적 cache-first.
- API, 서버 액션, RSC(`?_rsc=`), 인증 callback은 캐시하지 않음.
- 동적 `/`, `/login`, `/pricing` HTML을 install 시점 APP_SHELL로 고정 캐시하지 않음.
- 실패한 응답, opaque가 아닌 비정상 응답은 캐시에 저장하지 않음.
- cache name 버전 갱신 및 이전 캐시 정리.
- 오프라인 fallback이 필요하면 전용 정적 페이지를 사용하고 `/` HTML을 대체하지 않음.

Task 2.2 - manifest 아이콘 수정
대상:
- `public/app.webmanifest`
- 필요 시 중복 `public/manifest.webmanifest`

구현:
- 실제 정사각형 파일 `icon-192.png`, `icon-512.png`를 각 크기에 맞게 참조.
- 필요하면 `purpose: "any maskable"` 검토.
- 데스크톱 웹/PWA도 지원하므로 `orientation: "portrait"` 고정은 제거하거나
  제품 의도에 맞는 값으로 완화.
- 두 manifest가 모두 필요하지 않으면 참조 관계를 조사한 뒤 단일 소스로 정리.

Task 2.3 - SW 등록/갱신 검증
- 최초 방문: service worker active.
- 새 빌드 배포를 모사해도 재방문에서 ChunkLoadError가 없어야 함.
- `/api/*`, OAuth callback, RSC 응답이 Cache Storage에 들어가지 않아야 함.
- 오프라인에서 정적 fallback 또는 명확한 오류 화면이 보여야 함.

Task 2.4 - PWA E2E 또는 자동 점검 추가
- Playwright에서 manifest 응답 200과 아이콘 URL 200 확인.
- 서비스 워커 제어 상태 및 navigation 캐시 회귀를 가능한 범위에서 테스트.
- 테스트가 브라우저 캐시 상태에 의존하지 않도록 새 context 사용.

Phase 2 완료 기준:
- [ ] 동적 HTML cache-first 제거
- [ ] RSC/API/Auth 미캐시
- [ ] 실제 아이콘 크기와 manifest 선언 일치
- [ ] 데스크톱 PWA orientation 제한 없음
- [ ] 빌드 교체 후 새로고침/재방문에서 청크 오류 없음
- [ ] lint, unit, build, 관련 E2E 통과

==================================================
Phase 3. 모바일 모달, 푸터, 필터, 터치 UX
==================================================

목표:
393x852 및 작은 모바일 화면에서 주요 조작이 가려지거나 찌그러지지 않게 한다.

Task 3.1 - 공통 모달 스크롤 잠금
대상:
- `src/components/ui/ModalTransition.tsx`

구현:
- 모달 open 동안 body 스크롤 잠금.
- 닫힐 때 기존 body 스타일과 스크롤 위치 복구.
- 중첩 모달 가능성을 고려해 단순 덮어쓰기 부작용 방지.
- 기존 Escape, focus trap, focus restore 유지.

테스트:
- 모바일 메뉴 open 중 background scroll 불가.
- overlay/close/Escape 후 원래 위치 유지.

Task 3.2 - Q&A와 라디오 푸터 겹침 제거
대상:
- `src/components/feed/FeedQADrawer.tsx`
- 필요 시 라디오 플레이어 컴포넌트

구현 후보:
- Q&A overlay/panel z-index를 라디오보다 높게 설정하고,
- 모바일 패널에 safe-area와 하단 입력 여백을 보장하거나,
- Q&A open 동안 라디오 안내/컨트롤을 접근성 있게 숨김.
- textarea와 답변 버튼이 393x852에서 푸터에 가리지 않아야 함.
- 키보드가 열린 상태에서도 입력/전송 버튼 접근 가능해야 함.

Task 3.3 - 모바일 필터 행 재배치
대상:
- `src/components/feed/KeywordFilter.tsx`
- `src/components/feed/ViewSwitcher.tsx`

구현:
- `필터`, 전체/유튜브/RSS, 열기 버튼을 한 줄에 억지로 압축하지 않는다.
- 360px에서도 글자가 세로로 한 글자씩 줄바꿈되지 않게 한다.
- 보기 전환은 가로 스크롤 또는 다음 줄 배치를 사용.
- 임의의 `ml-5`, `translate-y` 픽셀 보정 제거를 우선 검토.

Task 3.4 - 44px 터치 타깃
감사에서 작았던 항목:
- Google 로그인
- 새로고침
- 환영 배너 닫기
- My Focus 닫기/AI 브리핑
- ViewSwitcher 버튼
- 필터 열기
- 더 보기

구현:
- 핵심 인터랙션은 최소 44x44 CSS px 또는 충분한 hit area 확보.
- 시각 크기를 과도하게 키우지 않고 투명 padding/hit area 사용 가능.
- desktop 밀도는 유지.

Task 3.5 - 빈 라디오 푸터 모바일 정책
대상:
- `src/components/player/FloatingRadioPlayer.tsx`

검토 후 구현:
- 큐가 비었을 때 모바일에서는 작은 dismissible 안내 또는 일반 콘텐츠 배너로 전환.
- 항상 고정되어 피드/Q&A 공간을 차지하지 않게 한다.
- 큐에 항목이 있을 때 실제 플레이어는 기존 고정 동작 유지.
- 기존 라디오 핵심 로직을 불필요하게 리팩터하지 않는다.

Task 3.6 - 접근 가능한 테마 전환
- `ThemeToggle`이 실제 UI에 연결되지 않은 상태를 확인.
- 데스크톱 사이드바와 모바일 메뉴 중 자연스러운 위치에 추가.
- 라이트/다크 전환 후 홈, 카드, Q&A, 라디오 대비 확인.

Phase 3 완료 기준:
- [ ] 메뉴/모달 open 시 배경 스크롤 잠금
- [ ] Q&A 입력과 전송 버튼이 라디오에 가리지 않음
- [ ] 360px/393px에서 필터 문구 찌그러짐 없음
- [ ] 핵심 버튼 터치 영역 44px
- [ ] 빈 큐 안내가 모바일 콘텐츠를 지속적으로 가리지 않음
- [ ] 테마 전환 접근 가능
- [ ] desktop 레이아웃 회귀 없음

뷰포트:
- Desktop: 1440x900
- Android: 393x852
- Small mobile: 360x800
- iPhone 계열: 390x844, safe-area 모사

==================================================
Phase 4. 외부 API 오류 분류와 콘텐츠 표시 품질
==================================================

목표:
운영 설정 오류를 사용자에게 정확히 알리고 RSS 텍스트를 정상 표시한다.

Task 4.1 - YouTube 만료 키 분류
대상:
- `src/lib/youtube.ts`
- 연결 상태 UI

구현:
- Google 오류 body의 `API key expired`, `API_KEY_INVALID`, `keyInvalid`,
  `API key not valid`, `accessNotConfigured`를 설정 오류로 분류.
- HTTP 400/403만 보고 일시 장애로 뭉개지 않는다.
- 사용자 UI에는 비밀정보 없이 “YouTube 연동 설정 오류”처럼 표시.
- 서버 로그는 채널마다 동일 오류를 반복 출력하지 않도록 기존 warnOnce 패턴 활용.

Task 4.2 - Gemini 만료 키 분류
대상:
- Gemini 공통 클라이언트/액션
- 트렌드/요약/Q&A UI

구현:
- 인증/키 만료와 일반 네트워크 오류를 구분.
- 사용자에게 재시도만 권하는 대신 운영 설정 오류임을 표현하되 키 값은 노출 금지.
- 서버 에러 객체 전체가 클라이언트로 전달되지 않게 한다.
- 공통 오류 매핑을 재사용하고 액션별 중복 문자열을 줄인다.

Task 4.3 - RSS HTML 엔티티 디코딩
대상:
- `src/lib/rss.ts`
- 관련 테스트

구현:
- RSS title과 summary의 HTML 엔티티를 안전하게 디코딩.
- 서버 환경에서 DOM에 의존하지 않는 검증된 방식 사용.
- 태그 제거와 엔티티 디코딩 순서를 명확히 한다.
- 스크립트 실행이나 임의 HTML 렌더링 금지.

테스트 사례:
- `&quot;The Lean Startup&quot;`
- `&#039;memorize&#039;`
- `AI &amp; Context`
- 중첩/잘못된 엔티티 입력

Task 4.4 - 비로그인 custom source sync의 예상 401 소음 제거
- 현재 앱 진입 시 비로그인도 `/api/custom-sources` GET을 호출해 브라우저 콘솔에
  401 resource error가 남는지 확인.
- 정상 비로그인 흐름이라면 API를 200 no-op로 바꾸거나, 세션 확인 후 호출하거나,
  다른 명시적 방식으로 콘솔 오류를 없앤다.
- 기존 쿠키 기반 비로그인 채널 추가 동작은 유지.
- 다른 에이전트가 이 파일들을 수정 중일 수 있으므로 반드시 현재 diff를 읽고 통합.

Phase 4 완료 기준:
- [ ] 만료 YouTube 키가 일시 장애가 아닌 설정 오류로 표시
- [ ] Gemini 인증 오류와 네트워크 오류 구분
- [ ] RSS 제목에 HTML 엔티티가 그대로 보이지 않음
- [ ] 비로그인 정상 진입에서 예상된 401 콘솔 오류 없음
- [ ] 관련 단위 테스트 통과

==================================================
Phase 5. 실사용 E2E 확대, 디자인 회귀, 문서 마감
==================================================

목표:
다시 같은 문제가 생기지 않도록 데스크톱/모바일/PWA 회귀 검증을 CI에 남긴다.

Task 5.1 - Playwright 프로젝트 확대
대상:
- `playwright.config.ts`
- `e2e/`

추가 프로젝트:
- Desktop Chromium
- Mobile Chrome 또는 Pixel 계열
- 가능하면 WebKit 모바일. CI 비용/안정성이 과도하면 수동 QA로 명시.

Task 5.2 - 익명 핵심 E2E
각 테스트는 외부 API 성공에 과도하게 의존하지 않고 성공/저하 상태 둘 다 허용한다.

시나리오:
1. 홈 main과 상태 안내 렌더
2. 모바일 메뉴 열기, body scroll lock, Escape/overlay 닫기
3. 필터 열기, 키워드 추가/삭제, 새로고침 후 localStorage 유지
4. 전체/유튜브/RSS 보기 전환과 URL 반영
5. Q&A 열기/닫기와 모바일 하단 가림 없음
6. `/trends`, `/landing`, `/login`, `/pricing`, `/bookmarks`,
   `/playlists`, `/teams`, `/privacy`, `/terms` 응답과 핵심 heading
7. 페이지별 수평 오버플로 없음
8. manifest/icons/service worker 기본 검증

Task 5.3 - 인증 경계 E2E/통합 테스트
- 실제 Google OAuth를 CI에서 자동화하지 않는다.
- storageState 또는 테스트용 Supabase 환경이 이미 없다면 API/서버 단위 테스트로 대체.
- 비로그인 playlist 저장 401, 목록 비노출은 반드시 자동화.
- 실제 OAuth, Stripe, 팀 초대는 수동 체크리스트에 남긴다.

Task 5.4 - UI 회귀 점검
- 스크린샷은 핵심 화면만 사용하고 과도한 픽셀 스냅샷은 피한다.
- 홈 desktop/mobile, Q&A open, pricing mobile, trends empty state 확인.
- 접근성:
  - landmark
  - dialog label
  - focus trap/restore
  - 44px 터치 타깃
  - 라이트/다크 대비

Task 5.5 - 문서 업데이트
대상:
- `docs/MILESTONES.md`
- `docs/PRD.md`
- `docs/MOBILE_QA_CHECKLIST.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- 필요한 경우 README

반영:
- M7 또는 품질 안정화 마일스톤 추가.
- 플레이리스트는 로그인 사용자 전용 서버 저장임을 명시.
- PWA 캐시 정책 요약.
- API 키 만료 진단 체크.
- 실제 iOS Safari PWA와 OAuth/Stripe는 수동 검증 항목으로 유지.

최종 검증:
- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e`
- 가능하면 `npm test`
- 가능하면 `npm run verify:supabase`

최종 완료 보고 형식:
1. 해결한 P0/P1 목록
2. Phase별 변경 파일
3. 자동 테스트 결과
4. 수동 브라우저 검증 결과와 뷰포트
5. 운영자가 해야 할 외부 작업
6. 미해결 위험/후속 작업
7. git status 요약

절대 하지 말 것:
- 비밀값 출력/교체/커밋
- 기존 미커밋 변경 되돌리기
- 승인 없는 commit/push
- 로그인 사용자를 가장한 임의 데이터 생성
- 실제 Stripe 결제 실행
- API 오류를 숨기기 위해 테스트를 약화
```

## 권장 세션 분리

컨텍스트와 회귀 범위를 작게 유지하려면 아래처럼 세션을 나눈다.

| Claude Code 세션 | 범위 | 종료 조건 |
|---|---|---|
| 1 | Phase 0 + Phase 1 | 플레이리스트 보안 테스트와 build 통과 |
| 2 | Phase 2 | SW·manifest·PWA E2E 통과 |
| 3 | Phase 3 | 360/393px 모바일 UX 수용 기준 통과 |
| 4 | Phase 4 | API 오류 분류·RSS 테스트 통과 |
| 5 | Phase 5 | 전체 E2E·문서·최종 보고 완료 |

## 사용자 운영 작업

아래 항목은 Claude Code가 코드만으로 완료할 수 없다.

1. Google Cloud Console에서 만료된 YouTube Data API 키 교체.
2. Gemini API 키 교체.
3. 배포 환경 변수 반영 후 실제 요청 검증.
4. Supabase 보완 migration/RLS SQL의 운영 DB 적용.
5. 실제 Google OAuth 로그인, Stripe 결제, iOS Safari PWA 수동 검증.
