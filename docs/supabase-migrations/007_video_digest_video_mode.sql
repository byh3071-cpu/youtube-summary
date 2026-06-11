-- 007: 디제스트 source_mode에 'video'(Gemini 네이티브 영상 이해) 추가
-- 006을 'video' 포함 이전 버전으로 이미 실행한 프로젝트용. (006 신규 실행 시 불필요)

ALTER TABLE public.video_digests
  DROP CONSTRAINT IF EXISTS video_digests_source_mode_check;

ALTER TABLE public.video_digests
  ADD CONSTRAINT video_digests_source_mode_check
  CHECK (source_mode IN ('transcript', 'snippet', 'video'));
