---
id: deepdive-digest-handoff
date: 2026-06-11
tags: [focus-feed, digest, deepdive, handoff, verification]
---

# 딥다이브(비디오 디제스트) — 작업 핸드오프 문서

이 문서 하나로 다음 세션이 맥락 없이 이어서 작업할 수 있도록 작성됨.
**다음 단계 3종(적대적 검증 → 코드 리뷰 → 실사용 검증)** 의 실행 계획 포함.

승인된 원 계획: `C:\Users\백요한\.claude\plans\scalable-cuddling-lark.md`
디자인 리서치 근거: `.lazyweb/design-research/video-digest-ui-2026-06-11/report.md`
UI 비교 목업: `mockups/digest-ui-compare.html`

---

## 1. 무엇을 만들었나 (기능 개요)

**딥다이브** = NotebookLM식 영상 "엑기스" 추출 시스템.
피드 카드의 `📖 딥다이브` 버튼 → 우측 드로어에 헤드라인·핵심가치·핵심 인사이트(근거+타임스탬프)·인용(엑기스)·키워드 칩·섹션 타임라인·자막 전문 표시.

- **타임스탬프 클릭** → 라디오 플레이어가 그 구간부터 재생 (`focus-feed:radio-seek` 커스텀 이벤트)
- **키워드 칩 클릭** → 피드 키워드 필터에 추가 (`storage.addKeyword`)
- **자막 전문** → 줄 클릭 시킹 + 재생 위치 하이라이트 + 오토스크롤 토글 (Readwise 패턴)
- 결과는 Supabase에 캐시 — 영상당 Gemini 1회만 (재진입 ~100ms)

UI 결정(디자인 리서치 판정): 드로어형 + 라디오 결합 채택, 전용 페이지는 Phase 2 보류,
기존 AI요약/인사이트 버튼과 병행 유지(통합 기각).

## 2. 아키텍처 / 파일 맵

```
[피드 카드 YouTubeCard]
  └ DeepDiveButton → VideoDigestDrawer (src/components/feed/VideoDigestDrawer.tsx)
       └ generateVideoDigestAction (src/app/actions/digest.ts)   ← 레이트리밋·usage('insight' 재사용)·캐시 게이트
            ├ getCachedDigest / saveDigest / getStructuredVideoContextCached (src/lib/digest/store.ts)
            │    └ Supabase: video_transcripts, video_digests (006·007 마이그레이션, 서버 전용 RLS)
            └ generateVideoDigest (src/lib/digest/generate.ts)   ← 오케스트레이터
                 ├ [자막 있음] chunkTranscript (chunking.ts) → 맵(순차) → 리듀스   ※ 최대 12청크, 오버랩 600자
                 ├ [자막 없음] generateDigestTextFromVideoUrl (video-understanding.ts)
                 │      = Gemini 네이티브 영상 이해 (fileData fileUri + MEDIA_RESOLUTION_LOW)
                 │      3시간 초과 영상은 비용 가드로 스킵 → 제목·설명 폴백
                 └ safeParseVideoDigest (parse.ts)  ← 수동 스키마 검증·클램프·타임스탬프 환각 차단(maxSeconds)
  └ FloatingRadioPlayer: "focus-feed:radio-seek" 수신 → seekTo (영상 미로드 시 보류 후 적용)

기타: src/lib/digest/types.ts(스키마·DIGEST_SCHEMA_VERSION=1), prompts.ts(맵/리듀스/단일패스),
notion-adapter.ts(digest→VideoAnalysis, Step7용·아직 미연결), src/app/api/debug-digest/route.ts(검증용, env 게이트)
getVideoTranscriptAction(actions/digest.ts) = 드로어 자막 전문용, Gemini 0콜.
```

**핵심 설계 결정과 이유**
- usage kind는 기존 `insight` 재사용 — plan.ts/usage_daily 무수정(병렬 세션 충돌 회피). 멀티유저 전환 시 `digest` kind 분리 필요.
- 맵 호출은 순차(Promise.all 금지) — Gemini RPM 보호. 실패 청크 1회 재시도 후 스킵, 1/3 초과 실패 시 중단, auth/missing_key는 즉시 중단.
- Gemini 호출은 병렬 세션의 `generateGeminiTextResult`(구조화 에러) 사용. gemini.ts는 병렬 세션 소유라 무수정 — 타임아웃은 generate.ts에서 Promise.race 60s로 자체 처리.
- `seconds`는 LLM에 안 시키고 코드 파생(parseTimestampToSeconds) — seekTo 입력.

## 3. 세션 중 발견한 중요 사실 (운영 지식)

1. **서버측 유튜브 자막 수집은 현재 불가능** — YouTube PO 토큰 차단(2025~).
   직접 실측: youtube-transcript lib 실패, youtubei.js `get_transcript` 400(8회 재시도 전부 실패, 알려진 이슈 LuanRT/YouTube.js#1102), timedtext base_url은 모든 클라이언트(WEB/ANDROID/iOS/TV)에서 200+빈 본문.
   **역사상 summaries 테이블 전부 "제목·설명" 기반이었음** — 이 앱은 자막을 한 번도 못 가져왔다.
   게다가 피드의 장편(테디노트 라이브 등 8개 전수 확인)은 자막 자체가 없음(captions: none).
   → 해법: Gemini 네이티브 영상 이해(자막 불필요, 음성 분석, 타임스탬프 추출). youtubei.js는 의존성에 남아있음(InnerTube 폴백 경로 — 자막 있는 영상이면 동작 가능성 있음, 미검증).
2. **Gemini 영상 이해의 타임스탬프 환각** — 70분 영상에서 03:17:13 같은 초과 타임스탬프 생성 확인 →
   이중 가드 적용(프롬프트에 영상 길이 명시 + parse에서 duration+60s 초과 무효화) → 재검증 0건.
3. **키 사고 이력(전부 해결됨)**: GEMINI/YOUTUBE 키 만료 → 갱신, Gemini 월 지출 한도 초과 → 해제,
   `SUPABASE_SERVICE_ROLE_KEY`에 publishable 키가 들어있던 문제 → secret 키로 교체(로컬 검증 완료).

## 4. 검증된 것 (E2E 실측 기록, 2026-06-11)

| 항목 | 결과 |
|---|---|
| 단위 테스트 | chunking/parse 22개 통과 (`npm run test:unit -- --run src/lib/digest`) |
| lint / build | 통과 |
| 자막없는 5분 영상(C4OnTmBPQhk) | mode=video, 42s, 실제 타임스탬프 00:07~04:35, insights 3·quotes 3 |
| 자막없는 70분 영상(D2__djLBE7c) | mode=video, 118s, 섹션 00:00→**70:01**(영상 끝까지 — 기존 15k 절단 문제 해결 증명), 길이 초과 ts 0개 |
| 캐시 히트 | 116ms, cached:true, Gemini 0콜 |
| 익명 차단 | "로그인이 필요합니다" (checkUsageLimit insight 게이트 정상) |
| UI 렌더 | 피드 SSR에 딥다이브 버튼 60개 |
| snippet 폴백 | 영상이해 실패/3h+ 시 제목·설명 기반 동작 |

**검증 방법(재현 커맨드)**
```powershell
# 서버 (debug 라우트는 프로덕션 기본 404, env로만 활성)
$env:ENABLE_DEBUG_DIGEST='true'; npx next start -p 3100
# 디제스트 생성/캐시 확인
curl.exe -s "http://localhost:3100/api/debug-digest?videoId=<ID>&duration=<초>&force=1"
# Supabase 직접 확인 (.env.local의 SUPABASE_SERVICE_ROLE_KEY 사용)
# GET {SUPABASE_URL}/rest/v1/video_digests?select=*  (헤더: apikey, Authorization: Bearer)
```

## 5. ⚠️ 남은 작업 / 미해결 (빠짐없이)

### 5-A. 즉시 (블로커·운영)
- [ ] **007 마이그레이션 미적용 확인됨** (source_mode='video' INSERT가 CHECK 위반).
      https://supabase.com/dashboard/project/olacbbfblhwssbcmradm/sql/new 에서
      `docs/supabase-migrations/007_video_digest_video_mode.sql` 실행. 미적용 시 video 모드 캐시 저장 안 됨(매번 재생성 = 비용 낭비).
      검증: `{"video_id":"check-007-probe","schema_version":999,"digest":{"headline":"p","summary":"p"},"model":"p","source_mode":"video","chunk_count":1}` INSERT가 201이면 OK(후 삭제).
- [ ] **Vercel `SUPABASE_SERVICE_ROLE_KEY` secret 키 반영 확인** — env 값은 API로 못 읽음.
      마지막 프로덕션 Redeploy = 2026-06-11 14:27 KST. 키 저장이 그 이후였다면 Redeploy 한 번 더 필요.
- [ ] **딥다이브 작업 전체가 미커밋** (untracked: src/lib/digest/, src/app/actions/digest.ts,
      src/components/feed/VideoDigestDrawer.tsx, src/app/api/debug-digest/, docs/supabase-migrations/006·007,
      mockups/, .lazyweb/ + modified: YouTubeCard, FloatingRadioPlayer, video-transcript.ts, video-context.ts, package.json(youtubei.js))
      ※ 병렬 세션(QA remediation)의 미커밋 변경과 같은 워킹트리에 섞여 있음 — 커밋 시 파일 단위로 분리할 것
      (이전 커밋 b44347d 때 했던 방식 참고: 디제스트 관련 파일만 git add).
- [ ] **push 안 됨** — 프로덕션은 옛 커밋(edc011c) 구동 중. b44347d + 디제스트 커밋 push 시 Vercel 자동 배포됨.
      배포 전 점검: `/api/debug-digest`는 게이트 확인됨(프로덕션 404), `maxDuration=300`이 Vercel 플랜에서 허용되는지(Hobby는 최대 60s/기본 — **Hobby 플랜이면 긴 영상 디제스트가 프로덕션에서 타임아웃**. Fluid compute 또는 Pro 필요. 서버 액션에도 동일 이슈 — 호출 라우트 세그먼트에 maxDuration 설정 필요).
- [ ] `.gitignore`에 `.lazyweb/` 추가 검토 (리서치 산출물), `mockups/`는 커밋해도 무방.

### 5-B. 기능 잔여 (계획됐으나 미구현)
- [ ] **Step 7: 노션 동기화 디제스트 재사용** — notion-adapter.ts(digestToVideoAnalysis)는 만들어져 있으나
      notion-sync.ts에 연결 안 됨(병렬 세션의 notion-sync 변경 머지 후 별도 커밋으로 하기로 함).
      효과: 노션 정리 시 LLM 재분석 제거 + 캐시 디제스트 재사용.
- [ ] **MyFocusSection(AI 브리핑 카드)에 딥다이브 진입점** — 병렬 세션이 그 파일 수정 중이라 보류함.
- [ ] **transcript(자막) 모드 실검증 미완** — 자막 있는 영상을 못 찾아 청크 맵-리듀스 경로는 단위 테스트만 통과.
      자막 있는 영상으로 1회 검증 필요(검증 포인트: chunkCount>1, 마지막 섹션 ts가 영상 후반).
- [ ] usage kind `digest` 분리 (plan.ts·usage_daily 컬럼) — 멀티유저 전환 시.
- [ ] "이 영상에 질문"(YouTube Ask 패턴, FeedQADrawer 재사용) — 리서치 Phase 2.
- [ ] 인용 → 공유 카드 (Snipd 패턴) — 리서치 Phase 2.
- [ ] 전용 페이지 /video/[id] "확장 보기" — 리서치 Phase 2 보류 항목.

### 5-C. 알려진 한계 / 기술 부채
- 3시간 초과 영상: 영상 이해 스킵 → 제목·설명 폴백 (VIDEO_UNDERSTANDING_MAX_SECONDS=10800).
- 영상 이해 비용: 저해상도 기준 ~100tok/s → 70분 ≈ 42만 토큰(약 $0.1+). 캐시로 영상당 1회.
- duration을 모르는 경우(durationSeconds null) 환각 가드의 maxSeconds 미적용 — 호출부가 가능한 한 전달할 것.
- 드로어 로딩이 긴 영상에서 ~2분 indeterminate (서버 액션 스트리밍 불가).
- debug-digest 라우트는 액션의 레이트리밋·usage 게이트를 우회함(의도된 검증용) — env 게이트 유지 필수.
- 검색·재생목록 등에서 쓰는 video-context.ts도 fetchTranscriptLines로 통합됨 — 자막이 다시 살아나면(또는
  자막 있는 영상이면) 기존 요약 품질도 자동 개선됨.
- mockups/digest-ui-compare.html, .lazyweb/ 리서치 산출물 정리 여부 결정 필요.

## 6. 🎯 다음 단계 실행 계획 (사용자 예고: 이 순서로 진행)

### Phase A — 적대적 검증 (Adversarial Verification)
공격자 관점에서 디제스트 표면을 깨기. 점검 목록:
1. **비용 공격**: 비로그인/무료 유저가 `generateVideoDigestAction`을 force:true로 반복 호출 →
   checkUsageLimit('insight')·guardGeminiActionRateLimit가 실제로 막는지, force가 캐시 우회로 Gemini를 강제하는지 실측.
   (서버 액션은 공개 엔드포인트 — limit/force/durationSeconds 임의 값 호출 시나리오 포함: 음수, 1e9, NaN 직렬화)
2. **videoId 검증 우회**: `../