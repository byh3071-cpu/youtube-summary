"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  getCustomSourcesFromCookie,
  filterValidSources,
  compactCustomSources,
  syncCustomSourcesWithDb,
} from "@/lib/custom-sources-cookie";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const SYNCED_FLAG_KEY = "focus_feed_sources_synced_v1";
const BACKUP_KEY = "focus_feed_sources_backup_v1";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * 앱 진입 시 1회(브라우저 세션당) 커스텀 소스를 복원·동기화한다.
 * 1. 쿠키가 비었는데 localStorage 백업이 있으면 복원 (ITP·쿠키 유실 자가 치유)
 * 2. 쿠키에만 있는 채널 → DB push, DB에만 있는 채널 → 쿠키 pull
 * 3. 최종 목록을 localStorage에 백업하고, 변경 시 서버 PUT으로 쿠키를 다시 굽고 새로고침
 * UI는 렌더링하지 않는다.
 */
export default function CustomSourcesSync() {
  const router = useRouter();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    try {
      if (sessionStorage.getItem(SYNCED_FLAG_KEY)) return;
    } catch {
      // sessionStorage 접근 불가 시에도 동기화 자체는 진행
    }

    let baseSources = getCustomSourcesFromCookie(getCookie(CUSTOM_SOURCES_COOKIE_NAME));
    let restoredFromBackup = false;
    if (baseSources.length === 0) {
      try {
        const backupRaw = localStorage.getItem(BACKUP_KEY);
        if (backupRaw) {
          const backup = filterValidSources(JSON.parse(backupRaw));
          if (backup.length > 0) {
            baseSources = backup;
            restoredFromBackup = true;
          }
        }
      } catch {
        // 백업 파싱 실패는 무시
      }
    }

    void (async () => {
      // 비로그인은 GET /api/custom-sources가 예상된 401을 내며 브라우저 콘솔에
      // 리소스 오류를 남기므로, 로컬 세션을 먼저 확인하고 로그인 시에만 DB 동기화한다.
      let isLoggedIn = false;
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          isLoggedIn = !!session;
        } catch {
          // 세션 확인 실패 시 비로그인으로 간주
        }
      }

      const { merged, changed } = isLoggedIn
        ? await syncCustomSourcesWithDb(baseSources)
        : { merged: baseSources, changed: false };

      try {
        sessionStorage.setItem(SYNCED_FLAG_KEY, "1");
      } catch {
        // ignore
      }
      try {
        if (merged.length > 0) {
          localStorage.setItem(BACKUP_KEY, JSON.stringify(compactCustomSources(merged)));
        }
      } catch {
        // ignore
      }
      if (changed || restoredFromBackup) {
        // 쿠키는 서버 Set-Cookie로 굽는다 (JS 쿠키는 iOS Safari에서 7일 만료)
        try {
          await fetch("/api/custom-sources", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(merged),
          });
        } catch {
          // 실패해도 다음 진입 시 재시도됨
        }
        router.refresh();
      }
    })();
  }, [router]);

  return null;
}
