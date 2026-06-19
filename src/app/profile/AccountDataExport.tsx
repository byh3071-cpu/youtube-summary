"use client";

import { useState } from "react";

/**
 * 내 데이터 내보내기: 서버 데이터(/api/account/export)와 브라우저 저장소
 * (localStorage·sessionStorage)를 합쳐 단일 JSON 파일로 내려받는다.
 */
export default function AccountDataExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "로그인이 필요합니다."
            : "서버 데이터를 불러오지 못했습니다.",
        );
      }
      const serverPayload = (await res.json()) as Record<string, unknown>;

      const dumpStorage = (store: Storage): Record<string, string> => {
        const out: Record<string, string> = {};
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key) out[key] = store.getItem(key) ?? "";
        }
        return out;
      };

      const full = {
        ...serverPayload,
        browserData: {
          localStorage: dumpStorage(window.localStorage),
          sessionStorage: dumpStorage(window.sessionStorage),
        },
      };

      const blob = new Blob([JSON.stringify(full, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `focus-feed-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-4 py-2.5 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover) disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "내보내는 중..." : "내 데이터 내보내기 (JSON)"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <p className="mt-2 text-xs text-(--notion-fg)/50">
        북마크·플레이리스트·커스텀 소스와 이 브라우저에 저장된 목표·요약·시청 기록을 한 파일로 받습니다.
      </p>
    </div>
  );
}
