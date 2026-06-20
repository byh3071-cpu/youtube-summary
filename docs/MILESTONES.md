---
id: focus-feed-milestones
date: 2026-05-18
tags: [focus-feed, roadmap, milestones]
---

> **원칙**: 한 마일스톤은 **배포 가능한 단위**로 끝낸다. 완료 시 `docs/PRD.md` §9·본 문서 표를 갱신한다.

## 총괄 표

| 단계 | 이름 | 목표 | 완료 정의 |
|:----:|------|------|-----------|
| **M1** | 기준선·문서 | 단일 로드맵, PRD·체크리스트와 링크 | 본 파일·README 링크 존재 |
| **M2** | 피드 규모 | 서버 병합 상한 + 클라이언트 점진 렌더 | [x] |
| **M3** | 타입·DB 쓰기 | `src` 내 Supabase `as any` 제거, `Insert`/`Update` + `as never` | [x] |
| **M4** | 라디오 안정성 | YT 콜백에서 최신 큐 참조 | [x] |
| **M5** | 제품 확장 | 트렌드 종합 뷰·피드 Q&A | 트렌드 바+`/trends`·Q&A+PRD §4.1·002 SQL |
| **M6** | 모바일·회귀 | 잔여 터치 이슈, E2E 최소 시나리오 | MOBILE_QA 문서·Playwright·CI 전체 |
| **M7** | 품질 안정화(QA 후속) | 2026-06-11 감사 P0/P1 해소: 플레이리스트 보안, PWA 캐시, 모바일 UX, API 오류 분류 | 본 문서 M7 절·E2E 데스크톱/모바일 프로젝트 |
| **M8** | 보안·법적 정합 + 개인 연구 기반 + UX P0 | 6/11 감사 잔여 P0/P1, 콘텐츠 상태 모델, UX 시각 파손 | PR #5~#10·본 문서 M8 절 (런타임 미검증) |

## M1 — 기준선·문서

- [x] `docs/MILESTONES.md` (본 문서)
- [x] `docs/PRD.md` §9 백로그와 연동
- [x] `docs/DEPLOYMENT_CHECKLIST.md`
- [x] CI에서 `lint` + `build` + `test:unit` (`.github/workflows/ci.yml`)

## M2 — 피드 규모

- [x] `getMergedFeed` 병합 후 상한 (`src/lib/feed.ts`, `MAX_MERGED_FEED_ITEMS`)
- [x] 소식통 레이아웃: 유튜브/RSS `더 보기` (기존 `FeedList`)
- [x] **티커 아님**(`useTickerLayout={false}`) 단일 리스트도 점진 로드

## M3 — 타입·DB

- [x] `POST /api/teams` 팀 생성
- [x] `POST /api/bookmarks`, `POST /api/custom-sources`, 팀 초대·가입·팀 PATCH·플레이리스트 저장 — `Insert`/`Update` + `as never`
- [x] `src` 전체 `as any` 제거(검색 기준)

## M4 — 라디오

- [x] `FloatingRadioPlayer`: `radioRef`로 콜백·rAF 내부에서 최신 `radio` 참조
- [ ] 장기: YT Player 생성/파괴를 `videoId` 전환에만 묶이도록 구조 분리 (선택·고비용 리팩터)

## M5 — 제품 확장 (별도 스프린트)

- [x] **종합 트렌드**: 상단 `TrendRadarBar` + **`/trends`** 워드클라우드·상세(`getTrendRadar` + 캐시)
- [x] **피드 Q&A**: 멀티턴·`localStorage`·마크다운 복사·Todoist 빠른 추가 링크·Free 한도·`002_usage_daily_feed_qa.sql`
- [ ] **Notion OAuth·양방향 동기화** 등 — 별도 제품 결정 후

## M6 — 모바일·회귀

- [x] 메인 `touch-pan-y`·`overscroll-y-contain`, 드로어 `overscroll-contain`, 사용량 임박 배너
- [x] GitHub Actions: `lint`, `build`, `test:unit`, **`test:e2e`** (`main`/`master` push·PR)
- [x] 실기기 QA 목록: `docs/MOBILE_QA_CHECKLIST.md` (수동 실행)
- [x] Playwright 스모크: `e2e/smoke.spec.ts`

## M7 — 품질 안정화 (2026-06-11 브라우저 감사 후속)

- [x] **P0 플레이리스트 보안**: 서버 DB 플레이리스트는 **로그인 사용자 전용**(저장 401, 조회 격리, rename/delete 소유권 `.eq("user_id")`). 기존 `user_id IS NULL` 행은 노출·자동귀속 금지, 운영자 수동 검토(`005_playlists_owner_required.sql`).
- [x] **PWA**: SW 캐시 재설계(navigation network-first·HTML 미캐시, API/RSC/auth 미캐시, `/offline.html`), manifest 단일화·정사각 아이콘 192/512, orientation 제한 제거.
- [x] **모바일 UX**: 모달 body 스크롤 잠금(`src/lib/body-scroll-lock.ts`), Q&A z-index·safe-area, 필터/뷰 전환 360px 대응, 핵심 버튼 44px, 빈 라디오 안내 모바일 dismissible, ThemeToggle UI 연결.
- [x] **API 오류 분류**: YouTube `API key expired` 등 → `invalid_api_key`(연동 설정 오류), Gemini `GeminiFailureKind` 분류·공용 메시지, RSS HTML 엔티티 디코딩, 비로그인 custom-sources 401 콘솔 소음 제거.
- [x] **E2E**: 데스크톱/모바일 Chromium 프로젝트 분리, 라우트·필터·뷰 전환·Q&A·스크롤 잠금·터치 타깃·테마·PWA 캐시·익명 401 회귀. WebKit 모바일은 수동 QA로 명시.
- [ ] 운영: `005` 마이그레이션 운영 DB 적용, 실 OAuth·Stripe·iOS Safari PWA 수동 검증.

## M8 — 보안·법적 정합 + 개인 연구 기반 + UX P0 (2026-06-20)

> PR #5~#10. **주의: 모든 검증이 빌드·타입·린트·단위테스트 레벨이며 실제 브라우저 런타임은 미검증이다.** 상세 적대적 검증·잔여 작업·다음 세션 프롬프트는 `docs/HANDOFF_2026-06-20_NEXT_SESSION.md`.

- [x] **보안(PR #5)**: 자동 Notion 동기화 제거·서버액션 owner 전용+레이트리밋, `next 16.2.9`(prod critical/high 0), 보안 응답 헤더 5종, resolve-channel IP 레이트리밋·trends 강제 새로고침 owner 전용.
- [x] **계정·법적(PR #5)**: 데이터 내보내기(`/api/account/export` + 내 계정 UI), 약관·개인정보 실제 구현에 맞게 정정(Gemini·Notion 전송 명시, 해지·삭제 문의처 안내).
- [x] **콘텐츠 상태 모델(PR #5/#6)**: `008_content_states.sql`(RLS·전이 검증), 타입·전이규칙, 인박스 선별 UI(처리 대기/제외 + 상태 필터 칩, 제외 항목 피드 숨김).
- [x] **UX P0(PR #7/#10)**: 라이트 아이콘 400 수정, 카드 버튼 줄바꿈 방지·모바일 아이콘화, 카드 액션 과밀 완화(선별→더보기), ScrollToTop↔Q&A 겹침 제거, 환영 배너 모바일 컴팩트, 모바일 메뉴 햄버거 affordance.
- [ ] **런타임 검증**: 로그인 + Supabase + `005`/`008` 적용 상태에서 인박스 선별·데이터 내보내기·보안 헤더·proxy 회귀를 실제 브라우저로 확인.
- [ ] **잔여 UX**: UX-21 e2e 회귀 테스트, UX-40/41(라디오 피드백·카드 밀도), UX-12 잔여, UX-50~52(제품 차별화).

## 변경 이력

| date | 내용 |
|------|------|
| 2026-05-18 | 초안(M1~M6)·M5/M6·`/trends`·Q&A 멀티턴·Playwright·모바일 QA 문서 |
| 2026-06-11 | M7 품질 안정화: 플레이리스트 로그인 전용, PWA 캐시 재설계, 모바일 UX, API 오류 분류, E2E 확대 |
| 2026-06-20 | M8 보안·법적 정합(자동 Notion 차단·next 16.2.9·헤더·비용 가드·데이터 내보내기·약관 정합), 콘텐츠 상태 모델·인박스 선별, UX P0(아이콘·줄바꿈·플로팅·첫화면). 런타임 미검증 |
