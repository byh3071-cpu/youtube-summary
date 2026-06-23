-- 팀 테이블 RLS 하드닝 (TEAM-01 / AUDIT OPS-01 후속 조치)
-- 목적: 003_teams.sql 이 만든 teams/team_members/team_invites 에 RLS·정책이 0개라
--       anon/authenticated 키로 직접 조회가 차단되지 않는 배포 위생 결함을 닫는다.
-- 적용법: Supabase Dashboard > SQL Editor 에서 실행. 재실행 가능(멱등).
-- 전제: 003_teams.sql 적용으로 teams/team_members/team_invites 테이블이 존재.

-- =====================================================================
-- 1) team_members: RLS 활성화 + 본인 membership 만 SELECT
--    정책 본문은 auth.uid() = user_id 한 줄로 자기 자신만 참조 → 재귀 없음.
--    (teams 정책이 team_members 를 서브쿼리로 참조해도 이 정책이 비재귀라 안전)
-- =====================================================================
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_select_own" ON public.team_members;
CREATE POLICY "team_members_select_own"
  ON public.team_members FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================================
-- 2) teams: RLS 활성화 + 본인이 멤버인 팀만 SELECT
--    team_members 서브쿼리로 멤버십을 확인한다. 서브쿼리에는 위 1)의
--    team_members_select_own 정책(auth.uid()=user_id)이 자동 적용되므로
--    "내가 멤버인 행"만 매칭되어 결과적으로 본인 소속 팀만 노출된다.
-- =====================================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_member" ON public.teams;
CREATE POLICY "teams_select_member"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 3) team_invites: RLS 활성화, client 정책 없음 = Service Role 전용
--    초대 토큰/이메일은 anon/authenticated 에게 직접 노출하면 안 되므로
--    SELECT 정책을 의도적으로 만들지 않는다. RLS 가 켜진 상태에서 정책이
--    없으면 anon/authenticated 는 0행만 보게 되고, service_role 은 RLS 를
--    우회하므로 서버(초대 조회/수락) 경로에서만 접근한다.
-- =====================================================================
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4) 쓰기(INSERT/UPDATE/DELETE) 정책은 세 테이블 모두 만들지 않는다.
--    팀 생성·멤버 추가·초대 발급/소비는 서버(service_role) 경로에서만 수행하고,
--    서버 코드가 세션 사용자와 역할(role)을 재검증한다.
--    anon/authenticated 용 쓰기 정책을 추가하지 말 것(직접 변조 차단).
-- =====================================================================
