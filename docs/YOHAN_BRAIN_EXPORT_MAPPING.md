---
id: focus-feed-yohan-brain-export-mapping
date: 2026-06-19
tags: [focus-feed, yohan-brain, notion, export, mapping, protocol]
status: 설계 확정 v2 (구현 대기)
---

# 포커스피드 → 요한 브레인 내보내기 설계 (확정본 v2)

> **⚠️ 중대 정정 (2026-06-19, gap #3 확인 결과)**
> 요한 브레인의 **정본(SoT)은 `yohan-brain` 로컬 레포 + `memory/rules/source-to-summary-protocol.md`** 다.
> Notion의 RESOURCE/SUMMARY/AI사전/인물/트리플맵 DB는 `sync_to_notion`(MCP)으로 채워지는 **하류 미러**.
> → **포커스피드는 Notion에 직접 쓰지 않는다.** 리뷰(`reviewed`)를 통과한 콘텐츠를 **"소스"로 이 프로토콜에 넘긴다.** (v1의 "Notion DB 직접 upsert" 가정은 폐기.)

## 0. 정정된 큰 그림

```text
포커스피드 (알고리즘 없는 큐레이션 · 리뷰 · 딥다이브 UI / firehose)
   │  reviewed 항목을 "소스 패키지"로 emit → memory/inbox/
   ▼
yohan-brain 로컬 파이프라인  (source-to-summary-protocol.md, Step 1~6)
   ├ Step1 RESOURCE   memory/ingest/(url|rss)/   원본 메타+링크 (전문 복제 금지)
   ├ Step2 SUMMARY    memory/ingest/insights/{kebab}.md  표준 요약 구조
   ├ Step4.5 승격 / 4.6 역전파 / 4.7 트리플 추출 (체크포인트 = 사람 확인)
   ├ 인물 memory/wiki/entities/   키워드 memory/knowledge-hub/keywords.md
   └ 트리플 memory/knowledge-hub/triple-map.md (append-only, 표준 팔레트)
   ▼  Step6
Notion 반영  MCP sync_to_notion (SoT Key 멱등)  ← Notion DB는 여기서 채워짐
```

## 1. 분업 (누가 무엇을 소유하나) + 중복 경고

- **포커스피드**: "무엇을 볼지/남길지" 큐레이션, 소비(라디오), 딥다이브, **리뷰 게이트**. = 사람이 판단하는 앞단.
- **yohan-brain**: RESOURCE/SUMMARY/트리플/인물/키워드의 **지식 SoT + 노션 동기화**. = 지식 파이프라인 뒷단.
- ⚠️ **중복 주의**: yohan-brain 프로토콜은 **이미 유튜브를 수집**한다(입력분기 #5 `ingest_url` = oembed 제목 + 자막, `has_transcript`). 그러므로 포커스피드는 **수집기를 새로 만드는 게 아니라**, 이미 가진 트랜스크립트·딥다이브를 **소스 패키지로 넘겨** 프로토콜의 Step 0~2를 건너뛰게 해준다(중복 ingest 방지).

## 2. 핸드오프 계약 — 포커스피드가 넘기는 "소스 패키지"

`reviewed` 항목 1건 → JSON/MD 1개를 `memory/inbox/`에 떨군다(또는 MCP 호출). 포함:

| 필드 | 용도(프로토콜 매핑) |
|---|---|
| `source_type` | `youtube` / `rss` → 입력 분기 #5/#9 |
| `url`, `title`, `channel`, `duration_min`, `published_at` | Step1 RESOURCE 메타 |
| `transcript_ref` | **트랜스크립트 전문은 포커스피드 보관**, 여기엔 포인터/발췌만 (R2) |
| `has_transcript`, `source_basis`(자막/메모) | 신뢰도 결정(자막=3, 메모=2) |
| `ai_summary`, `key_insight`, `sections`, `quotes(타임스탬프)` | Step2 SUMMARY 초안 |
| `concept_candidates[]`, `person_candidates[]`, `triple_candidates[]` | Step4.7 **후보**(확정 아님) |
| `ff_content_id` | 멱등 키(역참조) |

→ 프로토콜이 이 패키지로 Step1~6을 실행한다. 포커스피드는 **재료를 손질해 inbox에 올려둘 뿐**, 등록·확정은 프로토콜 체크포인트(사람)가 한다.

## 3. 프로토콜이 만드는 "최종 상태" — Notion DB 매핑 (참고용 end-state)

> 아래는 포커스피드가 직접 쓰는 게 아니라, 프로토콜 + `sync_to_notion`이 **결과적으로 채우는** 모습이다. 매핑 검증·디버깅용 참조표.

**RESOURCE** `collection://ca4cf904-…` (로컬 `memory/ingest/`)

| 속성 | 값·규칙 |
|---|---|
| 이름 / 원본 URL / 저자·출처명 / 분량(분) / 수집일 | 패키지 메타 그대로 (URL=정규화=멱등 키) |
| 소스 | 유튜브=`유튜브`, RSS=`외부링크`/`웹클리핑` |
| 유형 | `영상`(팟캐스트=`팟캐스트`) |
| 상태 | SUMMARY 동반이면 `요약완료` |
| 우선순위 | 🔥핵심/⚡활용/📌참고/🗂️보관 |
| 관련 SUMMARY / 관련 인물 | relation |
| (본문) | 전문 복제 금지 — 링크+핵심 인용만 |

**SUMMARY** `collection://a20db2bd-…` (로컬 `insights/{kebab}.md`) — 표준 요약 구조 준수:
`## 핵심요약(3줄) / 핵심키워드 / 본문-논지전개 / 댓글·반응 / 내 생각 / 인사이트→적용 / Yohan OS 적용 / 트리플맵 / 소스출처`

| 속성 | 값·규칙 |
|---|---|
| 핵심 인사이트 | 딥다이브 "한 문장 핵심" |
| 유형 | `영상노트`(팟캐스트=`팟캐스트노트`) |
| 상태 | reviewed=`완료`, 외부 발행 시 `발행`(사람 변경) |
| 임베딩 완료 | 초기 false → Qdrant 후 true |
| 관련 RESOURCE 1 | 원문 역참조 (**연결성 핵심**) |
| frontmatter `related` | **원본 미연결 SUMMARY 금지**(프로토콜 Step2 필수) |

**AI 코파일럿 세션** `collection://7d904867-…` *(gap #1 — 추가된 경로)*

- **언제**: 포커스피드 **Feed Q&A 대화**(멀티턴, 나×AI 공동생산)를 "보존" 표시했을 때만. 기본은 OFF(Q&A는 localStorage 임시).
- **딥다이브(일회성 AI 분석)는 SUMMARY로**, **Q&A 대화(공동생산)는 코파일럿 세션으로** — 3분류 규칙의 "나×AI" 칸.

| 속성 | 값 |
|---|---|
| 이름 / 일자 | 스레드 제목 / 날짜 |
| 출처 LLM | `Gemini` |
| 트리거 | `질의응답` |
| 상태 | `미정제`로 시작 → 이후 SUMMARY로 승급 가능 |
| 관련 SUMMARY | 대상 콘텐츠의 SUMMARY |
| (본문) | 대화 원문 + 산출물 **그대로** 보존 |

**AI 사전** `collection://3349740a-…` (로컬 `memory/wiki/`) *(gap #2)*

| 속성 | 값·규칙 |
|---|---|
| 이름 / 영문 표기 / 한 줄 정의 | 개념명·영문·딥다이브 정의 |
| 카테고리 | DB·데이터/AI·ML/개발/자동화/… 매핑 |
| 난이도 / 상태 | 기본 `중급` / `미학습`(=후보) |
| 참고 링크 | 영상 URL |
| 관련 용어 | self-relation = **트리플맵의 Notion 뷰** |
| **R3** | 포커스피드는 **후보 제안만**. 등재는 "AI 사전 용어 등록 프로토콜"(사람) 통과분만 |

**인물 DB** `collection://2ce66f84-…` (로컬 `memory/wiki/entities/`, `entity_type: person`) *(gap #2)*

| 속성 | 값·규칙 |
|---|---|
| 이름(한글) / 영문명 / 역할·직함 / 태그라인 / 프로필 URL | 딥다이브 인물 정보 |
| 소속 | ⚠️ **옵션이 AI 랩 전용**(Anthropic/OpenAI/DeepMind…). 안 맞으면 `독립/개인`·`기타` |
| 관련 RESOURCE / 관련 SUMMARY | relation |
| **제약** | 인물 DB는 **AI 도메인 특화**. AI 분야 인물만 등재 후보, **그 외 화자는 SUMMARY 본문 언급에 그침**(억지 등재 금지) |
| **매칭(결정4)** | 이름 단독 병합 금지 → `이름+맥락(역할/소속)`. 확실하면 enrich, 애매하면 새 노드(동명이인·새 정보 허용). 1회성 인용은 제외 |

## 4. 트리플맵 (연결성의 실체) *(gap #3 — 정정)*

- **본체 = 로컬 `memory/knowledge-hub/triple-map.md`** (append-only 표). Notion 트리플맵·AI사전 `관련 용어`는 뷰. (`_links.json`은 옛 구상, 실존 X.)
- 형식: `[주어] --관계--> [목적어]` + `도메인 | 신뢰도 | 출처 | 등록일`.
- **표준 Relation 팔레트만 사용**: `is_a, part_of, related_to(불확실 기본), complementary_to, implements, created_by, applies_to, depends_on, evolved_from, comprises, solves, addresses, exposes, signals, enables, blocks, triggers, transforms_into, precondition_of, opposite_of`. ★ `solves/addresses/exposes`(문제 지도)는 적극 활용.
- 도메인 5종: `AI/자동화·비즈니스·개발·자기이해·학습`. 신뢰도: **영상 자막=3 / 시청 메모=2**.
- **중복 규칙**: Subject+Relation 동일 → 스킵 / Subject 동일+Relation 상이 → 등록 + SUMMARY 교차검증 메모 / 신규 → 등록.
- 등록 위치: SUMMARY 본문 `## 트리플 맵` **그리고** `triple-map.md` 행 추가(둘 다, 별개).
- **포커스피드 역할**: `triple_candidates[]`(주어/관계/목적어/근거 타임스탬프)만 제안. **확정·등록은 프로토콜 Step 4.7 체크포인트(사람).**

## 5. 운영 규칙 R1~R5 (프로토콜과 정렬 확인)

- **R1 게이트**: `reviewed`만 inbox로 emit (프로토콜 트리거에 연결).
- **R2 분량 분리**: 트랜스크립트 전문 = 포커스피드 보관. RESOURCE는 메타+링크+핵심 인용 (프로토콜 Step1 "원본 전문 복제 금지"와 동일).
- **R3 후보·확정 분리**: 개념·인물·트리플·키워드는 **후보**로만 넘김. 등재·확정은 프로토콜 체크포인트(스킵 가능·생략 불가, 사람 보고). 결정 2·3·4 흡수.
- **R4 필드 소유권**: SUMMARY의 **`## 내 생각`(사람 소유)은 불가침**, 포커스피드/AI는 `핵심요약·본문·트리플`(AI 소유)만 갱신. (프로토콜 표준 구조가 이미 `## 내 생각`을 분리해 둠 — 그대로 활용.)
- **R5 멱등·복구**: 멱등 키 = 정규화 `원본 URL` + `ff_content_id`. Notion 반영은 `sync_to_notion`(SoT Key 멱등). 부분 실패 시 inbox 항목 보존·재시도. 세션 로그 `memory/logs/sessions/` 기록.

## 6. 열린 결정 (C2에서 확정) · 다음 단계

1. **핸드오프 방식**: `memory/inbox/`에 파일 drop(느슨·안전) vs MCP 직접 호출(즉시). 권장 = 파일 drop(프로토콜이 비동기 처리).
2. **유튜브 ingest 주체 일원화**: yohan-brain `ingest_url`이 할지, 포커스피드 패키지가 대체할지 — 중복 수집 방지 위해 **포커스피드가 reviewed분만 패키지로 넘기고, yohan-brain 자동 ingest는 포커스피드 미사용분에만** 권장.
3. **C1** — 카테고리/태그/유형/우선순위 옵션 값 1:1 표(포커스피드 ↔ 요한 브레인).
4. **C2** — 소스 패키지 emit 어댑터(포커스피드 서버액션) + 프로토콜 트리거 연결.

## 부록: 로컬 경로 빠른 참조 (yohan-brain)

`RESOURCE → memory/ingest/` · `SUMMARY → memory/ingest/insights/` · `트리플 → memory/knowledge-hub/triple-map.md` · `인물 → memory/wiki/entities/` · `키워드 → memory/knowledge-hub/keywords.md` · `프로토콜 → memory/rules/source-to-summary-protocol.md` · `세션로그 → memory/logs/sessions/`
