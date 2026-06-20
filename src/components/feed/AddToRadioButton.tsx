"use client";

import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { ThemeIcon } from "@/components/ui/ThemeIcon";

interface Props {
  videoId: string;
  title: string;
  /** 리얼 뷰 등에서 큰 버튼 스타일용 */
  className?: string;
}

export default function AddToRadioButton({ videoId, title, className }: Props) {
  const radio = useRadioQueueOptional();
  if (!radio) return null;

  const inQueue = radio.queue.some((q) => q.videoId === videoId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const summary =
      typeof window !== "undefined"
        ? localStorage.getItem(`summary_${videoId}`) ?? undefined
        : undefined;
    radio.addToQueue({ videoId, title, ...(summary ? { summary } : {}) });
  };

  const base =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-(--notion-border) bg-(--notion-gray)/50 font-medium text-(--notion-fg)/80 transition-colors hover:bg-(--notion-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--notion-fg)/20";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inQueue ? "이미 라디오 큐에 있음" : "라디오에 추가"}
      className={className ? `${base} ${className}` : `${base} px-2.5 py-1 text-[11px]`}
    >
      <ThemeIcon name="Play_the_radio" alt="라디오" size={22} />
      {/* 모바일 2열 카드에서는 아이콘만, 데스크톱·리얼뷰에서는 라벨까지 (UX-11/12) */}
      <span className={className ? "" : "hidden sm:inline"}>
        {inQueue ? "큐에 있음" : "라디오에 추가"}
      </span>
    </button>
  );
}
