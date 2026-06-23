---
id: focus-feed-devlog-2026-06-24
date: 2026-06-24
project: youtube-summary (Focus Feed)
pr: "#16"
tags: [devlog, mobile, ux, accessibility, pwa, trend-filter, code-review, merge]
---

# Dev Log — 모바일 UX 대수술 (PR #16, main 머지·검증 완료)

## 한 줄
포커스 피드 카드·홈 상단·트렌드 필터·모바일 접근성을 전면 개선하고, **dev 서비스워커 stale 캐시**라는 근본 원인까지 잡아 main에 머지(squash)·CI/빌드/테스트 검증 완료.

## 산출물 포인터
- PR: https://github.com/byh3071-cpu/youtube-summary/pull/16 (MERGED, squash → `6c5f0aa`)
- 패턴: `docs/patterns/PAT-001-dev-service-worker-stale-assets.md`
- 다음 세션 핸드오프: `docs/HANDOFF_2026-06-24_NEXT_SESSION.md`
- 주요 파일: `src/components/feed/{YouTubeCard,SummarizeButton,AddToRadioButton,VideoDigestDrawer,FeedReelView,FeedHeader,FeedClientContainer,FeedList,FeedItem,MyFocusSection,BookmarkButton}.tsx`, `src/components/trend/TrendRadarBarClient.tsx`, `src/contexts/TrendFilterContext.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/PwaInstaller.tsx`, `src/lib/filter.ts`, `src/lib/ui.ts`(신설)

## 한 일
- **카드**: AI 요약 버튼 저대비→솔리드 보라+흰글자, 좁은 폰 오버플로→`fullWidth`+`truncate`, 높이 28→44px. 액션행 4개 동일 36px 원형 + 44px 터치 히트영역(투명 `::before`). 펼침 패널 클리핑/오버랩 제거.
- **홈 상단 정리**: 히어로 일러스트·환영 배너 제거 → 검색→트렌딩→필터, MY FOCUS·사용량 하단 이동. max-width 캡 제거(2xl)+5열.
- **트렌드 필터**: 클릭 시 빈 결과 버그 → `sampleTitles`+토큰 부분매칭. 비문자열 가드(크래시 방지)·역방향 과매칭 가드.
- **모바일/a11y**: 릴뷰 라디오 플레이어 가림 보정, 터치타깃 44px, aria 보강, 북마크 이중탭 가드, 트렌드칩 컴팩트.
- **PWA**: dev SW 등록 차단 + 기존 SW/캐시 정리.
- **정리**: `lib/ui.ts`로 터치영역/아이콘버튼 공통 클래스 상수화.

## 검증
- 게이트: `tsc` 0 · `eslint` 0 · `next build` 클린 · `vitest` 82 통과 · `verify:focus-feed`·`vhk:policy` PASS.
- playwright 모바일(360/390) 실측: 가로 오버플로 0, JS 에러 0, 전 버튼 터치 동작, AI 44px·칩 40px.
- 적대적 코드리뷰(다각도 finder+1표 검증) → CONFIRMED 2건(트렌드 매칭 안전화) 수정. main 머지 후 재-tsc/build/test 그린.

## 에러·교훈
- **교훈 1 (→ PAT-001)**: 사용자가 "여전히 안 보임"을 여러 번 반복한 진짜 원인은 코드가 아니라 **dev 서비스워커가 옛 CSS를 cache-first로 서빙**한 것. HTML(구조)은 최신인데 CSS만 stale이라 "클래스는 붙었는데 규칙이 없는" 흰 버튼이 됨. **헤드리스 스크린샷(SW 없음)은 정상**이라 재현이 꼬였다 → 헤드리스 정상/실브라우저 깨짐이면 클라이언트 SW 캐시를 1순위로 의심하고 computed style을 실측하라.
- **교훈 2**: 좁은 그리드 셀(2열 모바일)에서 4개 버튼 44px는 물리적으로 불가 → **시각 36px + 투명 `::before`로 44px 터치영역**이 정답. 열 수↑=카드↓는 물리법칙이라 "5열+큰 카드"는 max-width 캡 제거로 폭을 늘려야 성립.
- **교훈 3 (PAT-001/002 재확인)**: LLM이 준 `sampleTitles`를 그대로 `.toLowerCase()` 하면 비문자열 원소에서 렌더 크래시. 닫힌집합/LLM 산출물은 코드에서 타입 가드 필수.
- **교훈 4**: 동시 세션이 main을 진전(#14/#15)시켜 머지 충돌 발생. **내 변경만 분리 커밋**해 둔 덕에 충돌 해소가 1파일로 국한됐다 — 작업 격리·선별 스테이징이 충돌 비용을 줄인다.
