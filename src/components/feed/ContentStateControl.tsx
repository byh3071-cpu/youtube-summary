"use client";

import { useEffect, useState } from "react";
import { ListPlus, ListChecks, EyeOff, Loader2 } from "lucide-react";
import { setContentStateAction } from "@/app/actions/content-state";
import {
  CONTENT_STATE_LABEL,
  type ContentState,
  type ContentSourceType,
} from "@/types/content-state";

interface Props {
  contentId: string;
  sourceId?: string | null;
  sourceType?: ContentSourceType | null;
  /** 현재 상태(없으면 inbox로 간주). */
  state?: ContentState;
  /** 변경 성공 후 부모가 상태 맵을 다시 로드하도록. */
  onChange?: () => void;
}

/**
 * 인박스 선별 컨트롤(스펙 Phase 1): 피드 카드에서 콘텐츠를 "큐에 추가" 또는
 * "관심없음(제외)"으로 분류한다. 그 외 진행 상태는 배지로 표시만 한다.
 */
export default function ContentStateControl({
  contentId,
  sourceId,
  sourceType,
  state,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<ContentState | undefined>(state);

  useEffect(() => {
    setOptimistic(state);
  }, [state]);

  const current: ContentState = optimistic ?? "inbox";

  async function change(next: ContentState) {
    if (busy) return;
    setBusy(true);
    const prev = optimistic;
    setOptimistic(next);
    try {
      const res = await setContentStateAction({
        contentId,
        nextState: next,
        sourceId,
        sourceType,
      });
      if ("error" in res) {
        setOptimistic(prev);
        alert(res.error);
      } else {
        onChange?.();
      }
    } catch {
      setOptimistic(prev);
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center">
        <Loader2 size={14} className="animate-spin text-(--notion-fg)/50" />
      </span>
    );
  }

  const isQueued = current === "queued";
  const isDismissed = current === "dismissed";
  // 큐·제외·새 항목이 아닌 진행 상태(소비/분석/검토 등)는 배지로만 보여준다.
  const isAdvanced = !isQueued && !isDismissed && current !== "inbox";

  if (isAdvanced) {
    return (
      <span className="inline-flex items-center rounded-full bg-(--notion-fg)/8 px-2 py-0.5 text-[10px] font-semibold text-(--notion-fg)/65">
        {CONTENT_STATE_LABEL[current]}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => void change(isQueued ? "inbox" : "queued")}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors touch-manipulation hover:bg-(--notion-hover) ${
          isQueued
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-(--notion-fg)/50 hover:text-(--notion-fg)/75"
        }`}
        aria-label={isQueued ? "처리 대기에서 빼기" : "처리 대기에 추가"}
        title={isQueued ? "처리 대기됨" : "처리 대기에 추가"}
      >
        {isQueued ? <ListChecks size={15} /> : <ListPlus size={15} />}
      </button>
      <button
        type="button"
        onClick={() => void change(isDismissed ? "inbox" : "dismissed")}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors touch-manipulation hover:bg-(--notion-hover) ${
          isDismissed
            ? "text-(--notion-fg)/70"
            : "text-(--notion-fg)/40 hover:text-(--notion-fg)/65"
        }`}
        aria-label={isDismissed ? "제외 취소" : "관심없음(제외)"}
        title={isDismissed ? "제외됨 · 되돌리기" : "관심없음"}
      >
        <EyeOff size={15} />
      </button>
    </div>
  );
}
