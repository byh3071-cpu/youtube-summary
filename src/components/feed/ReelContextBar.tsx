"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MODE_LABEL: Record<"longform" | "shortform" | "live", string> = {
  longform: "롱폼",
  shortform: "숏폼",
  live: "라이브",
};

export default function ReelContextBar({
  viewMode,
}: {
  viewMode: "longform" | "shortform" | "live";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const exitHref = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("viewMode");
    const q = params.toString();
    const base = pathname && pathname.length > 0 ? pathname : "/";
    return q ? `${base}?${q}` : base;
  }, [pathname, searchParams]);

  return (
    <header
      role="region"
      aria-label={`${MODE_LABEL[viewMode]} 리얼 피드`}
      className="grid h-12 shrink-0 grid-cols-3 items-center gap-2 border-b border-(--notion-border) bg-(--notion-bg) px-3 sm:px-4"
    >
      <span className="min-w-0 truncate text-left text-xs font-semibold text-(--notion-fg)/70 sm:text-sm">
        Focus Feed
      </span>
      <span className="text-center text-xs font-semibold text-(--notion-fg) sm:text-sm">
        {MODE_LABEL[viewMode]}
      </span>
      <div className="flex justify-end">
        <Link
          href={exitHref}
          className="shrink-0 rounded-lg bg-(--focus-accent) px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 sm:px-3.5 sm:text-sm"
        >
          목록으로
        </Link>
      </div>
    </header>
  );
}
