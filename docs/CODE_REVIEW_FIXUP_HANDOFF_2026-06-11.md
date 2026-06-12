---
id: focus-feed-code-review-fixup-handoff
date: 2026-06-11
tags: [focus-feed, code-review, handoff, fixup, claude-code]
---

# 코드 리뷰 후속 수정 핸드오프 (2026-06-11 저녁 세션용)

2026-06-11 QA Remediation(Phase 0~5) 완료 직후 수행한 **적대적 검증 + 코드 리뷰**에서
확정된 결함 11건의 수정 작업을 AI가 바로 이어받기 위한 문서다.
전체 작업 경위·결과는 `docs/WORK_REPORT_2026-06-11_QA_REMEDIATION.md` 참고.

## 세션 시작 시 반드시 지킬 것

- 사용자가 명시적으로 요청하기 전까지 **git commit / push 금지**.
- worktree에 다른 작업(vhk, digest 기능 등)의 미커밋 변경이 공존한다.
  시작 시 `git status --short` 확인, 수정 대상 파일은 `git diff HEAD -- <file>`로 현재 상태를 먼저 읽을 것.
- 비밀값(.env.local, 키) 출력·수정 금지.
- 항목별로 1~3개 파일 단위로 수정하고, 각 항목 수정 후 검증 명령 실행.

## 검증 명령

```bash
npm run lint
npm run test:unit     # 현재 47개 통과가 기준선
npm run build
npm run test:e2e      # 현재 29개 통과가 기준선 (아래 환경 노트 필수 확인)
```

### E2E 환경 노트 (중요)

- `npm run test:e2e`는 `scripts/run-e2e.mjs` 러너를 거친다. 이 러너는
  ① 실행마다 새 `PWTEST_CACHE_DIR`을 지정(이전 node 버전이 만든 변환 캐시가
  node v24.13에서 0xC0000409 무출력 크래시 유발) ② 종료 코드가 오염되면
  `test-results/.last-run.json`(mtime 검증)으로 성패를 판정한다.
- E2E가 시작 직후 무출력으로 죽으면: 포트 3000을 점유한 고아 `node.exe`(이전
  실행의 next dev 잔재)를 의심할 것. `netstat -ano | findstr :3000`으로 PID 확인
  후 node.exe인 경우에만 종료.
- **Gemini가 현재 월 지출 한도 초과(429 RESOURCE_EXHAUSTED)** 상태일 수 있다.
  트렌드/AI 호출 성공에 의존하는 테스트를 만들지 말 것 (기존 테스트는 의존하지 않음).
- 홈(`/`)은 피드 아이템이 많아 hydration이 늦다. 클릭 전에
  `gotoHydratedHome()` 패턴(My Focus `편집|닫기|접기` 버튼 대기)을 사용할 것
  — `e2e/anon-flows.spec.ts`, `e2e/mobile-ux.spec.ts`에 헬퍼 있음.

---

## 수정 항목 (우선순위순)

각 항목: 문제 → 실패 시나리오 → 제안 수정 → 검증. 검증 판정은 적대적 리뷰의
CONFIRMED(코드로 재현 구성 가능) / PLAUSIBLE(현실적이나 미반증) 기준.

### FIX-1. [CONFIRMED] RSS 제목·요약에서 리터럴 꺾쇠 텍스트 파괴

- **파일**: `src/lib/html-entities.ts` (stripHtmlTags), `src/lib/rss.ts`, `src/lib/html-entities.test.ts`
- **문제**: `stripHtmlTags`의 `/<[^>]*>/g`가 HTML 태그가 아닌 텍스트도 삭제.
  RSS **제목은 이번 변경 전에는 strip 대상이 아니었음** (회귀).
- **시나리오**: 제목 `Understanding Vec<T> in Rust` → `Understanding Vec in Rust`,
  요약 `x < 10 and y > 5` → `x 5` (`< 10 and y >`가 태그로 매칭됨).
- **수정 제안**:
  1. 제목(title)은 태그 제거 없이 **엔티티 디코딩만** 적용 (`decodeHtmlEntities` 직접 사용
     혹은 `htmlToPlainText(input, { stripTags: false })` 옵션).
  2. 요약(summary)의 태그 제거 정규식을 실제 태그 형태로 좁힘:
     `/<\/?[a-zA-Z][^<>]*>|<!--[\s\S]*?-->/g` (영문자로 시작하는 여닫는 태그 + 주석만).
     이러면 `< 10 and y >`, `<T>`(대문자 한 글자도 매칭됨 주의 — `Vec<T>`의 `<T>`는
     `[a-zA-Z]` 시작이라 여전히 매칭된다. 요약에서 `Vec<T>`까지 보존하려면
     알려진 HTML 태그명 화이트리스트(`p|br|div|span|a|b|i|strong|em|ul|ol|li|img|h[1-6]|blockquote|code|pre|table|tr|td|th|figure|figcaption|iframe|script|style` 등) 방식 권장).
- **테스트 추가**: `Vec<T>` 보존(제목), `x < 10 and y > 5` 보존, `<b>bold</b>` 제거(요약),
  기존 8개 케이스 회귀 없음.

### FIX-2. [CONFIRMED] CustomSourcesSync — 스킵해도 SYNCED_FLAG를 기록해 세션 내내 동기화 잠김

- **파일**: `src/components/feed/CustomSourcesSync.tsx`
- **문제**: 비로그인이거나 `getSession()` 실패로 동기화를 건너뛴 경우에도
  `sessionStorage[SYNCED_FLAG_KEY]="1"`을 기록한다.
- **시나리오**: ① 비로그인 진입 → 같은 탭 OAuth 로그인(sessionStorage 유지) →
  로그인 후에도 DB pull/push가 탭 세션 끝까지 실행 안 됨.
  ② 로그인 사용자의 세션 판독이 일시 실패해도 동일하게 잠김.
- **수정 제안**: `isLoggedIn === true`로 **실제 동기화를 수행한 경우에만** 플래그 기록.
  비로그인 경로는 백업/복원(restoredFromBackup → PUT)만 수행하고 플래그를 남기지 않는다.
  (보너스: `supabase.auth.onAuthStateChange`로 SIGNED_IN 시 플래그 제거 후 재동기화하면 더 견고.)
- **검증**: `e2e/smoke.spec.ts`의 익명 401 테스트 통과 유지. 수동: 비로그인 진입 → 로그인 → 콘솔에서
  `sessionStorage.getItem("focus_feed_sources_synced_v1")` 흐름 확인.

### FIX-3. [CONFIRMED] run-e2e 러너의 종료 코드 보정이 Linux CI에도 적용됨

- **파일**: `scripts/run-e2e.mjs`
- **문제**: `.last-run.json`이 passed면 비정상 종료 코드를 0으로 바꾸는 보정에
  플랫폼/CI 가드가 없음. `.github/workflows/ci.yml`이 `npm run test:e2e`를 호출하므로
  Linux CI에서 teardown/리포터의 진짜 인프라 실패가 녹색으로 위장될 수 있다.
- **수정 제안**: 보정 분기를 `process.platform === "win32" && !process.env.CI`일 때만 적용.
  그 외에는 Playwright 종료 코드를 그대로 전달.
- **검증**: 로컬 `npm run test:e2e` exit 0 유지 확인.

### FIX-4. [CONFIRMED] Escape가 한글 IME 조합 취소까지 모달을 닫음

- **파일**: `src/components/feed/FeedQADrawer.tsx`, `src/components/ui/ModalTransition.tsx`,
  `src/components/layout/MobileNavDrawer.tsx`(자체 Escape 핸들러),
  `src/components/player/FloatingRadioPlayer.tsx`(fullPlayer Escape)
- **문제**: document keydown Escape 핸들러들에 `isComposing` 가드가 없다.
- **시나리오**: Q&A textarea에 한글 입력 중 조합 취소 Esc → 패널이 통째로 닫힘.
- **수정 제안**: 모든 Escape 핸들러 첫 줄에
  `if (e.isComposing || e.keyCode === 229) return;` 추가 (keyCode 229는 일부 브라우저/IME 대응).
- **검증**: 수동 — 한글 조합 중 Esc로 닫히지 않는지. E2E의 기존 Escape 테스트(비조합) 통과 유지.

### FIX-5. [CONFIRMED] 비로그인 ‘플레이리스트 저장’ 버튼이 401 막다른 길

- **파일**: `src/components/player/RadioPlaylistDrawer.tsx`
- **문제**: 저장 버튼이 비로그인에게도 활성. 클릭 후 11px 안내문만 표시, 로그인 동선 없음.
- **수정 제안**: `getSupabaseBrowserClient().auth.getSession()`으로 로그인 여부 확인
  (LoginButton 패턴 참조). 비로그인이면 저장 버튼 대신
  "로그인하면 저장됩니다" 안내 + `/login` 링크(또는 버튼 비활성 + 링크). 401 응답 처리도 유지(이중 방어).
- **검증**: 비로그인 큐 저장 시 401 네트워크 요청 자체가 발생하지 않으면 더 좋음. lint/build.

### FIX-6. [CONFIRMED] SW STATIC_CACHE 무한 누적 (만료·상한 없음)

- **파일**: `public/sw.js`
- **문제**: `/_next/static/*`(cache-first)와 이미지·`/_next/image`(SWR)가 단일
  `focus-feed-static-v2` 캐시에 쌓이고, activate는 **이름이 다른** 캐시만 삭제.
  배포가 거듭되면 구 해시 청크·이미지 변형이 무한 누적 → 쿼터 도달 시 브라우저가
  캐시 전체 evict(오프라인 fallback 포함 소실). 교체된 아바타는 무기한 stale-first.
- **수정 제안**(택1 또는 조합):
  1. 이미지용 캐시를 분리(`focus-feed-img-v1`)하고 put 후 `cache.keys()` 길이가
     상한(예: 200)을 넘으면 앞에서부터 삭제하는 trim 함수 추가.
  2. `/_next/static`용 캐시도 분리하고 동일 trim(예: 300).
  3. (선택) 빌드 시 VERSION 자동 주입은 Next 구조상 복잡 — trim 방식 권장.
- **검증**: `e2e/pwa.spec.ts` 통과 유지 + 새 컨텍스트에서 offline.html precache 확인.

### FIX-7. [PLAUSIBLE] body-scroll-lock — 라우트 전환 언마운트 시 새 페이지를 옛 오프셋으로 스크롤

- **파일**: `src/lib/body-scroll-lock.ts`
- **문제**: 마지막 unlock에서 무조건 `window.scrollTo(0, savedScrollY)`.
  모달 open 상태로 라우트가 바뀌어 컴포넌트가 언마운트되면(뒤로가기 등)
  cleanup이 새 라우트 커밋 중 실행되어 새 페이지가 이전 페이지 오프셋으로 스크롤될 수 있다.
- **수정 제안**: `lockBodyScroll()`에서 `savedPathname = location.pathname` 저장,
  `unlockBodyScroll()`에서 `location.pathname === savedPathname`일 때만 scrollTo 실행.
- **검증**: 단위 테스트(jsdom 없으면 수동) — 피드 스크롤 → Q&A 열기 → 뒤로가기 →
  새 페이지가 상단에서 시작하는지.

### FIX-8. [CONFIRMED · 타 작업자 코드] digest 한도 검사가 캐시 조회보다 먼저

- **파일**: `src/app/actions/digest.ts` (~54행)
- **문제**: `guardGeminiActionRateLimit`·`checkUsageLimit`이 `getCachedDigest`보다 먼저 실행.
  Gemini 0콜인 캐시 히트도 한도 초과 시 차단 — 파일 자체 주석("캐시 히트면 …
  사용량 미차감")과 모순.
- **수정 제안**: 캐시 조회를 한도 검사 **앞으로** 이동. 캐시 미스일 때만 한도·레이트리밋 검사.
- **주의**: 이 파일은 다른 작업 흐름의 신규 코드다. 현재 diff를 읽고 보존하며 최소 수정.

### FIX-9. [CONFIRMED · 타 작업자 코드] 외부 시크 600ms 고정 타이머 레이스

- **파일**: `src/components/player/FloatingRadioPlayer.tsx` (~386행 pendingSeek)
- **문제**: 큐의 다른 영상으로 시크할 때 `setTimeout(…, 600)` 후 무조건 seek.
  영상별 ready/CUED 확인·재시도 없음. 그 시점 `getDuration()`은 이전 영상 값이라
  진행률 %도 오염.
- **수정 제안**: `onStateChange`에서 새 videoId의 CUED/PLAYING 도달 시 pendingSeek 적용,
  또는 `getDuration()>0 && 로드된 videoId 일치`를 폴링(상한 ~5s) 후 적용. 적용 실패 시 1회 재시도.

### FIX-10. [CONFIRMED · 타 작업자 코드] 딥다이브 패널(z-90)이 aria-modal Q&A(z-70) 위에 뜸

- **파일**: `src/components/feed/VideoDigestDrawer.tsx` (~191행)
- **문제**: 오버레이·스크롤락 없는 z-90 패널이 모달 위에 떠 클릭 가능 — aria-modal 의미론 붕괴.
- **수정 제안**(택1): ① 패널 z를 60 이하로 내림(Q&A가 위로),
  ② Q&A 열릴 때 딥다이브 닫기(상호 배제), ③ 딥다이브에 `useBodyScrollLock`+오버레이 부여 후 z 정리.
  Q&A z-[70] 주석(`FeedQADrawer.tsx`)과 일관되게.

### FIX-11. [PLAUSIBLE] Q&A 포커스 트랩 부재 + Escape 다중 레이어 동시 닫힘

- **파일**: `src/components/feed/FeedQADrawer.tsx`
- **문제**: Q&A는 aria-modal이지만 포커스 트랩이 없어 Tab으로 오버레이 아래
  라디오 푸터 버튼에 도달해 재생목록 드로어를 열 수 있고, 그 상태에서 Esc 한 번에
  두 레이어가 동시에 닫힌다(각자 document 리스너, stopPropagation 없음).
- **수정 제안**: ① FeedQADrawer에 ModalTransition 수준의 포커스 트랩 추가(또는
  ModalTransition으로 마이그레이션), ② 최상위 레이어만 Escape를 처리하도록
  모듈 레벨 모달 스택(열린 순서 push/pop, 핸들러는 자신이 top일 때만 close) 도입.
  FIX-4와 같은 파일이므로 함께 작업 권장.

---

## 수정하지 않기로 한 항목 (의도된 정책 — 재론 금지 아님, 참고)

| 후보 | 판단 |
|---|---|
| 기존 `user_id IS NULL` 플레이리스트가 로그인 후에도 안 보임 | **의도된 정책** (QA 핸드오프 명시: 노출 금지·자동 귀속 금지·운영자 수동 검토). UX상 "사라짐"으로 보일 수 있음은 알려진 트레이드오프 |
| 오프라인에서 앱 셸 대신 offline.html만 표시 | **의도된 정책** (동적 HTML 캐시가 ChunkLoadError 원흉이었음) |
| smoke.spec이 데스크톱·모바일 두 프로젝트에서 중복 실행 | 의도(두 뷰포트 공통 스모크). 비용 문제 시 testMatch 정규식 앵커링(`/^(mobile-.*|smoke)\.spec\.ts$/`)만 고려 |

## 완료 기준

- [x] FIX-1 ~ FIX-7 수정 + 관련 테스트 추가/갱신
- [x] FIX-8 ~ FIX-10은 현재 diff 보존 원칙 하에 최소 수정 (충돌 시 보고 후 중단)
- [x] FIX-11 적용 (FIX-4와 함께)
- [x] `npm run lint` / `npm run test:unit`(49) / `npm run build` / `npm run test:e2e`(29) 전부 통과 + `vhk verify` PASS(4/4)
- [x] 이 문서의 체크박스 갱신 + 수정 결과를 `docs/WORK_REPORT_2026-06-11_QA_REMEDIATION.md`에 추가 절로 기록

## 2026-06-12 처리 결과

11건 전부 적용·검증 완료. 검증: lint 0 · unit 49/49 · build · e2e 29/29 · `vhk verify` 4/4 PASS.

| FIX | 처리 | 핵심 변경 |
|---|---|---|
| 1 | ✅ | `stripHtmlTags`를 HTML 태그명 화이트리스트로 좁힘. 제목은 `htmlToPlainText(.., {stripTags:false})`로 디코딩만 — `Vec<T>`·`x < 10` 보존. 테스트 +2 |
| 2 | ✅ | 동기화 실제 수행(로그인) 시에만 `SYNCED_FLAG` 기록. `onAuthStateChange(SIGNED_IN)`로 같은 탭 로그인 시 재동기화 |
| 3 | ✅ | run-e2e 종료코드 보정을 `win32 && !CI`로 한정 — CI(Linux)는 Playwright 코드 그대로 전달 |
| 4 | ✅ | ModalTransition·FloatingRadioPlayer·MobileNavDrawer·FeedQADrawer·VideoDigestDrawer·KeywordFilter Escape에 `isComposing/keyCode 229` 가드 |
| 5 | ✅ | RadioPlaylistDrawer: 비로그인 시 저장 버튼 → "로그인하고 저장" 링크 + 안내, 401 왕복 제거 |
| 6 | ✅ | sw.js 캐시 3분리(precache/static/img) + `putAndTrim`(static 100·img 150 상한), v3로 구캐시 정리 |
| 7 | ✅ | body-scroll-lock: 잠금 시 pathname 저장, 같은 경로일 때만 scrollTo 복원 |
| 8 | ✅(미커밋) | digest.ts: 캐시 조회를 한도·레이트리밋 검사 앞으로. **digest.ts가 병행 미커밋 작업과 엉켜 있어 별도 커밋에서 제외 — 적용 상태로 두어 digest 작업과 함께 커밋 예정** |
| 9 | ✅ | FloatingRadioPlayer: 외부 시크를 고정 600ms→`getDuration()>0` 폴링(상한 ~5s) 후 적용, 영상 변경 시 폐기 |
| 10 | ✅ | VideoDigestDrawer z-90→z-60 (Q&A z-70 모달 아래) |
| 11 | ✅ | FeedQADrawer 포커스 트랩(Tab 순환·초기 포커스·복귀) 추가 → 오버레이 아래로 포커스 누출·다중 레이어 동시 Esc 차단 |

**커밋 메모**: FIX-8(`src/app/actions/digest.ts`)은 작업 트리에서 병행 digest 작업
(runGeneration·서버 duration 재조회·`youtube.ts` `fetchVideoDetails` export 의존)과
한 파일에 섞여, 단독 커밋 시 미완 병행 작업이 끌려오거나 CI import가 깨진다. 그래서
이번 커밋(10건)에서 제외하고 적용 상태로 남겼다 — digest 작업 커밋 시 함께 올라간다.
