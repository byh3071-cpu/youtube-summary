---
id: digest-handoff-2026-06-11
date: 2026-06-11
tags: [focus-feed, digest, deep-dive, handoff, video-understanding]
status: 구현 완료, 미커밋 · 마이그레이션 1건 대기 · 적대적 검증/코드리뷰/실사용 검증 예정
---

# 딥다이브(영상 디제스트) 기능 — 작업 핸드오프

NotebookLM식 "엑기스 추출" 기능을 새로 만들었다. 영상 전체를 분석해
**헤드라인·핵심가치·요약·인사이트(근거+타임스탬프)·인용(엑기스)·키워드·섹션 타임라인·
액션·열린질문**을 생성하고, 드로어 UI에서 타임스탬프 클릭→라디오 시킹, 키워드→피드 필터로 연결한다.

이 문서만 보고 다른 세션에서 이어서 작업할 수 있도록 모든 상태·미완·검증 계획을 기록한다.
설계 원안은 `~/.claude/plans/scalable-cuddling-lark.md`, 디자인 근거는
`.lazyweb/design-research/video-digest-ui-2026-06-11/report.md` 참고.

---

## 1. 핵심 의사결정 (왜 이렇게 만들었나)

- **자막 수집은 죽었다**: YouTube가 PO 토큰으로 서버측 자막 수집을 전면 차단(2025~).
  `youtube-transcript`·`youtubei.js`(InnerTube) 모두 막힘을 실측 확인(8회 재시도 전부 400/빈응답).
  게다가 피드의 장편(테디노트 라이브 등)은 **자막 자체가 없음**. 이 앱은 역사상
  단 한 번도 자막 기반 요약을 한 적이 없었다(과거 summaries 전부 `source="제목·설명"`).
- **그래서 Gemini 네이티브 영상 이해로 전환**: YouTube URL을 Gemini에 `fileData.fileUri`로
  직접 넣어 음성·화면을 분석. 자막 불필요, 타임스탬프도 영상에서 직접 추출.
  `MEDIA_RESOLUTION_LOW`로 토큰 절감. (`src/lib/digest/video-understanding.ts`)
- **UI는 드로어 + 라디오 결합 + 버튼 병행** (디자인 리서치 결론):
  경쟁 제품(YouTube/Readwise/Glasp/Eightify/Snipd) 전부 "분석을 플레이어 옆"에 둔다.
  전용 페이지(A-②)·버튼 통합(B-②)은 기각. 가벼운 3줄 요약(기존)과 딥다이브(신규)는 병행 유지.
- **캐시 우선**: 영상당 1회만 Gemini 호출, 이후 `video_digests` 테이블에서 즉시 반환.
  `DIGEST_SCHEMA_VERSION` 상수를 올리면 전체 무효화.

---

## 2. 구현 파일 (이 기능 범위)

### 신규
| 파일 | 역할 |
|---|---|
| `src/lib/digest/types.ts` | `VideoDigest` 타입, `DIGEST_SCHEMA_VERSION=1`, `parseTimestampToSeconds` |
| `src/lib/digest/chunking.ts` | `chunkTranscript` (자막 경로용, 현재는 거의 미사용 — 영상 이해가 우선) |
| `src/lib/digest/prompts.ts` | 맵/리듀스/단일패스 프롬프트 3종 |
| `src/lib/digest/parse.ts` | `safeParseVideoDigest`/`safeParseChunkDigest` + **타임스탬프 환각 가드(maxSeconds)** |
| `src/lib/digest/store.ts` | 자막·디제스트 캐시 CRUD (`getMutationTable` 사용) |
| `src/lib/digest/generate.ts` | 오케스트레이터: 영상 이해 → (자막 경로) → 제목·설명 폴백 |
| `src/lib/digest/video-understanding.ts` | **Gemini 네이티브 영상 분석 (핵심)** |
| `src/lib/digest/notion-adapter.ts` | `digestToVideoAnalysis` (Step 7 노션 재사용용, 아직 미연결) |
| `src/lib/digest/chunking.test.ts` `parse.test.ts` | 단위 테스트 22개 |
| `src/app/actions/digest.ts` | `generateVideoDigestAction`, `getVideoTranscriptAction` |
| `src/app/api/debug-digest/route.ts` | 검증용 라우트 (프로덕션 기본 404, `ENABLE_DEBUG_DIGEST=true`) |
| `src/components/feed/VideoDigestDrawer.tsx` | 드로어 UI + `DeepDiveButton` |
| `docs/supabase-migrations/006_video_digests.sql` | 자막·디제스트 캐시 테이블 (실행됨) |
| `docs/supabase-migrations/007_video_digest_video_mode.sql` | source_mode에 'video' 추가 (**미실행**) |
| `mockups/digest-ui-compare.html` | UI 비교 목업 (의사결정 완료, 보관용) |

### 수정
| 파일 | 변경 |
|---|---|
| `src/components/feed/YouTubeCard.tsx` | 액션 행에 "📖 딥다이브" 버튼 상시 노출 |
| `src/components/player/FloatingRadioPlayer.tsx` | `focus-feed:radio-seek` 이벤트 수신 → 초 단위 시킹 |
| `src/lib/video-transcript.ts` | InnerTube 폴백 추가 + `fetchTranscriptLines` 공유 함수 (단, PO 토큰으로 실효성 없음) |
| `src/lib/video-context.ts` | 공유 페처 사용하도록 정리 |

> ⚠️ **워킹트리에 병렬 세션 작업이 대량 섞여 있다** (playlists, e2e, PWA, scripts, gemini.ts 등).
> 커밋 시 디제스트 관련 파일만 선별하거나, 병렬 세션과 조율할 것.
> 디제스트 기능은 위 표의 파일만 건드리면 된다.

---

## 3. 지금 상태 — 검증된 것 / 안 된 것

### ✅ 로컬에서 실측 통과 (`next start` + `/api/debug-digest`)
- 5분 영상(자막 없음) → `mode=video`, 42초, 타임스탬프 정상(00:07~04:35), 인사이트 3·인용 3
- **70분 영상(자막 없음) → 118초, 섹션이 00:00~70:01 끝까지 커버** (긴 영상 유실 문제 해결 입증)
- 타임스탬프 환각(`04:00:00` 등) → 프롬프트+코드 이중 가드 후 재검증 시 초과 0개
- 캐시 히트 → 116ms 즉시 반환, Gemini 0콜
- lint·build·단위테스트 22개 통과
- Supabase secret 키로 RLS 우회 INSERT 201 확인 (로컬 .env.local)
- Gemini generateContent 200 (지출 한도 해소 확인)
- 피드 SSR에 딥다이브 버튼 60개 렌더 확인

### ❌ / ⚠️ 미완·미확인
1. **007 마이그레이션 미적용** — `source_mode='video'` INSERT가 여전히 CHECK 위반(400).
   미적용 시 영상 모드 디제스트가 캐시 안 됨(매번 재생성). **사용자가 SQL 실행해야 함.**
   → `docs/supabase-migrations/007_video_digest_video_mode.sql` 내용을
   `https://supabase.com/dashboard/project/olacbbfblhwssbcmradm/sql/new` 에서 Run.
2. **Vercel `SUPABASE_SERVICE_ROLE_KEY`** — 로컬은 secret 키로 교체·검증됨.
   Vercel 값은 API로 못 읽음. secret 키 저장이 마지막 Redeploy(14:27 KST) 이후라면 한 번 더 Redeploy 필요.
3. **⚠️ Vercel 플랜 maxDuration 타임아웃 (배포 시 핵심)** — debug-digest 라우트와 디제스트 서버 액션은
   긴 영상 분석에 42~118초가 걸린다(영상 이해). **Vercel Hobby 플랜은 함수 실행 상한이 기본 60초**라,
   배포하면 **긴 영상 딥다이브가 프로덕션에서 타임아웃**한다. `maxDuration=300`을 코드에 적어도 Hobby는
   무시. 단기 영상(<60s Gemini)·캐시 히트는 동작. → Vercel Fluid Compute 활성화 또는 Pro 플랜 필요.
   특히 007 미적용 상태에서는 video 모드가 캐시 안 돼 매번 재생성=매번 타임아웃 위험.
4. **브라우저 실제 조작 미검증** — `/api/debug-digest`로 파이프라인만 검증. 드로어 클릭→시킹,
   키워드→필터, 오토스크롤은 코드 경로만 확인했고 실제 클릭 테스트 안 함.
5. **드로어가 항상 영상 이해 경로** — 현재 자막을 못 가져오므로 `chunking.ts`의 맵리듀스 경로는
   사실상 죽은 코드. 자막이 되살아나면(서드파티 API 등) 활성화됨.
6. **transcript(자막) 모드 실검증 미완** — 자막 있는 영상을 못 찾아 청크 맵-리듀스 경로는 단위 테스트만
   통과. 자막 있는 영상으로 1회 검증 필요(chunkCount>1, 마지막 섹션 ts가 영상 후반인지).

> 참고: 병렬 세션이 같은 기능의 핸드오프 `docs/DEEPDIVE_DIGEST_HANDOFF_2026-06-11.md`를
> 별도로 작성(미완). 본 문서가 정본. 중복은 정리 대상.

---

## 4. 남은 작업 (우선순위 순)

### P0 — 기능 완성 차단
- [ ] **007 마이그레이션 실행** (사용자) → 실행 후 `source_mode='video'` INSERT 201 재확인
- [ ] **Vercel env secret 키 + Redeploy 확인** (사용자)
- [ ] 디제스트 파일 선별 **커밋 + push** (병렬 세션 조율 후)

### P1 — 검증 3종 (사용자가 "예정"이라고 명시한 작업)
- [ ] **적대적 검증 (adversarial)** — 아래 5절 체크리스트
- [ ] **코드 리뷰** — `/code-review high` 를 디제스트 diff에 실행
- [ ] **실제 사용 검증** — `/verify` 또는 수동: `npm run dev` → 카드 딥다이브 클릭 →
      타임스탬프 클릭 시 라디오가 그 구간부터 재생되는지, 키워드 칩 클릭 시 피드 필터 반영되는지,
      자막 전문 오토스크롤이 재생 따라가는지, degraded 배너·다시생성 동작하는지

### P2 — 후속 개선 (설계엔 있으나 미구현)
- [ ] **Step 7: 노션 동기화가 디제스트 재사용** — `notion-sync.ts`의 `analyzeVideoForNotion`을
      `digestToVideoAnalysis` 어댑터로 교체 (어댑터는 이미 작성됨, 연결만 남음).
      병렬 세션의 notion-sync 변경 머지 후 진행.
- [ ] **"이 영상에 질문" (Ask 패턴)** — FeedQADrawer 인프라에 영상 트랜스크립트 컨텍스트 주입
- [ ] **인용 → 공유 카드** (Snipd 스타일)
- [ ] **usage kind 분리** — 현재 디제스트가 `insight` 카운터 재사용. 멀티유저 시 `digest` 분리 필요
      (plan.ts/usage_daily/Database 타입 + 마이그레이션)
- [ ] **자막 복원 검토** — 서드파티 트랜스크립트 API(TranscriptAPI 등) 또는 PO 토큰 발급 도입 시
      `chunking.ts` 맵리듀스 경로 활성화 + 영상 이해 비용 절감 가능

### 미해결 알려진 이슈
- `chunking.ts` 맵리듀스 경로는 자막이 없어 현재 도달 불가 (죽은 코드 아님, 조건부 대기)
- 영상 이해는 비공개·연령제한·지역제한 영상에서 실패 → 제목·설명 폴백으로 강등(정상 동작)
- 3시간 초과 영상은 비용 가드로 영상 이해 스킵 → 제목·설명 폴백 (`VIDEO_UNDERSTANDING_MAX_SECONDS`)

---

## 5. 적대적 검증 체크리스트 (다음 세션이 실행)

`/api/debug-digest?videoId=...&force=1&duration=...` 로 다음을 깨보라:

- [ ] **타임스탬프 환각**: 다양한 길이 영상에서 `seconds > duration+60` 가 0인지 (parse.ts 가드)
- [ ] **인용 위조**: quotes.text가 영상에 실제 없는 말인지 (영상 이해라 검증 어려움 — 샘플 수동 대조)
- [ ] **JSON 파싱 실패**: 프롬프트가 마크다운 펜스/설명문 섞어 내도 `extractJsonObject`가 견디는지
- [ ] **비용 폭주**: 동일 영상 동시 다중 요청 시 캐시 경합 — race로 중복 Gemini 호출되는지
      (현재 캐시는 호출 후 저장이라 동시 첫 요청은 중복 가능 — 인지된 한계)
- [ ] **잘못된 videoId**: 11자 아님/특수문자 → `VIDEO_ID_PATTERN` 거부 확인
- [ ] **레이트리밋·사용량**: `guardGeminiActionRateLimit`/`checkUsageLimit` 우회 안 되는지
- [ ] **권한**: video_digests/video_transcripts가 anon에 안 열렸는지 (006에서 RLS deny, 재확인)
- [ ] **드로어 XSS**: digest 필드(헤드라인·인용)가 React 기본 이스케이프로 안전한지 (dangerouslySetInnerHTML 없음 확인)
- [ ] **degraded 경로**: 일부 청크 실패 시(자막 경로) 부분 결과 배너 + force 재생성
- [ ] **언마운트 race**: 드로어 빠르게 열고 닫을 때 setState-after-unmount 경고

## 6. 검증용 명령 모음

```powershell
# 서버 기동 (디제스트 디버그 활성)
$env:ENABLE_DEBUG_DIGEST = 'true'; npx next start -p 3100

# 5분 영상 (자막 없음 → 영상 이해)
curl.exe -s "http://localhost:3100/api/debug-digest?videoId=C4OnTmBPQhk&force=1&duration=304"
# 70분 영상
curl.exe -s "http://localhost:3100/api/debug-digest?videoId=D2__djLBE7c&force=1&duration=4235"
# 캐시 히트 (force 없이 재호출 → 116ms 즉시)
curl.exe -s "http://localhost:3100/api/debug-digest?videoId=C4OnTmBPQhk"

# 단위 테스트 / lint / build
npm run test:unit -- --run src/lib/digest
npm run lint; npm run build

# 007 적용 확인 (201 나오면 적용됨)
# Supabase REST로 source_mode='video' INSERT 프로브 후 DELETE (이 문서 작성 세션의 명령 참고)
```

검증 후 이 문서의 3·4절 체크박스를 갱신할 것.

---

## 7. 코드 리뷰 결과 (2026-06-11, high effort — 나중에 수정할 항목)

디제스트 파일에 대한 코드 리뷰를 1회 수행했다. **P0 없음.** 아래는 다음 세션이 고칠 목록.

### P1 — 캐시 저장 실패 시 사용량 이중 차감 + 재실행
`src/app/actions/digest.ts:90-99` + `store.ts:saveDigest`
`saveDigest`가 에러를 삼키고 void 반환 → 그 후 무조건 `incrementUsage`. 저장 실패(007 미적용·RLS·일시
장애) 시 매 요청이 캐시 미스로 Gemini 전체 파이프라인을 재실행하고 매번 사용량 차감. **현재 007 미적용
상태가 정확히 이 경로** — video 모드는 저장 실패라 매번 재생성.
→ 수정: `saveDigest`가 성공 여부 반환, 실패 시 명확히 로깅(이미 로깅은 함). 근본 해결은 007 적용.

### P1 — 동시 첫 요청이 둘 다 캐시 미스 → 둘 다 전체 파이프라인 실행
`src/app/actions/digest.ts:66-99`
같은 미캐시 영상을 동시에 열면(더블클릭·두 탭) 둘 다 `getCachedDigest`=null → 둘 다 영상 이해 호출.
드로어 클라이언트는 `requestedRef`로 자체 더블파이어를 막으므로 실제 위험은 탭/인스턴스 간뿐. 개인용엔
허용 범위. → 수정(선택): 인프로세스 in-flight Promise 맵으로 videoId별 dedupe, 또는 주석으로 수용 명시.

### P2 — 단일패스/리듀스 경로에 타임스탬프 환각 가드(maxSeconds) 미적용
`generate.ts:68,72` (runSinglePass), 리듀스 호출도 maxSeconds 누락. 영상 이해 경로만 maxSeconds 전달.
자막 모드의 LLM 환각 타임스탬프가 영상 끝을 넘어도 안 잘림 → 라디오가 영상 끝 너머로 시킹.
→ 수정: `runSinglePass`/리듀스에도 durationSeconds 전달.

### P2 — 라디오 시킹 600ms 고정 지연이 느린 연결에서 시킹 누락 가능
`FloatingRadioPlayer.tsx:391-394`
`loadVideoById` 직후 600ms 타임아웃 후 `seekTo`. 느린 연결은 아직 버퍼 전이라 YT IFrame이 시킹을 무시할
수 있음. → 수정: 고정 타임아웃 대신 대상 영상의 `onStateChange`→CUED/PLAYING 이벤트에서 시킹.

### P2 — title/channel 프롬프트 인젝션 (낮은 영향)
`prompts.ts:47-48,81-82,116-117` — 피드 메타데이터(공격자 제어 가능)가 프롬프트에 raw 삽입. 출력이
parse로 스키마 검증되고 도구 사용·비밀값 없으므로 영향 제한적이나, headline/keywords 텍스트를 조작당할 수
있음. XSS는 없음(React 이스케이프, dangerouslySetInnerHTML 없음 확인). → 수용 가능, 인지만.

### P2 — videoId 검증을 lib 진입부에도 (방어 심층화)
`video-understanding.ts:54`가 `fileUri`에 videoId를 unescaped 삽입. 현재 action·debug 라우트 둘 다
`/^[\w-]{5,20}$/` 검증 후 도달하므로 **오늘은 악용 불가**. 단 lib 자체는 검증 안 함 → 미래 호출자 위험.
→ 수정: `generateDigestTextFromVideoUrl`에 패턴 검증 추가.

### 리뷰에서 OK로 확인된 것 (수정 불필요)
- `playAt` 큐 인덱스 계산 정확(addToQueue 후 setCurrentIndex 클램프가 새 인덱스에 안착)
- XSS 없음, debug-digest 게이팅 정상, GeminiFailureKind 분기(auth/missing_key 중단) 정상
- parse 인용 드롭·배열 클램프·maxSeconds +60s 허용 타당, RLS 차단 정상(익명 빈배열·INSERT 401 실측)

## 8. 적대적 검증 — 이미 통과한 스팟체크 (2026-06-11)
- 잘못된 videoId(특수문자·빈값·과길이) → 전부 400 거부 ✅
- 익명 REST로 `video_digests`/`video_transcripts` SELECT → 빈 배열(RLS 필터) ✅, INSERT → 401 ✅
- 서비스롤만 실데이터 접근 ✅
- 나머지(비용 공격·force 반복·동시성·degraded 경로)는 5절 적대적 체크리스트로 다음 세션이 수행.
