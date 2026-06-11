---
id: focus-feed-work-report-2026-06-11-qa-remediation
date: 2026-06-11
tags: [focus-feed, report, qa, security, pwa, mobile, e2e, code-review]
---

# 작업 결과 보고서 — QA Remediation Phase 0~5 + 적대적 검증/코드 리뷰 (2026-06-11)

- **입력 문서**: `docs/CLAUDE_CODE_QA_REMEDIATION_HANDOFF.md` (2026-06-11 실브라우저 감사 후속 마스터 프롬프트)
- **수행 주체**: Claude Code CLI 세션 1회 (Phase 0→1→2→3→4→5 순차 + 전체 적대적 검증/코드 리뷰)
- **후속 작업**: `docs/CODE_REVIEW_FIXUP_HANDOFF_2026-06-11.md` (리뷰에서 확정된 11건 수정용)
- **git**: 커밋/푸시 없음 (사용자 규칙). 모든 변경은 worktree에 있음.

---

## 1. 최종 검증 결과 (전부 통과)

| 검증 | 결과 | 비고 |
|---|---|---|
| `npm run lint` | ✅ | 각 Phase 종료 시 반복 실행 |
| `npm run test:unit` | ✅ **47/47** | 세션 시작 시 1개 → 신규 24개 추가 (+병행 작업의 digest 22개) |
| `npm run build` | ✅ | Next.js 16.1.6, TypeScript 포함 |
| `npm run test:e2e` | ✅ **29/29** (exit 0) | 데스크톱 21 + 모바일 8, 시작 시 2개 → 29개로 확대 |

---

## 2. Phase별 수행 내용

### Phase 0 — 기준선·경계 (Task 0.1~0.3)

- `git status --short`로 기존 미커밋 변경(다른 에이전트/사용자: feed-qa, notion-sync,
  summarize, trend, custom-sources, env.ts, youtube.ts, gemini.ts 등)과 이번 작업의
  경계를 확정. **기존 변경은 전부 보존**, `artifacts/`·`scripts/ux-audit.mjs` 미접촉.
- 외부 API 오류 분류 기준선 확인: youtube.ts에 `invalid_api_key` 일부 분류 존재하나
  `API key expired` 미분류, gemini.ts(신규)에 인증 분류 없음 → Phase 4 대상 확정.
- `docs/DEPLOYMENT_CHECKLIST.md` §3에 운영 체크 3건 추가
  (YouTube/Gemini 키 교체 후 실요청 확인, Stripe 의도적 비활성 구분).
  ※ 작업 중 다른 주체가 §0(키 발급 바로가기)을 추가해 중복 없이 통합.

### Phase 1 — P0 플레이리스트 소유권·익명 격리 (Task 1.1~1.5)

**정책**: 서버 DB 플레이리스트는 로그인 사용자 전용. 비로그인 큐는 브라우저 메모리만.
기존 `user_id IS NULL` 행은 비노출·자동귀속 금지·운영자 수동 검토.

| 변경 | 파일 | 내용 |
|---|---|---|
| 저장 API | `src/app/api/playlists/save/route.ts` | 쿠키 세션 미확인 시 **401**(인증을 items 검증보다 먼저). 클라이언트 userId 불신뢰 |
| 액션 | `src/app/actions/playlists.ts` | `savePlaylistAction`에서 **userId 인자 제거**(서버 액션은 클라이언트가 직접 호출 가능하므로), 쿠키 세션 직접 확인. rename/delete에 `.eq("user_id", userId)` 강제 + `.select("id")`로 매칭 0건 검출 → 일반 실패 메시지 |
| 목록 | `src/app/playlists/page.tsx`, `src/lib/playlists-server.ts`(신규) | 비로그인은 DB 미조회 + 로그인 CTA. `is("user_id", null)` 경로 제거. 조회 로직을 테스트 가능한 헬퍼로 분리 |
| DB | `docs/supabase-migrations/005_playlists_owner_required.sql`(신규) | RLS 활성화 + 본인 SELECT 정책(NULL 행은 어떤 정책에도 매칭 안 됨). 쓰기 정책 없음(서버 전용). 재실행 가능 SQL |
| 문서 | `docs/DATA_PROTECTION.md` §2 | 새 정책·NULL 행 처리·RLS/service-role 주의 전면 갱신 |
| 테스트 | `playlists.test.ts`(9), `route.test.ts`(3), `playlists-server.test.ts`(4) | 익명 401/400, user_id 강제, 타 사용자 거부, 익명 비노출 회귀 — **16개** |

### Phase 2 — PWA 캐시·manifest (Task 2.1~2.4)

| 변경 | 파일 | 내용 |
|---|---|---|
| SW 재설계 | `public/sw.js` | (구) 전 요청 cache-first → (신) navigation **network-first·HTML 미캐시**(stale chunk 원천 차단), `/_next/static` cache-first, 이미지 SWR(`response.ok`만 저장), **API·`/auth/`·RSC(`?_rsc`·RSC 헤더)·비GET 미관여**, 캐시 v2 + 구캐시 정리 |
| 오프라인 | `public/offline.html`(신규) | 정적 fallback, 라이트/다크, 44px 재시도 버튼 |
| manifest | `public/app.webmanifest` 수정, `public/manifest.webmanifest` **삭제**(코드 참조 없는 동일 중복) | 아이콘을 실제 정사각 `icon-192/512.png`로, `orientation: portrait` 제거, `purpose: any` |
| 아이콘 | `public/icon-192.png`·`icon-512.png` | 640x640 → 선언 크기로 리사이즈. `scripts/resize-pwa-icons.mjs`(신규, 의존성 없는 PNG 디코더/박스 다운샘플/인코더) |
| 등록 | `src/components/PwaInstaller.tsx` | `updateViaCache: "none"` |
| E2E | `e2e/pwa.spec.ts`(신규) | manifest 200 + 아이콘 선언/실제 크기 일치(PNG 헤더 파싱), sw/offline 200, **새 컨텍스트에서 동적 HTML·API·RSC 미캐시 + offline.html precache 검증** |
| 환경 | `package.json` `test:e2e:install` 추가 | Playwright 1.57용 Chromium(v1200) 설치 수행 |

### Phase 3 — 모바일 모달·푸터·필터·터치 (Task 3.1~3.6)

| Task | 파일 | 내용 |
|---|---|---|
| 3.1 스크롤 잠금 | `src/lib/body-scroll-lock.ts`(신규), `src/components/ui/ModalTransition.tsx` | 카운터 방식 잠금(`position:fixed`+위치 저장/복구, 중첩 안전). ModalTransition 사용처(모바일 메뉴, 재생목록 서랍 등) 일괄 적용 |
| 3.2 Q&A 겹침 | `src/components/feed/FeedQADrawer.tsx` | 컨테이너 z-50→**z-[70]**(라디오 z-50, 서랍 z-55/56 위), 패널 safe-area 하단 패딩, **Escape 닫기 추가**, body 잠금 적용 |
| 3.3 필터 행 | `ViewSwitcher.tsx`, `KeywordFilter.tsx` | `ml-5`·`translate-y-[1.8px]` 픽셀 보정 제거, 가로 스크롤+`whitespace-nowrap`으로 360px 세로 깨짐 방지, 헤더 행 wrap |
| 3.4 44px | LoginButton, RefreshButton, WelcomeBanner, MyFocusSection, FeedList(더 보기 3곳), ViewSwitcher, KeywordFilter | 모바일 `min-h-[44px]`+`touch-manipulation`, 데스크톱 `sm:min-h-0`로 밀도 유지 |
| 3.5 빈 라디오 | `FloatingRadioPlayer.tsx` | 데스크톱 기존 안내 유지(`hidden md:block`), 모바일은 **닫기 가능한 1줄 안내**(sessionStorage 기억, safe-area). 큐 있을 땐 기존 동작 |
| 3.6 테마 | `Sidebar.tsx`, `MobileNavDrawer.tsx`, `ThemeToggle.tsx` | 데스크톱 사이드바 하단 + 모바일 메뉴에 연결. `resolvedTheme` 사용(system 테마 정확 토글), 모바일 44px |
| E2E | `e2e/mobile-ux.spec.ts`(신규) | Pixel 5(≈393px): 메뉴 잠금/복구/포커스 복귀, Q&A 전송 버튼 hit-test 가림 없음, 수평 오버플로 없음 |

### Phase 4 — 외부 API 오류 분류·콘텐츠 품질 (Task 4.1~4.4)

| Task | 파일 | 내용 |
|---|---|---|
| 4.1 YouTube | `src/lib/youtube.ts` | `isYouTubeConfigErrorBody()`: `API key expired`·`API_KEY_INVALID`·`API key not valid`·`keyInvalid`·`accessNotConfigured`를 HTTP 400/403에서 **`invalid_api_key`(설정 오류)**로 분류. HTTP 오류 로그 warnOnce화 |
| 4.1 UI | `youtube-status.ts`, `MobileNavDrawer.tsx` | 라벨 "키 오류"→**"연동 설정 오류"** |
| 4.2 Gemini | `src/lib/gemini.ts` | `GeminiFailureKind(missing_key/auth/rate_limited/unavailable)` + `generateGeminiTextResult` + 공용 메시지 `geminiFailureMessage`. 기존 `generateGeminiText`는 래퍼로 보존(타 호출부 호환). 서버 에러 객체 클라이언트 미전달 |
| 4.2 액션 | `feed-qa.ts`, `summarize.ts` | 중복 오류 문자열을 공용 매핑으로 교체 — 설정 오류 시 "재시도" 대신 운영 설정 오류 안내 |
| 4.3 RSS | `src/lib/html-entities.ts`(신규), `src/lib/rss.ts` | DOM 비의존 엔티티 디코더(명명/10·16진수, 이중 인코딩 1단계, 잘못된 엔티티 보존), 태그 제거→디코딩 순서 보장. title/summary 적용. **테스트 8개**(감사 사례 `&quot;`/`&#039;`/`&amp;` 포함) ※ 리뷰에서 후속 결함 발견 — FIX-1 |
| 4.4 401 소음 | `CustomSourcesSync.tsx` | 비로그인은 로컬 세션 확인 후 GET 자체를 건너뜀(콘솔 401 제거, 쿠키 기반 동작 유지) ※ 리뷰 후속 — FIX-2 |
| E2E | `e2e/smoke.spec.ts` | 익명 진입 시 `/api/custom-sources` 401 미발생 회귀 테스트 |

### Phase 5 — E2E 확대·접근성·문서 마감 (Task 5.1~5.5)

| Task | 파일 | 내용 |
|---|---|---|
| 5.1 프로젝트 | `playwright.config.ts` | **desktop-chromium**(Desktop Chrome, mobile-* 제외) + **mobile-chromium**(Pixel 5, mobile-*+smoke). WebKit은 수동 QA 명시. `workers: 2`(로컬), `timeout: 60s` |
| 5.2 익명 E2E | `e2e/routes.spec.ts`(신규) | 9개 라우트(/trends /landing /login /pricing /bookmarks /playlists /teams /privacy /terms) 응답<400 + 핵심 heading + 수평 오버플로 없음 |
| 5.2/5.3 | `e2e/anon-flows.spec.ts`(신규) | **익명 저장 401**(request), **익명 /playlists CTA·행 비노출**, 키워드 필터 추가/삭제+localStorage 유지, 뷰 전환 URL 반영, Q&A dialog 접근성 이름+Escape, 데스크톱 테마 토글 |
| 5.4 | `e2e/mobile-ux.spec.ts` 확장 | 터치 타깃 44px boundingBox 검증, 포커스 복귀, 모바일 테마 토글 |
| 5.5 문서 | `docs/MILESTONES.md`(M7 추가), `docs/PRD.md`(§4.7 플레이리스트 로그인 전용·§4.11 PWA 정책·이력), `docs/MOBILE_QA_CHECKLIST.md`(PWA 업데이트/오프라인/테마/빈 라디오/44px/Stripe 수동 항목) | |
| 러너 | `scripts/run-e2e.mjs`(신규), `package.json` | 아래 §4 환경 이슈 우회 ※ 리뷰 후속 — FIX-3 |

---

## 3. E2E가 적발한 실제 제품 버그 (작성 중 수정 완료)

1. **데스크톱에서 Q&A FAB이 라디오 푸터(z-50)에 항상 가려져 클릭 불가** — 잠복 버그를
   신규 테스트가 적발. FAB의 `sm:bottom-1rem` 오버라이드 제거(전 뷰포트 5.5rem)로 수정.
2. **hydration 전 클릭 유실** — 홈은 피드 435개로 hydration이 늦어 직후 클릭이 무시됨.
   `gotoHydratedHome()`(My Focus hydration 마커 대기) 패턴으로 테스트 안정화.
3. Playwright `getByRole` name이 **부분 일치**라 "저장"이 "저장됨"과 충돌 → `exact: true`.
4. App Router URL 커밋이 서버 렌더(트렌드 외부 호출 포함)를 기다려 5s 초과 → 어서션 타임아웃 20s.

---

## 4. 환경 트러블슈팅 기록 (재발 대비)

| 증상 | 원인 | 조치 |
|---|---|---|
| `playwright test`가 무출력 즉사 (bash 127 / 실제 0xC0000409) | **node 버전 전환(v24.13) 후 남은 `%TEMP%\playwright-transform-cache`(V8 code cache) 재사용** | 실행마다 새 `PWTEST_CACHE_DIR` 지정 (`scripts/run-e2e.mjs`) |
| E2E가 시작 단계에서 무한 대기 | 이전 비정상 종료가 남긴 **고아 next dev 서버**가 포트 3000 점유(TCP만 열리고 HTTP 무응답, 한 개는 메모리 2.4GB) | 고아 node PID 3건(38448/24540/26952 등) 확인 후 종료. 진단법을 FIXUP 핸드오프에 기록 |
| 테스트 전부 통과 후에도 종료 코드 오염 | Next dev 서버를 관리한 Playwright/직계 부모 node가 종료 시점 네이티브 크래시 | 러너가 `test-results/.last-run.json`(mtime 검증)로 성패 판정 ※ CI 가드 필요 — FIX-3 |
| `npx playwright install` 필요 | 설치된 Chromium(1223)이 Playwright 1.57 요구 빌드(1200)와 불일치 | `npm run test:e2e:install` 스크립트 추가 후 설치 |
| 트렌드/AI 호출 429 폭주 로그 | **Gemini 프로젝트 월 지출 한도 초과** (RESOURCE_EXHAUSTED, "monthly spending cap") | 코드가 `rate_limited`로 정확 분류함을 확인. **운영자 조치 필요** (§6) |

---

## 5. 적대적 검증 + 코드 리뷰 (요청에 따라 수행)

- **방법**: 3개 독립 파인더(① 라인 단위 diff 스캔 ② 제거된 동작 감사 ③ 크로스파일 호출 추적,
  각각 별도 에이전트) → 후보 16건 → 중복 제거·의도된 정책 기각 → 검증자 에이전트가
  후보별 CONFIRMED/PLAUSIBLE/REFUTED 판정 → **11건 확정** (CONFIRMED 9, PLAUSIBLE 2).
- **확정 결함 11건과 수정 방법**: `docs/CODE_REVIEW_FIXUP_HANDOFF_2026-06-11.md` (저녁 세션용).
  요약: ① RSS 리터럴 꺾쇠 파괴 ② CustomSourcesSync 동기화 플래그 잠김 ③ run-e2e CI 가드 누락
  ④ Escape IME 미가드 ⑤ digest 한도가 캐시보다 먼저(타 작업 코드) ⑥ SW 캐시 무한 누적
  ⑦ 외부 시크 600ms 레이스(타 작업 코드) ⑧ 딥다이브 z-90 모달 침범(타 작업 코드)
  ⑨ 비로그인 저장 버튼 막다른 길 ⑩ scroll-lock 라우트 전환 스크롤 오염 ⑪ Q&A 포커스 트랩 부재.
- **기각(의도된 정책)**: 익명 NULL 행 비노출(감사 핸드오프 명시), 오프라인 앱셸 제거(stale chunk 방지),
  smoke 2프로젝트 중복 실행(의도된 공통 스모크).

---

## 6. 운영자(사용자)가 해야 할 외부 작업

1. ⚠️ **Gemini 월 지출 한도 초과 해소** — https://ai.studio/spend 에서 한도 조정.
   (키 자체는 2026-06-11 갱신·Vercel 반영·redeploy 완료 — 한도만 문제)
2. `docs/supabase-migrations/005_playlists_owner_required.sql` 운영 DB 적용
   (적용 전에도 서버 코드 조건으로 익명 노출·타인 변경은 차단됨).
3. (선택) `%TEMP%\playwright-transform-cache` 폴더 삭제 — 러너가 우회하므로 필수 아님.
4. 실 Google OAuth·Stripe 결제·iOS Safari PWA 수동 검증 (`docs/MOBILE_QA_CHECKLIST.md`).
5. 기존 `user_id IS NULL` 플레이리스트 행 수동 검토
   (`SELECT id, title, created_at FROM public.playlists WHERE user_id IS NULL;`).

## 7. 미해결 위험

- 리뷰 확정 11건(§5)이 수정 전 상태 — FIXUP 핸드오프로 후속 예정.
- 트렌드 기능은 Gemini 한도 해소 전까지 빈 상태 문구로 동작(의도된 저하 모드).
- 로컬 Windows에서 Playwright 종료 코드 오염은 러너로 우회 중(근본 원인은 node v24
  환경 — node LTS 22 사용 시 소멸 가능성 있음, 미검증).
- 프로덕션 2회 연속 배포 교차 검증(SW HTML 미캐시 효과 실측)은 수동 항목.

## 8. git 상태 요약

- 이번 세션 변경 + 병행 작업(vhk 도입, digest 기능, CI 워크플로, youtubei.js 의존성 등)이
  worktree에 공존. 본 세션은 어떤 commit/push도 수행하지 않음.
- 삭제 파일: `public/manifest.webmanifest` (git으로 복구 가능).
- 이번 세션 신규 파일: `src/lib/{body-scroll-lock,html-entities,playlists-server}.ts`,
  `public/offline.html`, `docs/supabase-migrations/005_*.sql`,
  `e2e/{pwa,mobile-ux,routes,anon-flows}.spec.ts`,
  `scripts/{run-e2e,resize-pwa-icons}.mjs`, 단위 테스트 4파일, 본 보고서·FIXUP 핸드오프.
