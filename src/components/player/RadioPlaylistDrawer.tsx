"use client";

import { useState } from "react";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";
import { X, Trash2 } from "lucide-react";
import { AutoAnimateList } from "@/components/ui/AutoAnimateList";
import { ModalTransition } from "@/components/ui/ModalTransition";

interface RadioPlaylistDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

export function RadioPlaylistDrawer({ drawerOpen, setDrawerOpen }: RadioPlaylistDrawerProps) {
  const radio = useRadioQueueOptional();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (!radio) return null;

  const handleSavePlaylist = async () => {
    if (!radio.queue.length || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/playlists/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: radio.queue,
          title: "라디오 플레이리스트",
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || data.error) {
        setSaveMessage(data.error ?? "플레이리스트 저장에 실패했습니다.");
      } else {
        setSaveMessage("플레이리스트가 Supabase에 저장되었습니다.");
        qaLog.radio.playlistSaved(radio.queue.length);
      }
    } catch {
      setSaveMessage("플레이리스트 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalTransition
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      overlayClassName="fixed inset-0 z-55 bg-(--notion-fg)/20"
      overlayZ={55}
      panelZ={56}
      variant="bottom"
      panelClassName="fixed bottom-16 left-4 right-4 max-h-[70vh] overflow-auto rounded-t-2xl border border-b-0 border-(--notion-border) bg-(--notion-bg) shadow-2xl md:left-auto md:right-6 md:max-w-md"
    >
      <div className="outline-none" role="dialog" aria-modal="true" aria-label="재생 대기열">
        <div className="sticky top-0 border-b border-(--notion-border) bg-(--notion-gray)">
          <div className="grid grid-cols-3 items-center gap-2 px-4 py-4">
            <div className="flex items-center justify-start">
              <button
                type="button"
                onClick={handleSavePlaylist}
                disabled={saving || radio.queue.length === 0}
                className="inline-flex items-center rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1.5 text-xs font-semibold text-(--notion-fg)/80 shadow-sm transition-colors hover:bg-(--notion-hover) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "저장 중…" : "플레이리스트 저장"}
              </button>
            </div>
            <h3 className="text-center text-lg font-semibold text-(--notion-fg)">재생 대기열</h3>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg) min-h-[44px] min-w-[44px] touch-manipulation"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          {saveMessage && (
            <p className="px-4 pb-2 text-[11px] text-(--notion-fg)/65" aria-live="polite">
              {saveMessage}
            </p>
          )}
        </div>
        <AutoAnimateList as="ul" className="divide-y divide-(--notion-border)">
          {radio.queue.map((item, index) => (
            <li
              key={`${item.videoId}-${index}`}
              className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${index === radio.currentIndex ? "bg-(--focus-accent-muted) border-l-2 border-(--focus-accent)" : "hover:bg-(--notion-gray)/50"}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm text-(--notion-fg)"
                onClick={() => {
                  radio.setCurrentIndex(index);
                  setDrawerOpen(false);
                }}
              >
                {item.title}
              </button>
              <button
                type="button"
                onClick={() => {
                  qaLog.radio.queueRemoved(index, item.videoId);
                  radio.removeFromQueue(index);
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-red-600 min-h-[44px] min-w-[44px] touch-manipulation"
                aria-label="목록에서 제거"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </AutoAnimateList>
      </div>
    </ModalTransition>
  );
}
