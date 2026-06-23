---
id: PAT-003
패턴명: dev 서버(webpack) + node_modules junction = 전역 hydration 실패 (런타임 검증 함정)
카테고리: build
증상: SSR HTML 은 정상(HTTP 200, 화면 렌더됨)인데 클릭·토글 등 모든 인터랙션이 무반응. 콘솔에 `WebSocket ... webpack-hmr ... failed: ERR_INVALID_HTTP_RESPONSE` 반복. DOM 요소에 React fiber(`__reactFiber$`/`__reactProps$`) 미부착. 특정 컴포넌트가 아니라 페이지 전체가 안 됨.
원인: 격리 worktree 에서 실제 node_modules 를 복사하지 않으려고 Windows junction(`mklink /J`)으로 연결한 뒤 `next dev --webpack` 으로 구동하면, 번들러/React Refresh 가 junction(파일시스템 루트 밖을 가리키는 symlink)을 제대로 못 따라가 클라이언트 번들/HMR 이 깨진다. → hydration 미완 = 핸들러 미바인딩. (Turbopack 은 더 명시적으로 `Symlink ... points out of the filesystem root` 로 build 거부.)
해결: 런타임(인터랙션) 검증은 ①production 경로(`next build` + `next start`, 단 build 는 junction 거부하니 실 node_modules=`npm ci` 필요) 또는 ②`next dev`(turbopack, junction 비사용 환경)로. junction+webpack dev 조합으로 "클릭 안 됨"을 앱/PR 결함으로 오판 말 것. hydration 여부는 무관 컨트롤(테마 토글 등)로 리트머스 → 그것도 죽으면 환경 문제(BLOCKED), 특정 컨트롤만 죽으면 코드 문제(FAIL).
적용조건: git worktree + node_modules junction 으로 격리 빌드/구동하는 워크플로(Windows). Next.js dev 인터랙션 수동/Playwright 검증 시.
출처프로젝트: focus-feed (youtube-summary)
태그: [nextjs, hydration, webpack, turbopack, junction, worktree, windows, playwright, verify]
발견일: 2026-06-24
출처DevLog: 2026-06-24 세션 (PR #15 런타임 검증 중 전역 hydration 실패 → prod build 로 전환해 PASS). docs/HANDOFF_2026-06-24_SESSION.md
---

## 사례 (focus-feed)

PR #15 런타임 검증: origin/main 격리 worktree + `mklink /J` node_modules junction + `next dev --webpack` 구동.

- 홈 렌더됨(HTTP 200, 435항목 보임) → 정상으로 착각
- ContentStateControl 클릭 → optimistic 변화 X, 서버액션 POST X, alert X
- 리트머스: **테마 토글(PR 무관)도 무반응** + 버튼 React fiber 부착=false → 전역 hydration 실패 판명 = 환경 문제(PR 결함 아님)
- 콘솔: `webpack-hmr WebSocket ... ERR_INVALID_HTTP_RESPONSE` 반복

→ `npm ci`(실 node_modules) + `next build` + `next start`(prod) 로 전환:
- `?view=rss` 커밋, fiber=true, 클릭 → 서버액션 도달 → "로그인이 필요합니다" 가드 작동, 콘솔에러 0 → 런타임 PASS

## 교훈
- "화면 보임" ≠ "hydration 됨". 인터랙션 검증 전 무관 컨트롤로 hydration 리트머스부터.
- 격리 worktree junction 은 lint/unit(vitest)엔 통하지만 next build(turbopack) 거부 + dev(webpack) hydration 깨짐. 런타임 검증은 production 빌드가 진실.
- CI 가 production(`next start`)으로 E2E 통과한다는 사실이, 로컬 dev 무반응이 환경 함정임을 가리키는 신호였다.

관련: [[focus-feed-main-tree-concurrent]] (worktree 격리 워크플로)
