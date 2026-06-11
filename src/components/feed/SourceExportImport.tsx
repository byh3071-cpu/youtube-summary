"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, X } from "lucide-react";
import { ModalTransition } from "@/components/ui/ModalTransition";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  getCustomSourcesFromCookie,
} from "@/lib/custom-sources-cookie";
import type { FeedSource } from "@/lib/sources";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function parseImportJson(raw: string): FeedSource[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is FeedSource =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as FeedSource).id === "string" &&
        typeof (item as FeedSource).name === "string" &&
        (item as FeedSource).type === "YouTube" &&
        typeof (item as FeedSource).category === "string"
    ) as FeedSource[];
  } catch {
    return null;
  }
}

export default function SourceExportImport() {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const raw = getCookie(CUSTOM_SOURCES_COOKIE_NAME);
    const list = getCustomSourcesFromCookie(raw);
    if (list.length === 0) {
      if (typeof window !== "undefined") window.alert("내보낼 추가 채널이 없습니다.");
      return;
    }
    const json = JSON.stringify(list, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus-feed-channels-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfirm = async () => {
    setImportError(null);
    const text = importText.trim();
    if (!text) {
      setImportError("JSON을 붙여넣거나 파일을 선택해 주세요.");
      return;
    }
    const parsed = parseImportJson(text);
    if (!parsed || parsed.length === 0) {
      setImportError("올바른 채널 목록 형식이 아닙니다. 내보낸 JSON 파일 내용을 붙여넣어 주세요.");
      return;
    }
    // 병합·쿠키 갱신·DB 저장은 서버가 담당 (Set-Cookie 단일 쓰기 경로)
    try {
      const res = await fetch("/api/custom-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const failed = (await res.json().catch(() => null)) as { error?: string } | null;
        setImportError(failed?.error ?? "가져오기에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
    } catch {
      setImportError("연결 오류로 가져오기에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    setImportOpen(false);
    setImportText("");
    setImportError(null);
    router.refresh();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setImportText(text);
      setImportError(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-(--notion-fg)/60 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          title="추가한 채널 목록을 파일로 저장 (다른 기기에서 가져오기용)"
        >
          <Download size={12} />
          <span>내보내기</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setImportOpen(true);
            setImportError(null);
            setImportText("");
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-(--notion-fg)/60 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          title="다른 기기에서 내보낸 채널 목록 가져오기"
        >
          <Upload size={12} />
          <span>가져오기</span>
        </button>
      </div>

      <ModalTransition
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportError(null);
        }}
        overlayZ={100}
        panelZ={101}
        panelClassName="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-5 shadow-xl"
      >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            className="outline-none"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="import-title" className="text-base font-semibold text-(--notion-fg)">
                채널 목록 가져오기
              </h2>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-full p-1.5 text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-(--notion-fg)/65">
              다른 기기(컴퓨터·노트북)에서 <strong>내보내기</strong>한 JSON을 붙여넣거나 파일을 선택하세요. 기존 목록에 추가됩니다.
            </p>
            <label htmlFor="source-import-json" className="sr-only">
              소스 JSON 붙여넣기
            </label>
            <textarea
              id="source-import-json"
              name="importJson"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder='[{"id":"UC...","name":"채널명","type":"YouTube","category":"기타"}, ...]'
              rows={5}
              className="mb-2 w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm font-mono text-(--notion-fg) placeholder:text-(--notion-fg)/40 focus:border-(--notion-fg)/30 focus:outline-none"
            />
            <label htmlFor="source-import-file" className="sr-only">
              소스 JSON 파일 선택
            </label>
            <input
              id="source-import-file"
              name="importFile"
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-(--notion-border) px-3 py-1.5 text-xs font-medium text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover)"
              >
                파일 선택
              </button>
            </div>
            {importError && (
              <p className="mb-3 text-xs text-red-600 dark:text-red-400" role="alert">
                {importError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-lg border border-(--notion-border) px-3 py-1.5 text-sm font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                className="rounded-lg bg-(--focus-accent) px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
              >
                가져오기
              </button>
            </div>
          </div>
      </ModalTransition>
    </>
  );
}
