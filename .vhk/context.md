# 프로젝트 컨텍스트

> 이 파일은 `vhk context`로 자동 생성되었습니다.
> AI 어시스턴트에게 프로젝트 맥락을 제공합니다.

## 원본 지도 (Source of Truth)

> 무엇을 고칠 땀 "원본" 한 곳만 고치세요. 나머지는 파생본이라 자동 생성됩니다.

- **규칙(원본)**: `RULES.md` — 규칙은 여기 한 곳에서만 수정
- **작업 상태**: `docs/state/next-task.md`, `docs/state/blockers.md`
- **버전·릴리스**: `package.json`, `CHANGELOG.md`
- **명령 목록**: `COMMANDS.md` (+ `vhk help`)
- **파생본(직접 수정 금지)**: `.cursorrules`·`.windsurfrules`·`.github/copilot-instructions.md`·`AGENTS.md`·`GEMINI.md` 등 7종 + `CLAUDE.md` 규칙 영역 → `vhk sync` 로 생성

## 기술 스택

- **프레임워크**: Next.js 16.1.6
- **언어**: TypeScript ^5
- **스타일**: Tailwind CSS ^4
- **테스트**: vitest
- **패키지 매니저**: npm
- **패키지 이름**: focus-feed
- **버전**: 0.1.0

## 디렉토리 구조

```text
├── .env.example
├── AGENTS.md
├── AI_COLLABORATION.md
├── artifacts/
│   ├── audit-runtime/
│   │   ├── server.stderr.log
│   │   └── server.stdout.log
│   ├── audit-runtime-final/
│   │   ├── server.stderr.log
│   │   └── server.stdout.log
│   ├── ux-audit-2026-06-11T02-03-29-265Z/
│   │   ├── desktop-bookmarks.png
│   │   ├── desktop-home.png
│   │   ├── desktop-landing.png
│   │   ├── desktop-login.png
│   │   ├── desktop-playlists.png
│   │   ├── desktop-pricing.png
│   │   └── desktop-trends.png
│   ├── ux-audit-2026-06-11T02-05-13-723Z/
│   │   ├── desktop-bookmarks.png
│   │   ├── desktop-home.png
│   │   ├── desktop-landing.png
│   │   ├── desktop-login.png
│   │   ├── desktop-playlists.png
│   │   ├── desktop-pricing.png
│   │   └── desktop-trends.png
│   ├── ux-audit-2026-06-11T02-08-42-218Z/
│   │   ├── mobile-bookmarks.png
│   │   ├── mobile-home.png
│   │   ├── mobile-landing.png
│   │   ├── mobile-login.png
│   │   ├── mobile-playlists.png
│   │   ├── mobile-pricing.png
│   │   ├── mobile-trends.png
│   │   └── report.json
│   ├── ux-audit-2026-06-11T02-10-19-843Z/
│   │   ├── mobile-home.png
│   │   ├── mobile-qna-open.png
│   │   └── report.json
│   ├── ux-audit-2026-06-11T02-13-25-096Z/
│   │   ├── mobile-home.png
│   │   ├── mobile-qna-open.png
│   │   └── report.json
│   └── ux-audit-2026-06-11T02-13-33-435Z/
│       └── desktop-home.png
├── AUTH_SETUP.md
├── CLAUDE.md
├── CURSOR_HANDOFF.md
├── docs/
│   ├── AGENT_WORKFLOW_INSIGHTS.md
│   ├── AI_VISION_BROAD.md
│   ├── archive/
│   │   ├── ANTIGRAVITY_PARALLEL_TASKS.md
│   │   ├── ANTIGRAVITY_QA_LOGS.md
│   │   ├── CHECKLIST.md
│   │   ├── CURSOR_PARALLEL_TASKS.md
│   │   ├── CURSOR_PHASE6_COMPLETION_LOG.md
│   │   ├── CURSOR_PHASE7_COMPLETION_LOG.md
│   │   ├── MVP_소식통_카테고리_기획.md
│   │   ├── NEXT_STEPS_SUPABASE.md
│   │   ├── SUPABASE_CHANNEL_SYNC_TODO.md
│   │   ├── UI_UX_REPORT.md
│   │   └── UI_UX_REVIEW_AND_TRENDS.md
│   ├── AUTH_SETUP.md
│   ├── CLAUDE_CODE_FULL_STACK_REMEDIATION_HANDOFF.md
│   ├── CLAUDE_CODE_QA_REMEDIATION_HANDOFF.md
│   ├── CODE_REVIEW_FIXUP_HANDOFF_2026-06-11.md
│   ├── cost_analysis_report.md
│   ├── cursor_implementation_guide.md
│   ├── DATA_PROTECTION.md
│   ├── DEEPDIVE_DIGEST_HANDOFF_2026-06-11.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── DIGEST_HANDOFF_2026-06-11.md
│   ├── final_strategy_report.md
│   ├── focus_feed_audit_report.md
│   ├── FOCUS_FEED_FULL_STACK_AUDIT_2026-06-11.md
│   ├── HACKATHON_REVENUE_ANGLE.md
│   ├── IMAGE_GENERATION_PROMPTS.md
│   ├── IMPLEMENTATION_STEPS_DETAIL.md
│   ├── MASTER_STATUS_VISION.md
│   ├── MILESTONES.md
│   ├── MOBILE_QA_CHECKLIST.md
│   ├── OWNER_AND_IMPLEMENTATION_ROADMAP.md
│   ├── PERSONAL_CONTENT_RESEARCH_SYSTEM_SPEC.md
│   ├── PRD.md
│   ├── RADIO_PLAYER_ICONS.md
│   ├── refactoring_walkthrough.md
│   ├── REVIEW_IMPLEMENTATION.md
│   ├── strategic_roadmap.md
│   ├── supabase-migrations/
│   │   ├── 001_plan_usage_playlists.sql
│   │   ├── 002_usage_daily_feed_qa.sql
│   │   ├── 002_user_plan_stripe.sql
│   │   ├── 003_teams.sql
│   │   ├── 004_custom_sources.sql
│   │   ├── 005_playlists_owner_required.sql
│   │   ├── 006_video_digests.sql
│   │   └── 007_video_digest_video_mode.sql
│   ├── SUPABASE_BOOKMARKS_TABLE.md
│   ├── TARGET_ALIGNMENT_AND_EXTENSION.md
│   ├── vhk-issues.json
│   ├── VHK_ADOPTION.md
│   └── WORK_REPORT_2026-06-11_QA_REMEDIATION.md
├── e2e/
│   ├── anon-flows.spec.ts
│   ├── mobile-ux.spec.ts
│   ├── pwa.spec.ts
│   ├── routes.spec.ts
│   └── smoke.spec.ts
├── eslint-report.txt
├── eslint.config.mjs
├── eslint.txt
├── eslint_out.json
├── eslint_report.json
├── lint_output.txt
├── mockups/
│   └── digest-ui-compare.html
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── public/
│   ├── app.webmanifest
│   ├── file.svg
│   ├── focus-feed-logo-v2.png
│   ├── focus-feed-wordmark-v5.png
│   ├── globe.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── images/
│   │   ├── empty/
│   │   ├── hero/
│   │   ├── icons/
│   │   └── og/
│   ├── next.svg
│   ├── offline.html
│   ├── rogo.png
│   ├── sw.js
│   ├── vercel.svg
│   └── window.svg
├── README.md
├── RULES.md
├── scripts/
│   ├── resize-pwa-icons.mjs
│   ├── run-e2e.mjs
│   ├── scan-secrets.mjs
│   ├── smoke-test.mjs
│   ├── ux-audit.mjs
│   ├── verify-focus-feed.mjs
│   ├── verify-supabase-schema.mjs
│   └── vhk-guard.mjs
├── src/
│   ├── app/
│   │   ├── actions/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── bookmarks/
│   │   ├── error.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── landing/
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── login/
│   │   ├── page.tsx
│   │   ├── playlists/
│   │   ├── pricing/
│   │   ├── privacy/
│   │   ├── profile/
│   │   ├── teams/
│   │   ├── terms/
│   │   └── trends/
│   ├── components/
│   │   ├── auth/
│   │   ├── feed/
│   │   ├── layout/
│   │   ├── player/
│   │   ├── PwaInstaller.tsx
│   │   ├── team/
│   │   ├── ThemeProvider.tsx
│   │   ├── trend/
│   │   └── ui/
│   ├── contexts/
│   │   ├── RadioQueueContext.tsx
│   │   └── TrendFilterContext.tsx
│   ├── instrumentation.ts
│   ├── lib/
│   │   ├── body-scroll-lock.ts
│   │   ├── custom-sources-cookie.ts
│   │   ├── digest/
│   │   ├── env.ts
│   │   ├── feed.ts
│   │   ├── filter.ts
│   │   ├── focus-feed-storage.ts
│   │   ├── gemini-rate-limit.ts
│   │   ├── gemini.ts
│   │   ├── goals.ts
│   │   ├── html-entities.test.ts
│   │   ├── html-entities.ts
│   │   ├── llm-json.ts
│   │   ├── merged-session-sources.ts
│   │   ├── notion-client.ts
│   │   ├── notion-content.ts
│   │   ├── notion-section-analyzer.ts
│   │   ├── plan.ts
│   │   ├── playlists-server.test.ts
│   │   ├── playlists-server.ts
│   │   ├── prompts.ts
│   │   ├── qa-log.ts
│   │   ├── rate-limit.test.ts
│   │   ├── rate-limit.ts
│   │   ├── recommendations.ts
│   │   ├── rss.ts
│   │   ├── sources.ts
│   │   ├── storage.ts
│   │   ├── supabase-browser.ts
│   │   ├── supabase-server-cookies.ts
│   │   ├── supabase-server.ts
│   │   ├── usage-limits.ts
│   │   ├── use-is-hydrated.ts
│   │   ├── video-context.ts
│   │   ├── video-transcript.ts
│   │   ├── watch-history.ts
│   │   ├── youtube-channel-parse.ts
│   │   ├── youtube-status.ts
│   │   └── youtube.ts
│   ├── proxy.ts
│   └── types/
│       ├── feed.ts
│       └── teams.ts
├── supabase/
│   └── indexes.sql
├── test-results/
├── tmp/
│   ├── list_models.js
│   ├── list_models.py
│   ├── models.json
│   ├── models_abs.txt
│   ├── models_final.txt
│   ├── models_full.json
│   ├── models_list.txt
│   ├── models_utf8.txt
│   ├── payload.json
│   └── test_gemini.js
├── tsconfig.json
├── tsconfig.tsbuildinfo
└── vitest.config.ts
```

## VHK CLI 명령어

- `vhk gate — 아이디어 검증`
- `vhk start — 새 프로젝트 시작 마법사`
- `vhk init — 하네스 파일 생성`
- `vhk recap — 오늘 한 일 정리 + ADR 분리`
- `vhk sync — RULES.md → 규칙 파일 동기화`
- `vhk check — RULES.md 규칙 점검`
- `vhk secure — 보안 스캔 (시크릿 유출 검사)`
- `vhk cloud — .vhk 클라우드 백업·복원 (push/pull)`
- `vhk ship — 배포 체크리스트 + 회고`
- `vhk doctor — 개발 환경 점검 (+ --strict 드리프트 게이트)`
- `vhk save — git 저장 (add → commit → push)`
- `vhk undo — 최근 커밋 되돌리기`
- `vhk restore — sync 백업 복원`
- `vhk status — 프로젝트 상태 대시보드`
- `vhk stats — 통계 대시보드 — 패스율/차단율/진화 적용율 (읽기 전용)`
- `vhk diff — Git 변경사항 한국어 요약`
- `vhk diff-cover — 이번 변경이 테스트로 커버됐는지 측정 (자문형)`
- `vhk mcp — MCP 서버 시작 (stdio)`
- `vhk mcp-init — Cursor·Claude Desktop MCP 설정 생성`
- `vhk deploy — 프로덕션 배포 (자동 감지)`
- `vhk env — .env → .env.example 동기화`
- `vhk env-check — 필수 환경변수 누락 검사`
- `vhk publish — npm 배포 (버전 범프 → 빌드 → 테스트)`
- `vhk design — 디자인 토큰 생성`
- `vhk design-palette — 컬러 팔레트 프리셋 선택`
- `vhk theme — 다크/라이트 모드 CSS 생성`
- `vhk ref — 레퍼런스 URL 관리 (add/list/open)`
- `vhk harness — 통합 품질 점검 (lint+type+test+build)`
- `vhk audit — 보안 취약점 감사 (npm audit)`
- `vhk migrate — 패키지 매니저 전환 (npm/yarn/pnpm)`
- `vhk update — VHK CLI 셀프 업데이트`
- `vhk context — 프로젝트 맥락 파일 생성 (.vhk/context.md)`
- `vhk mode — Safety Mode 조회/변경 (lite|standard|strict)`
- `vhk verify — 검증 게이트 실행 + 증거 기록`
- `vhk cost — 비용·예산 가드 — add/check/budget (자문형)`
- `vhk preflight — 출고 전 안전점검 (2FA·shim·env·lint·타입·테스트·git, 치명 시 차단)`
- `vhk testmap — test-first 매핑 점검 (변경 기능 ↔ 테스트 누락 경고)`
- `vhk worktree — worktree 가드 — 생성 시 env/설정 자동 복사·누락 점검 (add/check)`
- `vhk standup — 아침 브리핑 (어제 한 일 + 오늘 추천 goal + 미해결)`
- `vhk today — 저녁 자축·회고 (오늘 커밋·완료 goal 카운트 + 격려)`
- `vhk review — 적대적 자기검증 (거짓완료 의심 탐지)`
- `vhk mission — 미션 계약 — 작업 목표·허용/금지 범위 선언·검증`
- `vhk context-show — 컨텍스트 파일 내용 출력`
- `vhk memory — 기억 관리 v2 (decisions/failures/successes)`
- `vhk recall — 기억 회상 (자연어 키워드 검색 — RFC 0049)`
- `vhk brief — 프로젝트 요약 보고서 생성`
- `vhk work — AI 작업 시작/이어하기 (+ handoff)`
- `vhk goal — Goal 단계별 미션 관리`
- `vhk blocker — 블로커 기록 (3건 누적 시 HARD_STOP)`
- `vhk learn — 교훈 기록 → memory v2 단일 SoT`
- `vhk resume — .vhk/HARD_STOP 해제 (--confirm 필요)`
- `vhk pattern — 반복 패턴 감지·목록 (avoid/reinforce)`
- `vhk evolve — 패턴 → 룰 후보 제안·반영·undo`
- `vhk seo — SEO·수익 대시보드 (init: 사이트 등록 + 자격증명 보관)`

---

_생성: 2026. 6. 12. 오후 6:45:48_
_vhk-context-git: 108342d339ae83d61af9a93c9f3e5416f9f6b469_
