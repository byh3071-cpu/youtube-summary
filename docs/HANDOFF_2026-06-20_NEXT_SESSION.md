---
id: focus-feed-handoff-2026-06-20-next-session
date: 2026-06-20
tags: [focus-feed, handoff, security, content-state, ux, next-session, adversarial-review]
---

# Focus Feed — 다음 세션 핸드오프 (2026-06-20)

이 문서는 **새 채팅 세션이 컨텍스트 0에서 바로 이어가도록** 만든 핸드오프다.
2026-06-20 세션의 완료분, **적대적 검증(거짓완료·미검증·회귀 위험)**, 잔여 작업, 운영자 선행 작업, 그리고 §7의 **마스터 프롬프트**를 담는다.

## 0. 한 줄 요약

보안 P0/P1·콘텐츠 상태 모델·UX P0를 PR #5~#10으로 main에 머지했다. **그러나 모든 검증은 빌드·타입·린트·단위테스트 레벨이며, 실제 브라우저/로그인/Supabase/마이그레이션 환경의 런타임 동작은 한 번도 확인하지 않았다.** 다음 세션의 1순위는 기능 추가가 아니라 **런타임 검증**이다.

## 1. 이번 세션 완료분 (PR #5~#10)

| PR | 범위 |
|---|---|
| **#5** | 보안: 자동 Notion 동기화 제거·서버액션 owner 전용+레이트리밋, `next 16.2.9`(prod critical/high 0), 보안 헤더 5종, resolve-channel IP 레이트리밋, trends 강제 새로고침 owner 전용 / 계정·법적: 데이터 내보내기, 약관·개인정보 정합 / 콘텐츠 상태 모델 설계(008·타입·전이) |
| **#6** | `content_states` 데이터 레이어(Database 타입·서버 액션) + 인박스 선별 UI(ContentStateControl) |
| **#7** | UX-10(아이콘 400)·UX-11(버튼 줄바꿈)·UX-12(카드 과밀) + 인박스 선별 반영(제외 숨김·상태 필터 칩) |
| **#10** | UX-20(ScrollToTop↔Q&A 겹침)·UX-31(배너 컴팩트)·UX-32(메뉴 햄버거) |

> main에는 이 외에 **사용자가 추가한 Notion 그래프 쓰기**(인물 upsert·트리플맵, `NOTION_WRITE_GRAPH` 플래그)가 `notion-sync.ts`/`notion-client.ts`에 들어와 있다. owner 가드는 공유된다.

## 2. 적대적 검증 — 거짓완료 / 미검증 / 회귀 위험

**대전제: "빌드 그린 = 동작함"이 아니다.** 아래는 모두 정적 검증만 통과했고 런타임 미확인이다.

1. **런타임 0 검증 (전체)** — PR #5~#10 어느 것도 실제 브라우저·로그인·Supabase·마이그레이션 적용 환경에서 돌려보지 않았다. `npm install`로 의존성 복구 후 build/tsc/lint/unit(51)만 통과.
2. **`content_states` 동작 미확인** — `008` 마이그레이션이 운영/로컬 DB에 없으면 상태 저장이 에러로 떨어진다(조회는 조용히 무시). 인박스 선별 클릭→저장→기기 간 동기화가 실제로 되는지 확인 안 됨.
3. **선별 필터 부작용(설계 결함 의심)** — 상태 필터 칩에서 `처리 대기`/`제외함` 선택 시, 상태가 없는 항목은 모두 빠진다. **RSS 카드는 ContentStateControl이 아직 연결되지 않아(②보류) RSS 상태를 만들 수 없으므로, `처리 대기` 필터에서 RSS가 전부 사라진다.** `contentIdForItem`(YouTube=`id`, RSS=`rss:link`)이 실제 피드와 매칭되는지도 미검증.
4. **OWNER_EMAIL 의존** — `notion-sync`(+그래프 쓰기)·`trends?refresh=1`이 `getPlanForUser`의 `OWNER_EMAIL` 비교에 의존한다. 미설정 시 "노션 정리"가 **항상 차단**된다. owner 경로 실제 동작 미검증.
5. **`next 16.2.9` 회귀** — `src/proxy.ts`/middleware/Server Actions가 빌드는 통과하나, 실제 인증·세션 갱신·redirect 흐름은 미확인. (감사 핸드오프 PLAT-01이 요구한 proxy 회귀 테스트 미수행.)
6. **보안 헤더** — `next.config.ts`에 추가했으나 `next start` + 실제 응답 헤더 확인 안 함. **CSP는 의도적으로 미포함**(YouTube iframe·OAuth·Stripe를 깨뜨릴 수 있어 report-only 관찰 후 별도 도입 필요).
7. **UX-20 겹침** — ScrollToTop을 `bottom 9rem`로 올려 Q&A(`5.5rem`, h-12) 위로 분리했으나 좌표 실측은 안 함. **라디오 미니플레이어(큐가 있을 때)의 높이가 5rem을 넘으면 Q&A 버튼을 가릴 수 있다** — 실기기 확인 필요.
8. **데이터 내보내기** — `/api/account/export` 실제 호출·다운로드 미검증. `005` RLS 적용 환경에서 anon 클라이언트의 playlists 조회가 정책과 맞는지 확인 필요.
9. **E2E 회귀 부재** — UX-21(Q&A 클릭성) 등 회귀 테스트를 만들지 않았다. 변경에 대한 자동 회귀 방지 없음.
10. **약관·개인정보** — 문구만 현 구현에 맞췄을 뿐, 법률 검토는 운영자 몫.

## 3. 운영자(사람) 선행 작업 — 없으면 기능이 동작하지 않는다

1. **`OWNER_EMAIL` 환경변수** 설정 확인(본인 이메일). 비면 노션 정리·트렌드 강제 새로고침이 막힌다.
2. **마이그레이션 운영 DB 적용**: Supabase SQL Editor에서 `docs/supabase-migrations/005_playlists_owner_required.sql`, `008_content_states.sql` 실행.
3. **약관/개인정보 법률 검토** (해지·삭제·국외이전 표현).
4. (선택) `NOTION_WRITE_GRAPH`, `NOTION_TOKEN` 등 Notion 그래프 쓰기 환경.

## 4. 잔여 작업 (우선순위)

1. **[P0] 런타임 검증** — `.env.local` + Supabase + `005`/`008` 적용 + 로그인 상태에서: 인박스 선별 저장·기기 간 동기화, 데이터 내보내기, owner 전용 노션 정리, proxy 인증/세션, 보안 응답 헤더(`next start` + curl), UX-10/11/20 실제 렌더를 직접 확인.
2. **[P0] 선별 필터 부작용 수정** — RSS에 ContentStateControl 연결(아래 4번)하거나, 상태 필터가 RSS를 부당하게 숨기지 않도록 로직 보완.
3. **[P1] UX 잔여** — UX-21(Q&A 클릭성 e2e, `e2e/mobile-ux.spec.ts`), UX-40/41(라디오 추가 피드백·모바일 카드 밀도), UX-12 잔여(카드 1차/2차 액션 정리).
4. **[P1] 인박스 ② RSS 연결** — `FeedItem.tsx`에 ContentStateControl 추가(`contentIdForItem`로 `rss:link`). FeedList의 RSS 섹션에서 상태 전달.
5. **[P2] 스펙 Phase 2** — 재생 위치 **서버 저장**(현재 localStorage, `content_states.play_position_seconds` 활용), 타임스탬프 메모.
6. **[P2] 제품 차별화** — UX-50(Today Queue/피드 DJ), UX-51(왜 중요한가 배지), UX-52(저장 후 정리 흐름) — 별도 제품 스프린트.
7. **[P2] 문서 정합** — `docs/PRD.md` §9 백로그에 M8 구현 범위(보안·콘텐츠 상태 모델·데이터 내보내기·UX P0)를 반영한다. 현재는 `MILESTONES.md` M8에만 기록돼 있다(UX-62 후속).

근거 문서: 제품 방향 `docs/PERSONAL_CONTENT_RESEARCH_SYSTEM_SPEC.md`, UX 분해 `docs/UX_IMPROVEMENT_HANDOFF_2026-06-20.md`, 보안 잔여 `docs/CLAUDE_CODE_FULL_STACK_REMEDIATION_HANDOFF.md`.

## 5. 절대 규칙 (CLAUDE.md/RULES.md 발췌)

- VHK는 반드시 `npm run vhk -- <command>`. `vhk sync`·git 자동화·배포는 사용자 승인 없이 실행 금지.
- 커밋/푸시/머지는 사용자가 명시할 때만. main이면 브랜치 먼저.
- 비밀값(`.env.local`, 키)을 출력·수정·커밋하지 않는다.
- 기존 미커밋 변경(특히 사용자의 Notion 그래프 작업)을 되돌리지 않는다.
- **빌드/린트 통과를 "동작 검증"으로 보고하지 말 것.** 런타임 확인 여부를 항상 명시한다.

## 6. 검증 명령

```bash
npm install              # node_modules가 없으면 먼저 (의존성 미설치 상태였던 이력 있음)
npx tsc --noEmit
npm run lint
npm run build
npm run test:unit
npm run verify:focus-feed
npm run vhk -- check     # = npm run vhk:policy
# 런타임: npm run build && npm run start 후 브라우저 + 로그인 + Supabase 환경에서 §4-1 확인
```

## 7. 다음 세션 마스터 프롬프트 (복사해서 새 세션에 붙여넣기)

```text
당신은 Focus Feed(알고리즘 없는 개인 콘텐츠 연구 시스템) 저장소의 시니어 Next.js·보안·제품 엔지니어다.

먼저 이 순서로 읽어라:
1. docs/HANDOFF_2026-06-20_NEXT_SESSION.md  ← 지금 이 핸드오프
2. docs/PERSONAL_CONTENT_RESEARCH_SYSTEM_SPEC.md  ← 제품 방향(개인 연구 시스템, 팀·Stripe 보류)
3. docs/UX_IMPROVEMENT_HANDOFF_2026-06-20.md  ← UX 작업 분해(P0~P2)
4. docs/MILESTONES.md 의 M8
5. CLAUDE.md, AGENTS.md, RULES.md

배경:
- 직전 세션이 보안 P0/P1, 콘텐츠 상태 모델, UX P0를 PR #5~#10으로 main에 머지했다.
- 그러나 모든 검증이 빌드/타입/린트/단위 레벨이고, 실제 브라우저·로그인·Supabase·마이그레이션 환경의 런타임은 한 번도 확인하지 않았다.
- 핸드오프 §2(적대적 검증)에 미검증·회귀 위험이 정리돼 있다.

이번 세션 목표(순서대로):
1. 런타임 검증을 먼저 한다. 핸드오프 §4-1의 항목(인박스 선별 저장·기기 간 동기화, 데이터 내보내기, owner 전용 노션 정리, proxy 인증, 보안 헤더, UX-10/11/20 실제 렌더)을 .env.local + Supabase + 005/008 적용 + 로그인 상태에서 직접 확인하고, 깨지는 것을 먼저 고친다.
2. 선별 필터 부작용(§2-3: 처리 대기 필터에서 RSS가 전부 사라짐)을 고친다 — RSS 카드(FeedItem)에 ContentStateControl을 연결하거나 필터 로직을 보완한다.
3. 그다음 UX 잔여(UX-21 e2e, UX-40/41), 스펙 Phase 2(재생 위치 서버 저장)로 진행한다.

절대 규칙:
- VHK는 npm run vhk -- <command> 형식으로만.
- 커밋/푸시/머지는 내가 명시할 때만. main이면 브랜치 먼저 만든다.
- 비밀값을 출력·수정·커밋하지 않는다. 기존 미커밋 변경(특히 Notion 그래프 작업)을 되돌리지 않는다.
- 빌드/린트 통과를 "동작 검증"으로 보고하지 마라. 런타임 확인 여부를 항상 명시하라.
- 작업은 작은 배포 단위로 나누고, 각 단위마다 변경 파일·검증 결과·남은 위험을 보고하라.

먼저 git status / git log -5 / npm install 상태를 확인하고, 런타임 검증 계획부터 제시하라.
```
