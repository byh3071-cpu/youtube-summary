-- 플레이리스트 소유권 필수화 (2026-06-11 QA 후속 조치)
-- 재실행 가능. Supabase Dashboard > SQL Editor에서 실행하세요.
-- 전제: 001_plan_usage_playlists.sql 적용으로 playlists.user_id 컬럼·인덱스가 존재.

-- 1) RLS 활성화: anon/authenticated 키로의 직접 테이블 접근을 차단한다.
--    (service_role은 RLS를 우회하므로 서버 코드의 명시적 user_id 조건이 실질 방어선이며,
--     앱 코드에서도 모든 playlists 쿼리에 user_id 조건을 유지한다.)
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- 2) 본인 소유 행만 SELECT 허용.
--    user_id IS NULL(익명) 행은 auth.uid() = user_id에 매칭되지 않으므로 누구에게도 노출되지 않는다.
DROP POLICY IF EXISTS "playlists_select_own" ON public.playlists;
CREATE POLICY "playlists_select_own"
  ON public.playlists FOR SELECT
  USING (auth.uid() = user_id);

-- 3) INSERT/UPDATE/DELETE 정책은 만들지 않는다.
--    쓰기는 서버(service_role) 경로에서만 수행하고, 서버 코드가 세션 사용자 확인 +
--    .eq("user_id", user.id) 조건을 강제한다.

-- 4) 기존 user_id IS NULL 행 처리 정책:
--    자동 삭제·특정 사용자 자동 귀속 금지. 운영자가 수동 검토 후 처분한다.
--    검토용 조회:
--    SELECT id, title, created_at FROM public.playlists WHERE user_id IS NULL ORDER BY created_at DESC;
