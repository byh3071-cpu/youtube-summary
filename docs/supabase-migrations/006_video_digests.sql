-- 006: 영상 자막 캐시 + 디제스트(구조화 분석) 캐시
-- 두 테이블 모두 서버 전용(service role) — RLS를 켜고 정책을 만들지 않아
-- anon/authenticated 직접 접근을 전면 차단한다 (2026-06-11 감사 권고).

CREATE TABLE IF NOT EXISTS public.video_transcripts (
  video_id   text PRIMARY KEY,
  mode       text NOT NULL CHECK (mode IN ('transcript', 'snippet')),
  lines      jsonb,                          -- mode='transcript': [{"text","offset"}] (offset: 초)
  text       text,                           -- mode='snippet': 제목·설명 텍스트
  char_count int  NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_digests (
  video_id       text NOT NULL,
  schema_version int  NOT NULL DEFAULT 1,
  digest         jsonb NOT NULL,             -- VideoDigest (src/lib/digest/types.ts)
  model          text  NOT NULL,             -- 생성에 사용한 Gemini 모델 ID(기본 모델 기준)
  source_mode    text  NOT NULL CHECK (source_mode IN ('transcript', 'snippet', 'video')),
  chunk_count    int   NOT NULL DEFAULT 1,
  degraded       boolean NOT NULL DEFAULT false,  -- 일부 청크 실패로 부분 결과인 경우 true
  failed_chunks  int   NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, schema_version)
);

CREATE INDEX IF NOT EXISTS idx_video_digests_created_at
  ON public.video_digests (created_at);

ALTER TABLE public.video_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_digests     ENABLE ROW LEVEL SECURITY;
