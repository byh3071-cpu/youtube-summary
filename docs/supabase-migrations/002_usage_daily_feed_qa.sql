-- 피드 Q&A 일일 카운터 (Free 플랜 한도용)
-- 001 적용 후 Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.usage_daily
  ADD COLUMN IF NOT EXISTS feed_qa_count int NOT NULL DEFAULT 0;
