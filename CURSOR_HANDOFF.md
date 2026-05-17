# Supabase 고도화 — Cursor 작업 지침서

> **참고 (2026-05-17)** 이 파일은 과거 페이즈(6~7) 기준으로 작성됨. 현재 제품 범위·플랜은 **`docs/PRD.md`** 와 코드를 우선한다.

> 이 문서는 Antigravity가 코드 전체를 점검한 결과를 기반으로, Cursor가 **Supabase 관련 기능**을 구현할 때 따를 기획·우선순위·체크리스트입니다.

**Phase 6~7 완료 (2026-03-12)**  
채널 동기화 및 북마크 구현 완료.

**코드 리팩토링 완료 (2026-03-13)**  
AI 프롬프트 중앙 관리(`src/lib/prompts.ts`), Supabase 타입 안정성 강화(`getTypedTable`), 모델명 수정(`gemini-1.5-flash`) 완료. 향후 모든 작업은 **`cursor_implementation_guide.md`**를 최우선으로 따를 것.

---

## 현재 상태 (이미 완료된 것)

| 기능 | 파일 | 상태 |
|------|------|:----:|
| Supabase 서버 클라이언트 | `src/lib/supabase-server.ts` | ✅ |
| Supabase 브라우저 클라이언트 | `src/lib/supabase-browser.ts` | ✅ |
| DB 타입 정의 (summaries, playlists, bookmarks) | `supabase-server.ts` | ✅ |
| AI 요약 Supabase 캐싱 | `src/app/actions/summarize.ts` | ✅ |
| 플레이리스트 저장 API | `src/app/api/playlists/save/route.ts` | ✅ |
| 플레이리스트 목록 조회 | `src/app/playlists/page.tsx` | ✅ |
| Google OAuth 로그인 버튼 | `src/components/auth/LoginButton.tsx` | ✅ |
| Auth callback 라우트 | `src/app/auth/callback/route.ts` | ✅ |
| 채널 추가/삭제 (쿠키 기반) | `custom-sources-cookie.ts`, `AddChannelModal.tsx` | ✅ |
| 키워드 필터 (localStorage) | `src/lib/storage.ts` | ✅ |
| 시청 진행도 (localStorage) | `src/lib/watch-history.ts` | ✅ |
| My Focus 목표 (localStorage) | `src/lib/goals.ts` | ✅ |

---

## 아직 안 된 것 (Cursor가 해야 할 일)

| 기능 | 현재 | 목표 |
|------|------|------|
| 채널 목록 | 쿠키 저장 → 기기간 공유 불가 | Supabase DB 동기화 |
| 키워드 필터 | localStorage → 기기간 공유 불가 | Supabase 또는 쿠키 + DB 동기화 |
| 시청 기록 | localStorage만 | Supabase에 백업 (로그인 시) |
| 북마크 | DB 타입만 정의, UI 없음 | 북마크 저장/조회 UI 구현 |
| 플레이리스트 | 저장만 가능, user 구분 없음 | 로그인 유저별 분리 |
| RLS (보안) | 없음 — 서비스 키로 전체 접근 | 유저별 데이터 격리 |

---

## [Phase 6] 채널 목록 Supabase 동기화 (최우선 — 복사 영역)

**배경 (Context)**
현재 사용자가 추가한 유튜브 채널은 **쿠키**(`focus_feed_sources`)에만 저장되어 있습니다. 브라우저를 바꾸거나 다른 기기에서 접속하면 추가한 채널이 보이지 않습니다. Supabase Auth(Google 로그인)가 이미 동작하므로, 로그인한 유저의 추가 채널 목록을 **Supabase DB에 동기화**하는 것이 가장 효과가 큰 다음 단계입니다.

**목표**
- 로그인한 유저: 채널 추가/삭제 시 쿠키 **+** Supabase `custom_sources` 테이블에 동시 반영
- 비로그인 유저: 기존과 동일하게 쿠키만 사용 (변경 없음)
- 페이지 로드 시: 로그인 상태면 DB에서 채널 목록을 가져와서 쿠키와 **merge**

**우선순위 (개발 대상)**

### 6-1. DB 스키마 & 타입 확장

1. Supabase SQL Editor에서 `custom_sources` 테이블 생성 (DDL은 `docs/SUPABASE_CHANNEL_SYNC_TODO.md` § 2-1 참고)
2. `src/lib/supabase-server.ts`의 `Database` 타입에 `custom_sources` 테이블 Row/Insert/Update 추가

### 6-2. API 라우트 구현

`src/app/api/custom-sources/route.ts` (GET/POST/DELETE)

| 메서드 | 동작 |
|--------|------|
| **GET** | 쿠키에서 Supabase 세션 확인 → user_id로 `custom_sources` 조회 → `FeedSource[]` 반환 |
| **POST** | body: `{ sourceId, name, category, avatarUrl? }` → DB insert |
| **DELETE** | `?sourceId=UC...` → 해당 행 delete |

- 세션 읽기: `@supabase/ssr`의 `createServerClient`로 쿠키에서 user 식별
- 비로그인이면 빈 배열 반환 (에러 X)

### 6-3. 채널 추가/삭제 시 DB 반영

- `src/components/feed/AddChannelModal.tsx`:  
  채널 추가 성공 시 → 쿠키 갱신 **뒤에** `POST /api/custom-sources` 호출 (fire-and-forget)
- `src/components/layout/YouTubeSourceList.tsx`:  
  채널 제거 시 → 쿠키 갱신 **뒤에** `DELETE /api/custom-sources?sourceId=...` 호출

### 6-4. 페이지 로드 시 DB → 쿠키 병합

- `src/app/page.tsx`:  
  로그인 상태 확인 → Supabase에서 `custom_sources` 가져오기 → `mergeSources()`로 쿠키 소스와 합치기
  (이미 `mergeSources` 함수가 존재하므로 그대로 활용)

**핵심 주의사항**
- DB 호출 실패 시에도 **기존 쿠키 동작이 깨지면 안 됨** (best-effort 동기화)
- `supabase-server.ts`의 `getServerSupabaseClient()`는 Service Role Key 사용 → **유저 식별이 안 됨**. 채널 동기화에서는 반드시 `createServerClient(@supabase/ssr)` + Anon Key로 **쿠키 세션 기반** user 식별을 해야 함
- `custom_sources` 테이블의 `user_id`는 `auth.users(id)` 참조 (RLS 적용)

**완료 기준**
- [ ] Supabase에 `custom_sources` 테이블이 생성되어 있음 *(대시보드에서 DDL 실행 필요)*
- [x] `Database` 타입에 `custom_sources`가 추가됨
- [x] API 라우트 (`/api/custom-sources`) GET/POST/DELETE 동작
- [x] 채널 추가/삭제 시 DB에 반영됨 (로그인 시)
- [x] 페이지 새로고침 시 DB의 채널 목록이 피드에 반영됨
- [x] 비로그인 시 기존 동작(쿠키만)과 동일하게 유지

---

## [Phase 7] 북마크 & 하이라이트 (두 번째 우선순위)

**배경**: `bookmarks` 테이블 타입은 `supabase-server.ts`에 이미 정의되어 있지만, UI도 API도 없습니다.

**목표**: 피드 아이템이나 AI 요약에서 "북마크" 버튼을 눌러 저장하고, 나중에 모아볼 수 있는 기능.

**우선순위 (개발 대상)**

1. **북마크 저장 API**: `POST /api/bookmarks` — `{ video_id, video_title, highlight }` → DB insert
2. **북마크 삭제 API**: `DELETE /api/bookmarks?id=...`
3. **북마크 버튼**: `YouTubeCard.tsx` 또는 `FeedItem.tsx`에 북마크 아이콘 버튼 추가
4. **북마크 목록 페이지**: `src/app/bookmarks/page.tsx` — Supabase에서 유저의 북마크 목록 조회 + 삭제
5. **사이드바 링크**: 사이드바에 "북마크" 메뉴 항목 추가

**완료 기준**
- [x] 피드 카드에서 북마크 추가/제거 가능
- [x] `/bookmarks` 페이지에서 저장한 북마크 목록 표시
- [x] 로그인 유저만 북마크 사용 가능 (비로그인 시 안내 메시지)

---

## [Phase 8] 설정(Preferences) 동기화 (세 번째 우선순위)

**배경**: 키워드 필터(`storage.ts`), 시청 기록(`watch-history.ts`), My Focus 목표(`goals.ts`)가 모두 **localStorage**에만 저장됩니다.

**목표**: 로그인 시 이 데이터를 Supabase에 백업하고, 다른 기기에서 로그인하면 복원.

**우선순위 (개발 대상)**

1. **`user_preferences` 테이블** 생성:
   ```sql
   create table if not exists public.user_preferences (
     user_id uuid primary key references auth.users(id) on delete cascade,
     keywords text[] default '{}',
     goals text default '',
     updated_at timestamptz default now()
   );
   ```
2. **동기화 유틸**: `src/lib/sync-preferences.ts`
   - `pushPreferences(userId)`: localStorage → DB
   - `pullPreferences(userId)`: DB → localStorage
   - 로그인 직후 자동 pull, 설정 변경 시 debounced push
3. **시청 기록 테이블** (선택):
   ```sql
   create table if not exists public.watch_history (
     user_id uuid references auth.users(id) on delete cascade,
     video_id text not null,
     last_position_seconds float default 0,
     duration_seconds float default 0,
     completed boolean default false,
     updated_at timestamptz default now(),
     primary key (user_id, video_id)
   );
   ```
   - 현재 `watch-history.ts`의 `saveWatchProgress`에서 DB 저장도 병렬 수행

**완료 기준**
- [ ] `user_preferences` 테이블 생성
- [ ] 로그인 시 키워드·목표가 DB에서 복원됨
- [ ] 키워드·목표 변경 시 DB에 동기화됨
- [ ] (선택) 시청 기록도 DB 동기화

---

## [Phase 9] RLS 보안 강화 (네 번째 — Phase 6~8 완료 후)

**배경**: 현재 데이터 접근은 `SUPABASE_SERVICE_ROLE_KEY`로 RLS를 우회합니다. Phase 6~8에서 유저별 데이터가 늘어나면 보안이 중요해집니다.

**목표**: 모든 유저 데이터 테이블에 RLS 정책을 적용하여, 유저가 자신의 데이터만 접근할 수 있게 합니다.

**우선순위 (개발 대상)**

1. **RLS 정책 적용**: `custom_sources`, `bookmarks`, `playlists`, `user_preferences`, `watch_history` 테이블에 `auth.uid() = user_id` 정책 추가
2. **플레이리스트 user_id 추가**: 현재 `playlists` 테이블에 `user_id` 컬럼이 없음 → 마이그레이션 필요
3. **API 라우트 전환**: Service Role Key → Anon Key + 쿠키 세션으로 전환 (유저 식별)
4. **summarize.ts 유지**: AI 요약 캐시는 유저 구분 없이 공유해도 됨 → Service Role Key 유지 OK

**완료 기준**
- [ ] 모든 유저 데이터 테이블에 RLS 정책 적용
- [ ] playlists에 user_id 컬럼 추가 + 기존 데이터 마이그레이션
- [ ] API 라우트에서 Anon Key + 세션 기반 접근으로 전환

---

## 작업 순서 요약

```
Phase 6 (채널 동기화)     ← 지금 시작    ← Cursor의 강점: API 라우트 + DB 연동
  ↓
Phase 7 (북마크)          ← Phase 6 완료 후
  ↓
Phase 8 (설정 동기화)     ← Phase 7 완료 후
  ↓
Phase 9 (RLS 보안)        ← 마지막 마무리
```

---

## Cursor 참고 사항

- **AI 구현 수칙**: 모든 AI 프롬프트는 `src/lib/prompts.ts`에서 가져올 것. 직접 문자열로 하드코딩 금지.
- **Supabase 호출**: `supabase.from("table")` 대신 `src/lib/supabase-server.ts`의 `getTypedTable("table")`을 사용하여 타입 안정성 확보할 것.
- **기존 파일 보존**: `RadioQueueContext.tsx`, `FloatingRadioPlayer.tsx` 등 핵심 플레이어 로직 안정화됨 - 수정 금지.
- **검증**: 작업 후 `npm run lint` 및 `npm run build` 확인 필수.

> [!NOTE]
> Phase 6 완료 후 브라우저에서 로그인 → 채널 추가 → 다른 브라우저에서 로그인해서 채널이 동기화되는지 확인하고, 결과를 안티그래비티에게 알려주세요!
