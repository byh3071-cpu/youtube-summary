-- 콘텐츠 처리 상태 모델 (개인 연구 시스템 스펙 §5·§6, Phase 1)
-- 재실행 가능. Supabase Dashboard > SQL Editor에서 실행하세요.
-- 전제: auth.users 존재.
--
-- 목적: 콘텐츠 메타데이터(제목·URL 등)는 피드에서 매번 조립하고,
--       이 테이블은 "사용자별 콘텐츠 처리 상태"만 보관해 기기 간 동기화를 가능하게 한다.
--       (content_id 로 피드 아이템과 조인)

create table if not exists public.content_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,                 -- YouTube videoId 또는 RSS 항목 link
  source_id text,                           -- 소스(채널/RSS) 식별자
  source_type text check (source_type in ('YouTube', 'RSS')),
  -- 처리 상태(스펙 §5). 자동 추론보다 사용자의 명시적 선택을 우선한다.
  state text not null default 'inbox'
    check (state in (
      'inbox', 'queued', 'consuming', 'consumed',
      'processing', 'reviewed', 'exported', 'archived',
      'dismissed', 'failed'
    )),
  play_position_seconds double precision not null default 0,
  completed boolean not null default false,
  notion_page_id text,                      -- 부분 실패 시에도 잃지 않아야 한다(스펙 §9)
  last_synced_at timestamptz,
  state_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

-- 조회 인덱스: 상태별 인박스, 소스별 집계(소스 헬스)
create index if not exists idx_content_states_user_state
  on public.content_states (user_id, state);
create index if not exists idx_content_states_user_source
  on public.content_states (user_id, source_id);

-- RLS: 본인 행만 접근.
-- content_states 는 민감도가 낮고 재생 위치 등 빈번히 갱신되므로, 005(playlists)와 달리
-- 클라이언트(anon+세션)에서도 본인 행을 직접 CRUD 할 수 있게 정책을 둔다.
-- 서버(service_role) 경로는 RLS 를 우회하되 앱 코드에서도 user_id 조건을 유지한다.
alter table public.content_states enable row level security;

drop policy if exists "content_states_select_own" on public.content_states;
create policy "content_states_select_own"
  on public.content_states for select
  using (auth.uid() = user_id);

drop policy if exists "content_states_insert_own" on public.content_states;
create policy "content_states_insert_own"
  on public.content_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "content_states_update_own" on public.content_states;
create policy "content_states_update_own"
  on public.content_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "content_states_delete_own" on public.content_states;
create policy "content_states_delete_own"
  on public.content_states for delete
  using (auth.uid() = user_id);
