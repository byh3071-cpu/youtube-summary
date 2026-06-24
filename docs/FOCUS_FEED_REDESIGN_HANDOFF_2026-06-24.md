---
id: focus-feed-redesign-handoff
date: 2026-06-24
status: 브레인스토밍 완료 · Phase 1 스펙 미작성
owner: 백요한
tags: [focus-feed, handoff, redesign, brainstorm]
---

# 🤝 Focus Feed 리디자인 — 핸드오프 (2026-06-24)

## ▶ 진입점 (1줄)

**`docs/FOCUS_FEED_REDESIGN_BRAINSTORM_2026-06-24.md` 를 먼저 읽고 → 그 방향대로 "Phase 1 스펙"을 작성하라.** (Scan→Pick→Play 홈 + 끌림 랭킹 + 숏폼그리드/롱폼리스트 + 하단 플레이어바 + 채널캡처 + 버그청산)

---

## 1. 지금 상태

- 제품 정체성·디자인 방향 **재정의 완료**(브레인스토밍). 코드 변경은 **아직 0**.
- 4축 법적 리서치 + 19개 디자인 레퍼런스 수집 완료.
- 다음 액션 = **Phase 1 스펙 문서 작성** → 그 다음 구현 계획.

## 2. 한 줄 정체성

> 내 취향으로 끌리는 유튜브 영상을 가볍고 산뜻하게 띄워(발견) → 보고 싶게 만들고 → 마음에 든 영상을 부담 없이 내 지식 워크플로(NotebookLM·노션·아이디어뱅크)로 흘려보내는 **중간 다리**. "또 다른 유튜브" ❌.

**디자인 북극성:** "유튜브 콘텐츠 × 스포티파이 껍데기" — 구독한 유튜브 채널을 음악앱처럼 틀고·큐담고·관리. 스포티파이 불필요 기능(음악/아티스트/앨범·장르폭격·소셜) 제거, FF 전용으로 채움.

## 3. 잠긴 결정 (재론의 금지 — 사용자 합의)

1. 홈 = **Scan → Pick → Play** 흐름.
2. **반(反)유튜브**: 깔끔·여백·세로 리스트·**유한 피드**(무한스크롤 ❌)·**액션강요 0**.
3. 롱폼 = 큰 썸네일 세로 리스트 / 숏폼 = 별도 가로 그리드(풀스크린 스와이프 강제 X) / 라디오 = **하단 고정 플레이어바**.
4. 기본 정렬 = **최신순 + 추천순 토글**. 끌림 신호 = AI/개발 최신·새로움·깊이.
5. 추천은 **내 신호 기반**(구독·요약·북마크) — "큐레이션 팩"(남이 정한 묶음) ❌.
6. 단계: **Phase 1 = 0(품질)+1(Pull엔진)+3(캡처)**. Phase 2 = Bridge(보류).

## 4. 다음 행동 (순서대로)

1. **진입점 문서** 정독: `docs/FOCUS_FEED_REDESIGN_BRAINSTORM_2026-06-24.md`.
2. **Phase 1 스펙** 작성 (`docs/` 에 `FOCUS_FEED_PHASE1_SPEC.md` 등). 포함: 홈 레이아웃(사이드바·피드·플레이어바)·끌림 랭킹 로직·숏폼 그리드/롱폼 리스트 컴포넌트·캡처(`/add?url=` 딥링크)·기존 버그 청산 목록.
3. 스펙 자체 점검(플레이스홀더·모순·범위) → 사용자 리뷰 → 구현 계획.
4. 구현 전 **기존 FF 버그 목록** 먼저 뽑아 청산(품질이 선행 전제 — 사용자 이탈 원인).

## 5. 하지 말 것 (gotcha)

- ❌ **자막 스크래핑 위에 유료 제품화** — `youtube-transcript`+`youtubei.js`는 YouTube ToS 위반. **개인용 단계만** 안전. (상세: `docs/FOCUS_FEED_REDESIGN_BRAINSTORM_2026-06-24.md` §7 / 메모리 `focus-feed-transcript-tos-risk`)
- ❌ "오늘의 브리핑" 류 무거운 프레이밍 (사용자 거부 — 그냥 깔끔한 피드).
- ❌ 액션아이템/"내일 무조건 실행" 강요.
- ❌ **git 자동 커밋·배포** (사용자 승인 필수 — `CLAUDE.md` VHK 정책). `vhk sync`도 금지.

## 6. 미결정 (블로커)

- **Bridge(Phase 2) 경계**: FF가 NotebookLM/노션을 *대체* vs *먹여줌* → 요한 워크플로(영상→NotebookLM→노션/아이디어뱅크 요약 프로토콜) 더 해부해야 결정. **Phase 1은 이거 없이 진행 가능.**
- 추천순 랭킹 UX 디테일·다크모드 시안 → 필요 시 `/lazyweb-design-research`.

## 7. 산출물 색인 (디스크 포인터)

| 산출물 | 경로 |
|---|---|
| **설계 기록(상세)** | `docs/FOCUS_FEED_REDESIGN_BRAINSTORM_2026-06-24.md` |
| 디자인 레퍼런스(19선+목업) | `.lazyweb/quick-references/focus-feed-clean-feed-2026-06-24/report.html` |
| devlog | `docs/devlog/2026-06-24-focus-feed-redesign-brainstorm.md` |
| 메모리(세션 넘어) | `~/.claude/.../memory/focus-feed-product-redefinition.md`, `focus-feed-transcript-tos-risk.md` |

## 8. 사용자 맥락 (설계 제약)

데스크톱 90%(듀얼모니터: 좌=유튜브 라디오/롱폼, 우=개발/게임), 폰 10%(주로 숏츠). 액션 강요 싫어함. 품질·산뜻함이 기능보다 중요(과거 버그·UI 불만이 이탈 원인).

## 9. 검증 명령 (CLAUDE.md)

```bash
npm run verify:focus-feed
npm run vhk:policy
```
