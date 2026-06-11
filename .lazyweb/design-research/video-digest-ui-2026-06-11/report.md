# Design Research: 유튜브 영상 디제스트 UI (드로어 vs 페이지 · 버튼 병행 vs 통합)

> 2026-06-11 · 웹 리서치 기반 (Lazyweb MCP 미설치 — 스크린샷 DB 없이 텍스트 분석)

## TL;DR

선두 제품 전부(YouTube 자체, Readwise Reader, Glasp, Eightify, Snipd)가 트랜스크립트·요약·인사이트를 **"재생 중인 플레이어 옆"** 에 배치한다 — 분석 화면을 재생과 분리한 제품은 사실상 없다. 결론: **드로어형을 채택하되 라디오 플레이어와 결합**(타임스탬프 클릭 → 즉시 시킹, 재생 위치 ↔ 디제스트 섹션 동기화)하는 것이 4개 선택지보다 나은 "제3안"이고, 버튼은 **병행 유지**가 업계 패턴(깊이별 단계 공개)과 비용 구조 모두에 맞다.

## Recommendations / Next Steps

**1. 결정 A → 드로어형 + 플레이어 결합 (A-① 개선판)**
근거: ① Smashing Magazine의 모달/페이지 결정 트리 — "배경 컨텍스트를 참조해야 하는 고볼륨 보조 콘텐츠는 드로어, 복잡한 다단계 집중 작업은 페이지". 피드 탐색 중 반복적으로 열고 닫는 디제스트는 정확히 드로어 케이스다. ② Eightify·Glasp 모두 유튜브 시청 화면 옆 **사이드바**로 성공했다 — 별도 페이지로 보내는 제품이 없다. ③ 우리는 이미 전역 FloatingRadioPlayer가 있으므로, 딥다이브를 열 때 영상을 라디오에 로드하면 "유튜브의 트랜스크립트 패널" 경험이 공짜로 완성된다. 전용 페이지(A-②)는 구현비가 크고 피드 흐름을 끊으며, NotebookLM이 페이지형인 이유(장시간 워크스페이스 세션)는 우리 사용 패턴(피드 훑다가 파고들기)과 다르다.

```
┌────────────────────────────────────────────────┐
│ 피드 (흐리게)        ┌─ 딥다이브 드로어 ──────┐ │
│ [카드] [카드]        │ 💡 헤드라인            │ │
│ [카드] [카드]        │ 핵심가치 · 키워드칩    │ │
│                      │ 🔑 인사이트(+근거 12:34)│ │
│                      │ 💬 인용 [47:21]→시킹   │ │
│                      │ 📑 섹션 타임라인       │ │
│                      │   ▶ 재생중 섹션 하이라이트│
│                      │ ▸ 자막 전문(오토스크롤)│ │
│ ┌──────────────────┐ └────────────────────────┘ │
│ │🎧 라디오 플레이어 ◀━━ 타임스탬프 클릭 시 시킹│
│ └──────────────────┘                            │
└────────────────────────────────────────────────┘
```

**2. 결정 B → 병행 유지 (B-①)**
근거: ① Eightify는 한 영상에 short/insightful/Q&A 등 **깊이별 모드**를 따로 제공한다 — "가볍게 vs 깊게"는 실제 사용자 니즈 구분이다. ② YouTube도 요약(설명) / 트랜스크립트 / Ask를 별도 진입점으로 둔다. ③ 비용 구조(3줄 요약 1콜 vs 디제스트 5~7콜)와 일치. ④ 통합(B-②)은 SummarizeButton·라디오 가사뷰 의존성 재배선이 필요해 리스크만 크다. 단, 디제스트 드로어 **첫 화면에 기존 3줄 요약을 재사용 표시**해 두 기능이 따로 논다는 느낌을 없앨 것.

**3. 흡수할 디테일 (구현 단계에 반영 권장)**
- **오토스크롤 트랜스크립트** (Readwise Reader): 라디오 재생 중 자막 전문이 텔레프롬프터처럼 현재 위치를 따라 스크롤. 토글 가능.
- **재생 위치 → 디제스트 역동기화** (Readwise/Snipd): 현재 재생 중인 구간의 섹션·인사이트를 하이라이트.
- **자막 줄 클릭 = 시킹** (YouTube/Snipd/Readwise 공통): 타임스탬프뿐 아니라 줄 전체가 클릭 영역.
- **Ask 패턴** (YouTube Premium): 디제스트 드로어에 "이 영상에 질문" 입력을 후속 단계로 — 기존 FeedQADrawer 인프라에 영상 트랜스크립트 컨텍스트만 끼우면 됨 (Phase 2).
- **인용 → 공유 카드** (Snipd): quotes를 이미지 카드로 내보내기 (Phase 2, 선택).

## Patterns (업계 공통분모)

| 패턴 | 채택 제품 | 시사점 |
|---|---|---|
| 분석은 플레이어 옆 사이드 패널 | YouTube, Eightify, Glasp, Readwise | 드로어 + 라디오 결합 |
| 타임스탬프/자막 줄 클릭 → 시킹 | 전부 | 계획대로 (seekTo 연동) |
| 시간 동기 하이라이트(텔레프롬프터) | YouTube, Readwise, Snipd | 오토스크롤 추가 가치 큼 |
| 깊이별 요약 모드 분리 | Eightify(short/insightful/Q&A) | 병행 유지(B-①) 지지 |
| AI 챕터 = 진행바/목차 겸용 | YouTube, Snipd | 섹션 타임라인이 그 역할 |
| 분석 → 노트앱 내보내기 | Snipd→Notion/Readwise, Glasp | 우리의 노션 동기화와 동일 루프 — 방향 검증됨 |

## Anti-Patterns (피할 것)

- **재생과 분리된 분석 전용 화면**: 타임스탬프가 "죽은 텍스트"가 됨. 전용 페이지(A-②)를 고른다면 반드시 페이지 안에 플레이어를 내장해야 하는데, 그러면 라디오 플레이어와 이중 재생 충돌 관리가 필요해짐.
- **AI 진입점 단일화로 인한 경량 경로 제거** (B-②): Snipd 리뷰의 주요 불만이 "AI가 과하게 개입해 통제감 상실". 가볍게 훑는 1콜 경로는 남겨야 한다.
- **자동 생성 남발**: 카드 노출 시 자동 디제스트 같은 것 금지 — 명시적 버튼 클릭 + 캐시.

## Unique Angles (멈춰서 본 것)

- **Readwise Reader의 "비디오 = 문서" 관점**: 영상을 읽기 자료처럼 취급해 하이라이트가 그대로 지식 시스템(Readwise)에 쌓인다 — 사용자가 말한 "노션 리소스/서머리 루프"와 정확히 같은 철학. 우리 디제스트→노션 어댑터가 이 역할.
- **Snipd의 "순간 캡처"**: 듣다가 트리플탭으로 그 순간을 스니펫화. 라디오 청취 중 "지금 구간 북마크" 버튼은 강력한 Phase 2 후보.
- **YouTube Ask의 pill 버튼 위치**: 플레이어 바로 아래, Share 옆 — AI 기능을 별도 메뉴가 아닌 1차 동선에 둠.

## Findings (상세)

**YouTube 자체**: 트랜스크립트는 설명란 하단 "Open transcript" → 우측 패널, 줄별 타임스탬프 클릭 시킹, 타임스탬프 토글. 챕터는 진행바 분절 + 설명란 타임스탬프 자동 링크. "Ask"(2023 실험→2025 전체 공개)는 플레이어 아래 pill 버튼 → 대화 패널, 영상을 떠나지 않고 질문. → **모든 AI/메타 기능이 "재생 유지" 원칙**.

**NotebookLM**: 소스(좌)–채팅(중)–스튜디오(우) 3패널, 인용 클릭 시 소스 해당 구절로 점프. 입력→대화→산출의 선형 흐름. 단, 이는 수십 분짜리 연구 세션용 워크스페이스 — 피드 기반 소비 앱과 사용 리듬이 다름. 흡수할 것은 레이아웃이 아니라 **"인용→원문 점프" 연결성**.

**Eightify**: 유튜브 옆 사이드바, 타임스탬프 달린 key ideas, 길이·포커스(insightful/actionable/controversial)·포맷(list/Q&A) 커스텀, 10시간 영상 지원. → 깊이 단계화의 표준 사례.

**Glasp**: 같은 사이드바에 AI 요약 + 자막 전문을 함께 표시, 타임스탬프 클릭 시킹. → "요약과 원문을 한 패널에" = 우리 드로어 구성과 동일.

**Snipd**: 전 에피소드 자막+화자 식별, AI 챕터, 줄 탭 시킹, 커스텀 프롬프트 요약, Notion/Readwise/Obsidian 내보내기. 불만: AI 스니펫 오캡처·싱크 드리프트 → **타임스탬프 정확성이 신뢰의 핵심** (우리가 LLM에 타임스탬프 발명 금지 + 코드 검증을 넣은 것이 옳음).

**Readwise Reader**: 영상+시간동기 자막 나란히, 자막 클릭·하이라이트 클릭 시킹, 오토스크롤 텔레프롬프터(shift+enter 토글), 자동 자막 정제(enhanced transcript). → 데스크톱 2단의 최고 구현. 우리의 A-② 페이지안과 가장 가깝지만, Reader는 "저장해 둔 것을 읽는 앱"이라 페이지형이 맞고, 우리는 "피드를 훑는 앱"이라 드로어가 맞다.

**모달/드로어/페이지 결정 기준** (Smashing 2026 외): 반복 작업 + 배경 컨텍스트 참조 → 드로어. 다단계 복잡 입력 → 페이지. 짧은 확인 → 모달. 우리 케이스(피드 훑기 중 반복 진입, 영상·피드 컨텍스트 유지)는 드로어 판정.

## 4개 선택지 최종 판정

| 선택지 | 판정 | 근거 |
|---|---|---|
| A-① 드로어 | ✅ **채택 (+플레이어 결합 개선)** | 업계 공통 패턴, 피드 흐름 유지, 기존 인프라 재사용 |
| A-② 전용 페이지 | ⏸ 보류 | Readwise식 가치는 있으나 플레이어 내장 필요 → Phase 2 "확장 보기"로 |
| B-① 병행 유지 | ✅ **채택** | 깊이 단계화는 검증된 패턴 + 비용 구조 일치 |
| B-② 통합 | ❌ 기각 | 경량 경로 제거 리스크 + 의존성 재배선 비용 |

## Sources

- [YouTube 트랜스크립트 패널 조작](https://www.derby.ac.uk/digital-guidelines/accessibility/transcripts/how-to-open-a-transcript-and-toggle-timestamps-in-youtube.php) · [YouTube Ask 공식 도움말](https://support.google.com/youtube/answer/14110396?hl=en) · [Ask YouTube (TechRadar)](https://www.techradar.com/computing/websites-apps/google-just-turned-youtube-into-an-ai-chatbot-with-a-new-ask-youtube-feature-that-finds-the-perfect-video)
- [NotebookLM 디자이너 케이스스터디 (Jason Spielman)](https://jasonspielman.com/notebooklm) · [NotebookLM AI-native UX 분석 (Medium)](https://medium.com/design-bootcamp/why-notebooklm-shows-us-the-future-of-ai-native-ux-design-88c6883ade63) · [NotebookLM 리디자인 발표 (Google Blog)](https://blog.google/technology/google-labs/notebooklm-new-features-december-2024/)
- [Eightify](https://eightify.app/) · [Eightify Chrome Web Store](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb) · [Glasp YouTube Summary](https://glasp.co/youtube-summary) · [Glasp 사용법](https://glasp.co/posts/how-to-see-a-summary-of-a-youtube-video-with-glasp)
- [Snipd 기능 개요](https://www.snipd.com/all-features) · [Snipd (TechCrunch)](https://techcrunch.com/2022/08/16/how-snipd-is-using-ai-to-unlock-knowledge-in-podcasts/) · [Snipd App Store 리뷰](https://apps.apple.com/us/app/snipd-ai-podcast-player/id1557206126)
- [Readwise Reader 비디오 문서](https://docs.readwise.io/reader/docs/faqs/videos)
- [Modal vs Separate Page 결정 트리 (Smashing Magazine, 2026-03)](https://www.smashingmagazine.com/2026/03/modal-separate-page-ux-decision-tree/) · [Modal vs Drawer (Medium)](https://medium.com/@ninad.kotasthane/modal-vs-drawer-when-to-use-the-right-component-af0a76b952da) · [Modal UX (Eleken)](https://www.eleken.co/blog-posts/modal-ux)
