"use client";

import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { ThemeIcon } from "@/components/ui/ThemeIcon";

interface Props {
  videoId: string;
  title: string;
  /** 리얼 뷰 등에서 큰 버튼 스타일용 */
  className?: string;
  /** 그리드 카드 액션행에서 다른 아이콘 버튼과 크기를 맞춘 원형 아이콘 전용 모드 */
  iconOnly?: boolean;
}

export default function AddToRadioButton({ videoId, title, className, iconOnly }: Props) {
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

  const label = inQueue ? "이미 라디오 큐에 있음" : "라디오에 추가";

  // 아이콘 전용: 같은 행의 북마크·딥다이브·더보기와 동일한 36px 원형 (UX 일관성)
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors touch-manipulation hover:bg-(--notion-hover) before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] ${
          inQueue ? "text-(--focus-accent)" : "text-(--notion-fg)/60 hover:text-(--notion-fg)"
        }`}
      >
        <ThemeIcon name="Play_the_radio" alt="" size={20} />
      </button>
    );
  }

  const base =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-(--notion-border) bg-(--notion-gray)/50 font-medium text-(--notion-fg)/80 transition-colors hover:bg-(--notion-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--notion-fg)/20";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={className ? `${base} ${className}` : `${base} min-h-[40px] px-2.5 py-1.5 text-[11px]`}
    >
      <ThemeIcon name="Play_the_radio" alt="라디오" size={22} />
      {/* 데스크톱·리얼뷰에서는 라벨까지 (UX-11/12) */}
      <span className={className ? "" : "hidden sm:inline"}>
        {inQueue ? "큐에 있음" : "라디오에 추가"}
      </span>
    </button>
  );
}
