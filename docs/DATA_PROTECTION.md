# 데이터 보호 · 무결성 메모 (Bookmarks / Playlists)

이 문서는 Supabase에 저장되는 **개인화 데이터(북마크, 플레이리스트)**의 기본 구조와,
무결성·보호 관점에서 확인해야 할 포인트를 요약합니다.

---

## 1. 북마크(bookmarks) 테이블

- 스키마 (요약)
  - `id`: string (PK)
  - `user_id`: string (FK, Supabase auth.users.id)
  - `video_id`: string
  - `video_title`: string
  - `highlight`: string
  - `created_at`: timestamp

- API 사용 방식
  - `/api/bookmarks` (GET/POST/DELETE)
  - 항상 **`user_id = 현재 로그인 유저` 조건**으로 접근
  - 비로그인 시에는 빈 배열 또는 401을 반환

- 무결성 체크 포인트
  - Supabase에서 `bookmarks.user_id`에 대해 **외래키 제약(FK)**이 걸려 있는지 확인
  - `(user_id, video_id)`에 대해 **유니크 인덱스**를 두어 중복 북마크를 방지
  - 삭제/변경 이력까지 필요하다면, 별도의 **감사 로그 테이블**을 두고 최소한
    `user_id, action, target_id, timestamp` 정도를 기록

---

## 2. 플레이리스트(playlists) 테이블

- 스키마 (요약)
  - `id`: string (PK)
  - `user_id`: uuid | null (FK, auth.users.id — `001_plan_usage_playlists.sql`)
  - `title`: string | null
  - `items`: JSON/unknown (라디오 큐 아이템 목록)
  - `created_at`: timestamp

- 접근 정책 (2026-06-11 QA 후속으로 확정)
  - 서버 DB 플레이리스트는 **로그인 사용자만** 저장·조회·이름변경·삭제할 수 있다.
  - 비로그인 큐는 브라우저 메모리에서만 사용하며 **서버 저장은 금지**한다.
  - `POST /api/playlists/save`: 쿠키 세션 미확인 시 **401**. 클라이언트가 보낸 userId는 신뢰하지 않는다.
  - `savePlaylistAction` / `renamePlaylistAction` / `deletePlaylistAction`
    (`src/app/actions/playlists.ts`): 액션 내부에서 쿠키 세션 사용자를 직접 확인하고,
    모든 update/delete에 `.eq("user_id", user.id)` 조건을 강제한다 (userId 인자를 받지 않음).
  - `/playlists` 페이지(`src/lib/playlists-server.ts`): 비로그인은 DB를 조회하지 않고 로그인 CTA만 표시.
    `user_id IS NULL` 조회 경로는 제거됨.

- 기존 익명 행(`user_id IS NULL`) 처리
  - 사용자에게 어떤 화면에서도 노출하지 않는다.
  - 자동 삭제·특정 사용자 자동 귀속을 하지 않는다. **운영자 수동 검토** 대상.
  - 검토 SQL: `SELECT id, title, created_at FROM public.playlists WHERE user_id IS NULL;`

- RLS·Service Role
  - `005_playlists_owner_required.sql`: RLS 활성화 + 본인 소유 SELECT 정책. 쓰기 정책은 없음(서버 전용).
  - Service Role 키는 RLS를 **우회**하므로, RLS가 있어도 서버 코드의 명시적 `user_id` 조건을 절대 생략하지 않는다.
  - 이 액션들은 반드시 서버에서만 실행되며, 키가 클라이언트 번들로 노출되지 않도록 환경변수 관리에 주의

---

## 3. 백업 · 복구 전략(제안)

- Supabase 프로젝트 설정에서 **자동 백업/스냅샷** 기능을 활성화
- 최소한 하루 1회 단위의 백업 주기를 권장
- 사고 발생 시, 아래 순서로 영향 범위 파악
  1. 북마크/플레이리스트 관련 Supabase 로그에서 에러/삭제 기록 확인
  2. 필요 시 특정 시점 스냅샷에서 해당 테이블만 복구하는 방안 검토

---

## 4. 운영 체크리스트

- [ ] `bookmarks.user_id`에 FK 및 필요한 인덱스가 설정되어 있다
- [ ] `playlists`의 활용 방식(개인용 vs 공유용)을 팀 내에서 명확히 합의했다
- [ ] Supabase 백업 설정이 켜져 있고, 복구 테스트를 최소 1회 이상 해봤다
- [ ] Service Role 키가 클라이언트에 노출되지 않도록 환경변수 구성이 되어 있다

