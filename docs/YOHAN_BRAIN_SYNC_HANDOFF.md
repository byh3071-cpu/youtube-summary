---
id: yohan-brain-sync-handoff
date: 2026-06-20
tags: [focus-feed, yohan-brain, handoff, notion]
---

# 요한 브레인 그래프 동기화 — 핸드오프 (새 세션 이어가기)

> **새 챗에서 이어가려면**: 이 문서 + `docs/YOHAN_BRAIN_EXPORT_MAPPING.md`(설계 v2)를 읽고, `git log origin/main --oneline -8`로 현재 상태를 재확인한 뒤 시작한다.
> 이 머신엔 동일 내용의 `/resume-brain-sync` 스킬도 있다(단 `.claude/`는 gitignore라 머신 로컬 — 다른 머신에선 이 문서를 쓴다).

## 한 줄
포커스피드(이 repo) = 요한 브레인(노션+웹 "중추신경")의 **영상 입력 기관**. 영상 → 트랜스크립트 → 요약 → 트리플/인물/개념을 요한 브레인 DB로 적재한다.

## 끝난 것 (main 머지됨: PR #8, #9)
- 영상 → RESOURCE/SUMMARY 동기화 (기존)
- **트리플맵 추출 + Notion 트리플 맵 DB 쓰기** (표준 관계 팔레트 20종, Subject+Relation 중복 스킵)
- **인물 추출 + 인물 DB upsert**(이름 일치 재사용/없으면 생성) + RESOURCE/SUMMARY `관련 인물` 연결
- **개념 추출 + AI 사전 쓰기** (상태=미학습 = 검증 전 후보, 이름 중복 스킵)
- **reviewed 게이트**(`requireReviewed`) + **exported 전이**(`reviewed→exported` + `notion_page_id` 저장)
- 모든 그래프 쓰기는 **`NOTION_WRITE_GRAPH=1` 일 때만** (기본 off). 실패는 catch+log(메인 동기화 보호).

## 핵심 파일·식별자
- `src/app/actions/notion-sync.ts` — `syncVideoToNotionAction(videoId, contentId?, requireReviewed?, …)`
- `src/lib/notion-client.ts` — DS id 상수 + `upsertPersonByName` / `tripleExists` / `createTriple` / `upsertConceptByName` / `graphWriteEnabled`
- `src/lib/notion-section-analyzer.ts` — `VideoAnalysis`(triples/people/concepts) + 추출 프롬프트·안전 파싱
- `src/lib/notion-content.ts` — SUMMARY 본문 렌더(트리플/인물·개념 "후보" 섹션)
- `src/app/actions/content-state.ts` — `getContentStatesAction` / `setContentStateAction(notionPageId)`
- 호출부: `src/components/feed/MyFocusSection.tsx` (contentId 연결, 소프트)
- DS ids: RESOURCE `ca4cf904…` · SUMMARY `a20db2bd…` · 인물 `2ce66f84…` · 트리플맵 `99fa489c…` · AI사전 `3349740a…` · 코파일럿세션 `7d904867…`
- 트리플 본체(로컬 정본): `yohan-brain` repo `memory/knowledge-hub/triple-map.md` (등록 절차 `memory/rules/source-to-summary-protocol.md` Step 4.7)

## 남은 일 (우선순위)
### 🔴 지금
- ✅ ~~설계 문서 커밋~~ — 완료(이 문서·`YOHAN_BRAIN_EXPORT_MAPPING.md`·스펙 §14.1 모두 main).
- **라이브 검증**: `NOTION_WRITE_GRAPH=1` 켜고 영상 1개 동기화 → 트리플맵/인물/개념 DB에 실제 기록 확인 (지금까지 빌드·타입만 검증).
- **`.env.example`에 `NOTION_WRITE_GRAPH` 문서화** (권한 문제로 미반영).
### 🟡 다음 조각
- **하드 게이트 활성화**: 인박스→export 진입점에서 `requireReviewed: true` 호출 (현재 MyFocus는 소프트).
- **코파일럿 세션**: Feed Q&A(나×AI 대화) → AI 코파일럿 세션 DB. 설계만 됨.
- **개념 한 줄 정의**: 개념을 이름만 말고 정의까지 추출.
### 🟢 보류된 결정
- **B 경로(프로토콜 경유)**: 지금 A(직접 쓰기). 장기적으로 `yohan-brain` 로컬 파이프라인 → `sync_to_notion` 으로 수렴.
- **split-brain 가드**: "포커스피드 처리 영상은 yohan-brain 자동 ingest 제외" 규칙.
- **트랜스크립트 전문**: RESOURCE 본문 전문 복사 중(R2는 링크만 권장) → 정렬.
- **인물 DB AI-도메인 오염**: 비AI 화자 stub 필터.
### ⚪ 하우스키핑
- 워크트리 `.claude/worktrees/yohan-brain-triples` (머지 완료) 제거 가능.

## 작업 규칙
- 사용자는 비전공자 — 전문용어보다 **쉬운 설명·비유**. 결정은 추천안 먼저 제시 후 진행.
- 코드 변경은 **워크트리**에서, `tsc --noEmit` / `eslint` / `next build` 통과 후 커밋·PR. 머지는 사용자 승인/요청 시.
- 새 그래프 쓰기는 **`NOTION_WRITE_GRAPH` 게이트 + best-effort**(메인 동기화 보호) 패턴 유지.
- 워크트리는 nested라 `node_modules`가 상위(메인)로 해석됨 → `<main>/node_modules/.bin/tsc`, `npm run lint/build` 그대로 동작.

## 끝나면
작업 반영 후 이 문서 + `docs/YOHAN_BRAIN_EXPORT_MAPPING.md` + 메모리(`focus-feed-and-yohan-brain`) + (이 머신) `/resume-brain-sync` 스킬을 갱신한다.
