---
id: focus-feed-prd
date: 2026-05-18
tags: [focus-feed, prd, product]
---

# Focus Feed — 제품 요구사항(PRD)

> **유지보수**: 기능·플랜·환경이 바뀌면 이 문서의 해당 절과 상단 `date`를 함께 갱신한다. 구현 세부는 코드·`README.md`·`docs/`를 우선한다.

## 1. 한 줄 정의

**YouTube 채널 + RSS를 한 피드로 모아**, 키워드·카테고리로 걸러 보고, **백그라운드 라디오 재생**과 **Gemini 기반 AI 요약·인사이트·피드 Q&A**를 제공하는 **Next.js 기반 웹/PWA** 서비스.

## 2. 해결하는 문제

| 문제 | Focus Feed 대응 |
|------|-----------------|
| 유튜브·뉴스를 앱마다 따로 본다 | 단일 피드 병합, 소식통(블록) 레이아웃 |
| 긴 영상만 보기엔 부담 | 라디오 큐, 재생 중 AI 요약(가사) 패널 |
| 관심사만 빠르게 보고 싶다 | 키워드 필터(localStorage), 카테고리 URL `?category=` |
| 기기 간 채널·북마크 | Supabase Auth + DB(로그인 시) |

## 3. 사용자·플랜

| 플랜 | 조건 | 요약 |
|------|------|------|
| 비로그인 | — | 피드·쿠키 기반 커스텀 채널 등 (코드 기준) |
| `free` | 로그인, Pro 미구독 | 일일 요약·인사이트·피드 Q&A·주간 브리핑 **한도** (`src/lib/usage-limits.ts` 참고) |
| `pro` | Stripe 구독·`user_plan` | AI 한도 완화(구현 기준) |
| `owner` | `OWNER_EMAIL`과 세션 이메일 일치 | 제한 없음 |

한도 상수(변경 시 PRD·문서 동기화): `FREE_DAILY_SUMMARY`, `FREE_DAILY_INSIGHT`, `FREE_DAILY_FEED_QA`, `FREE_WEEKLY_BRIEFING`.

## 4. 핵심 기능 (현재 제품 범위)

1. **피드**: 유튜브 업로드 + RSS 병합, 최신순, 수동 새로고침, 서버 캐시·재검증(`REVALIDATE_SECRET`).
2. **소스**: 기본 소스 + 커스텀 유튜브 채널(쿠키 + 로그인 시 Supabase 동기화 패턴).
3. **카테고리**: `FEED_CATEGORIES` 및 URL 쿼리.
4. **키워드 필터**: 브라우저 `localStorage`만 사용(`src/lib/storage.ts`). URL 쿼리·서버 동기화는 **현재 제품 범위에 포함하지 않음**(개인 기기 단위).
5. **라디오**: 큐, 하단 플로팅 플레이어, 이전/다음, 재생목록·미니영상·전체화면 등(모바일 터치·safe-area 고려).
6. **AI**: Gemini — 3줄 요약, 인사이트, 팀 브리핑, **피드 Q&A**(병합 피드 상위 항목 컨텍스트) 등(서버 액션·사용량·플랜 검사).
7. **북마크·플레이리스트**: 로그인 연동 페이지·API 존재.
8. **팀**: 팀 생성·초대·조인·팀별 북마크/브리핑 등 라우트 (`/teams`, `/teams/join`, …).
9. **결제**: `/pricing`, Stripe 환경 변수(`.env.example` 참고).
10. **인증**: Supabase Google OAuth, `NEXT_PUBLIC_SITE_URL` 배포 시 필수.
11. **PWA**: `public/app.webmanifest`, 서비스 워커·`PwaInstaller` (아이콘·캐시 정책은 코드·manifest 기준).
12. **테마**: 기본 라이트, 시스템 전환 가능(`ThemeProvider`).

## 4.1 피드 Q&A (M5)

| 항목 | 정책 |
|------|------|
| 로그인 | **필수**(비로그인은 `checkUsageLimit`에서 거절). |
| 멀티턴 | 직전 **최대 6턴**(사용자+어시스턴트)을 프롬프트에 포함. **브라우저 `localStorage`**에 스레드 저장(소스별 키). |
| 컨텍스트 | 서버 `getMergedFeed` + 사용자 커스텀 소스 병합, 최신순 상위 **50**개(단일 소스 보기 시 해당 소스만). 클라이언트 키워드·카테고리 필터는 반영하지 않을 수 있음. |
| 질문 길이 | 최대 500자, 공백 제외 최소 2자. |
| Free 일일 한도 | `FREE_DAILY_FEED_QA`(기본 5), `usage_daily.feed_qa_count` (`docs/supabase-migrations/002_usage_daily_feed_qa.sql`). |
| 저장 | 서버에 **대화 영구 저장 없음**; 클라이언트 스레드는 `localStorage` + 마크다운 복사. **Todoist**는 첫 질문 텍스트로 빠른 추가 링크만 제공(OAuth 미연동). |
| 모델 | Gemini Flash 계열(`src/app/actions/feed-qa.ts`). |

## 5. 비기능·품질

- **스택**: Next.js 16, React 19, TypeScript, Tailwind 4.
- **보안**: API 키·서비스 롤은 서버만; 클라이언트는 `NEXT_PUBLIC_*`만.
- **Gemini 남용 완화**: 로그인 사용자·비로그인(IP)별 **분당 버스트 제한**(`src/lib/gemini-rate-limit.ts`, 액션 종류에 `feed_qa` 포함). 트렌드 레이더는 **IP당 시간당** Gemini 호출 제한.
- **검증**: `npm run lint`, `npm run build`; 주요 플로우는 README 점검 목록 참고.

## 6. 환경 변수 (요약)

전체 목록·설명은 **`.env.example`** 이 단일 소스. 배포 시 특히:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (OAuth·결제 리다이렉트)
- `YOUTUBE_API_KEY`, `GEMINI_API_KEY`
- Stripe·`OWNER_EMAIL` (해당 기능 켤 때)

선택(기본값 있음, 상세는 `.env.example`):

- `GEMINI_ACTIONS_PER_MINUTE`, `GEMINI_ANON_ACTIONS_PER_MINUTE`, `GEMINI_TREND_PER_HOUR_PER_IP`
- `MAX_MERGED_FEED_ITEMS` — 병합 피드 최대 노출(50~2000, 기본 500)
- `ENABLE_DEBUG_YOUTUBE` — **프로덕션**에서만 `/api/debug-youtube` 노출 시 `true`/`1` (기본 비활성)

## 7. 문서 역할 분리

| 문서 | 역할 |
|------|------|
| `docs/MILESTONES.md` | **우선순위 마일스톤**(M1~M6, 완료 체크) |
| `docs/MOBILE_QA_CHECKLIST.md` | **모바일·PWA 수동 QA** 체크리스트 |
| `docs/PRD.md` (본 문서) | 제품 범위·플랜·기능 개요 |
| `README.md` | 설치·실행·환경 변수 요약·점검 체크리스트 |
| `AGENTS.md` | Cursor Agent용 리포지토리 지침 |
| `CLAUDE.md` | Claude Code 등 외부 Claude 세션용 컨텍스트 |
| `.cursor/rules/*.mdc` | 에디터 내 코딩 규칙 |
| `CURSOR_HANDOFF.md` | 과거 Supabase 페이즈 핸드오프(**내용이 오래됐을 수 있음**; 상충 시 코드·본 PRD 우선) |
| `docs/cursor_implementation_guide.md` | 구현 상세 가이드(있는 경우) |
| `docs/DEPLOYMENT_CHECKLIST.md` | Vercel 등 배포 전 환경 변수·동작 확인 |

## 8. 범위 밖·향후 (예시)

- 앱 스토어 네이티브 앱(현재는 웹/PWA 중심).
- PRD에 없는 기능은 **이슈/로드맵**에 올린 뒤 본 문서에 반영.

## 9. 기술 백로그 (후속 우선순위 참고)

| 구분 | 내용 | 상태 |
|------|------|:----:|
| 성능 | 피드 대량 시 **가상 스크롤·소스별 페이지네이션**, YouTube 쿼터 추가 절감 | 남음 |
| 성능 | 티커 아닌 단일 리스트 **더 보기** 절진 로드(`FeedList`) | 반영 |
| 성능 | 병합 피드 **상한** `MAX_MERGED_FEED_ITEMS`(기본 500, `src/lib/feed.ts`) | 반영 |
| 품질 | Vitest·스모크·GitHub Actions·Playwright E2E(`e2e/`) | 부분 |
| 품질 | 세그먼트별 `error` 경계 확대 | 남음 |
| 제품 | 종합 트렌드(`TrendRadarBar` + `/trends`), 피드 Q&A 멀티턴·복사·Todoist 링크 — `docs/focus_feed_audit_report.md` | 부분 |
| UX | 모바일 라디오·드로어 잔여 이슈 | 남음 |
| UX | Free **한도 임박** 안내(`UsageBadge` 앰버 배너) | 반영 |
| UX | 메인 스크롤 `touch-pan-y`·`overscroll-y-contain` (`AppLayout`) | 반영 |
| 코드 | `FloatingRadioPlayer` `radioRef` + rAF 내부 최신 큐 | 반영 |
| 코드 | YT Player 수명·남은 `exhaustive-deps` 정리 | 부분 |
| 코드 | Supabase `as any` → `Insert`/`Update` + `as never` (`src` 기준) | 반영 |

## 10. 변경 이력

| date | 내용 |
|------|------|
| 2026-05-17 | 초안: 코드베이스·README·`.env.example` 기준으로 통합 작성 |
| 2026-05-17 | 배포 체크리스트·Gemini 레이트 리밋·프로덕션 debug-youtube 차단·루트 `error.tsx`·팀 생성 타입 정리 |
| 2026-05-17 | P2/P3 부분: 피드 상한·Vitest·한도 임박 배너·메인 터치 스크롤·라디오 훅 의도 주석 |
| 2026-05-18 | 키워드 필터 저장 정책 확정: **B** — `localStorage`만 사용, URL·Supabase 동기화는 범위 밖 |
| 2026-05-18 | 유튜브 카드(`YouTubeCard`) 제목·채널·메타 타이포 상향, 음수 마진 제거, 액션 줄 간격 |
| 2026-05-18 | `FeedHeader`·`KeywordFilter` 레이아웃: 음수 마진·`translateY`·픽셀 마진 props 제거, `flex`/간격으로 정리 |
| 2026-05-18 | 피드 Q&A(M5)·`usage_daily.feed_qa_count` 마이그레이션·UsageBadge·CI 워크플로 |
| 2026-05-18 | `/trends` 대시보드·피드 Q&A 멀티턴·Playwright·모바일 QA 문서·피드 `content-visibility` |
