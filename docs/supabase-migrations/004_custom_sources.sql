-- 사용자별 추가 YouTube 채널 저장
CREATE TABLE IF NOT EXISTS public.custom_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT '기타',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_id)
);

ALTER TABLE public.custom_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own custom_sources"
  ON public.custom_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom_sources"
  ON public.custom_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom_sources"
  ON public.custom_sources FOR DELETE
  USING (auth.uid() = user_id);
