import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 우리가 사용할 DB 타입(테이블들)을 최소한으로 정의해 두면 좋습니다.
export type Database = {
  public: {
    Tables: {
      summaries: {
        Row: {
          id: number;
          video_id: string;
          summary: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          video_id: string;
          summary: string;
          source?: string | null;
          created_at?: string;
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["summaries"]["Row"]>;
      };
      playlists: {
        Row: {
          id: string;
          user_id: string | null;
          title: string | null;
          items: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title?: string | null;
          items: unknown;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["playlists"]["Row"]>;
      };
      user_plan: {
        Row: {
          user_id: string;
          plan: string;
          expires_at: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: string;
          expires_at?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_plan"]["Row"]>;
      };
      usage_daily: {
        Row: {
          user_id: string;
          date: string;
          summary_count: number;
          insight_count: number;
          briefing_count: number;
          feed_qa_count: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          summary_count?: number;
          insight_count?: number;
          briefing_count?: number;
          feed_qa_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_daily"]["Row"]>;
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          video_id: string;
          video_title: string;
          highlight: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team_id?: string | null;
          video_id: string;
          video_title: string;
          highlight: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Row"]>;
      };
      teams: {
        Row: {
          id: string;
          name: string;
          plan: string;
          goal_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan?: string;
          goal_text?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Row"]>;
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Row"]>;
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          email: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          email: string;
          token: string;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_invites"]["Row"]>;
      };
      trend_cache: {
        Row: {
          id: string;
          bucket: string;
          trends: unknown;
          generated_at: string;
        };
        Insert: {
          id?: string;
          bucket: string;
          trends: unknown;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trend_cache"]["Row"]>;
      };
      custom_sources: {
        Row: {
          id: string;
          user_id: string;
          source_id: string;
          name: string;
          category: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_id: string;
          name: string;
          category?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_sources"]["Row"]>;
      };
      content_states: {
        Row: {
          user_id: string;
          content_id: string;
          source_id: string | null;
          source_type: string | null;
          state: string;
          play_position_seconds: number;
          completed: boolean;
          notion_page_id: string | null;
          last_synced_at: string | null;
          state_changed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          content_id: string;
          source_id?: string | null;
          source_type?: string | null;
          state?: string;
          play_position_seconds?: number;
          completed?: boolean;
          notion_page_id?: string | null;
          last_synced_at?: string | null;
          state_changed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_states"]["Row"]>;
      };
    };
  };
};

/** Supabase URL/Key가 실제로 유효한지 검사하는 헬퍼 */
function isValidSupabaseEnv(url: string | undefined, key: string | undefined): boolean {
  if (!url || !key) return false;

  // placeholder 값이면 무시
  if (url === "your_supabase_project_url") return false;
  if (key === "your_supabase_service_role_key") return false;

  // URL 형식 검증 (http/https 필수)
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * 서버 전용 Supabase 클라이언트.
 * - env가 없거나 placeholder면 null 반환해서 기능을 끌 수 있게 함.
 * - Service Role 키 사용 → 반드시 서버에서만 호출.
 */
export function getServerSupabaseClient():
  | SupabaseClient<Database>
  | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidSupabaseEnv(url, serviceKey)) {
    // 설정 안 돼 있거나 placeholder면 안전하게 비활성화
    return null;
  }

  try {
    const client = createClient<Database>(url!, serviceKey!, {
      auth: {
        persistSession: false,
      },
    });
    return client;
  } catch (error) {
    console.error("Failed to create Supabase client. Disabling Supabase features.", error);
    return null;
  }
}

/**
 * 특정 테이블에 대한 타입을 강제하는 헬퍼 함수.
 * Supabase 클라이언트의 제네릭 추론 한계를 보완합니다.
 */
export function getTypedTable<T extends keyof Database["public"]["Tables"]>(
  tableName: T
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  return supabase.from(tableName);
}

/**
 * 요약(summaries) 기능 전용 Supabase 클라이언트 헬퍼.
 */
export function getSupabaseForSummaries() {
  return getTypedTable("summaries");
}

/**
 * Supabase PostgREST의 제네릭 추론이 insert/update/delete에서
 * `never`로 귀결되는 문제를 우회하는 헬퍼.
 * 타입 안전성보다 런타임 동작이 우선인 mutation 작업에 사용합니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMutationTable(tableName: string): any | null {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(tableName);
}