-- 플랜·사용량·플레이리스트 user_id (수동 적용용)
-- Supabase Dashboard > SQL Editor에서 순서대로 실행하세요.

-- 1. user_plan: 사용자별 플랜 (free / pro)
CREATE TABLE IF NOT EXISTS public.user_plan (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_plan_select_own"
  ON public.user_plan FOR SELECT
  USING (auth.uid() = user_id);

-- 서버(service_role)에서만 쓰기 가능하므로 INSERT/UPDATE 정책은 서버에서 처리.

-- 2. usage_daily: 일별 사용량 (요약·인사이트·브리핑)
CREATE TABLE IF NOT EXISTS public.usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  summary_count int NOT NULL DEFAULT 0,
  insight_count int NOT NULL DEFAULT 0,
  briefing_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

-- 서버(service_role)에서만 읽기/쓰기. 앱에서 개별 사용자 조회는 서버 액션에서만 하므로 RLS 정책 생략 가능.
-- 필요 시: CREATE POLICY "usage_daily_select_own" ON public.usage_daily FOR SELECT USING (auth.uid() = user_id);

-- 3. playlists에 user_id 추가 (기존 행은 NULL)
ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON public.playlists(user_id);

-- 피드 Q&A 일일 한도 컬럼: `002_usage_daily_feed_qa.sql` 참고.
