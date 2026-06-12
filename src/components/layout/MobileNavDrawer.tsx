"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { X, Bookmark, ListMusic, Film, Clapperboard, Radio, TrendingUp } from "lucide-react";
import { ModalTransition } from "@/components/ui/ModalTransition";
import { LoginButton } from "@/components/auth/LoginButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { defaultSources, FEED_CATEGORIES } from "@/lib/sources";
import AddChannelButton from "@/components/feed/AddChannelButton";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

const rssSources = defaultSources.filter((s) => s.type === "RSS");
const youtubeStatusLabel = {
  ready: "정상 연결",
  missing_api_key: "키 필요",
  invalid_api_key: "연동 설정 오류",
  request_failed: "일시 장애",
} as const;
const youtubeStatusTone = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
} as const;

export default function MobileNavDrawer({
  open,
  onClose,
  sourceStatus,
  selectedSourceId,
  selectedCategory,
  youtubeSources,
}: {
  open: boolean;
  onClose: () => void;
  sourceStatus: MergedFeedResult["sourceStatus"];
  selectedSourceId?: string;
  selectedCategory?: string;
  youtubeSources?: FeedSource[];
}) {
  const ytSources = youtubeSources ?? defaultSources.filter((s) => s.type === "YouTube");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const viewMode = searchParams?.get("viewMode") ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const linkTo = (source?: string, category?: string) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (category) params.set("category", category);
    const q = params.toString();
    return q ? `/?${q}` : "/";
  };

  return (
    <ModalTransition
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-40 bg-(--notion-fg)/30 md:hidden"
      overlayZ={40}
      panelZ={50}
      variant="left"
      panelClassName="fixed inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto overflow-x-hidden overscroll-contain bg-white dark:bg-(--notion-bg) md:hidden"
    >
      <aside className="outline-none pb-32 md:pb-0" role="dialog" aria-modal="true" aria-label="메뉴">
        <div className="border-b border-(--notion-border) px-4 pt-6 pb-4">
          <div className="relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg) min-h-[44px] min-w-[44px] touch-manipulation"
              aria-label="메뉴 닫기"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-start gap-3 w-full">
              <div className="relative h-14 w-[180px] shrink-0 overflow-hidden rounded-lg">
                <Image
                  src="/rogo.png"
                  alt="Focus Feed"
                  fill
                  sizes="180px"
                  className="object-contain object-left"
                  priority
                />
              </div>
              <Link
                href="/trends"
                onClick={onClose}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === "/trends" ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
              >
                <TrendingUp size={16} className="shrink-0" />
                트렌드 대시보드
              </Link>
              <Link
                href="/"
                onClick={onClose}
                className={`block w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === "/" && !selectedSourceId && !selectedCategory && !viewMode ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
              >
                전체 피드
              </Link>
              <div className="flex items-center justify-center gap-2 pt-1 w-full">
                <LoginButton />
              </div>
              <div className="w-full rounded-lg border border-(--notion-border)/60">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
        <nav className="space-y-5 p-4">
          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              피드 보기
            </p>
            <div className="flex gap-1.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              <Link
                href="/?viewMode=longform"
                onClick={onClose}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm ${viewMode === "longform" ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
              >
                <Film size={16} className="shrink-0" />
                롱폼
              </Link>
              <Link
                href="/?viewMode=shortform"
                onClick={onClose}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm ${viewMode === "shortform" ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
              >
                <Clapperboard size={16} className="shrink-0" />
                숏폼
              </Link>
            </div>
            <div className="flex justify-center pt-1">
              <Link
                href="/?viewMode=live"
                onClick={onClose}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${viewMode === "live" ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
              >
                <Radio size={16} className="shrink-0" />
                라이브
              </Link>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              카테고리
            </p>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              <Link
                href="/"
                onClick={onClose}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${!selectedCategory ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
              >
                전체
              </Link>
              {FEED_CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={linkTo(undefined, cat)}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${selectedCategory === cat ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
                YouTube ({ytSources.length})
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${youtubeStatusTone[sourceStatus.youtube]}`}>
                {youtubeStatusLabel[sourceStatus.youtube]}
              </span>
            </div>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              {ytSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${selectedSourceId === item.id ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
              <div className="pt-1">
                <AddChannelButton />
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              내 콘텐츠
            </p>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              <Link href="/playlists" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-(--notion-fg)/85 hover:bg-(--notion-hover)">
                <ListMusic size={18} className="shrink-0 text-(--notion-fg)/70" />
                내 플레이리스트
              </Link>
              <Link href="/bookmarks" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-(--notion-fg)/85 hover:bg-(--notion-hover)">
                <Bookmark size={18} className="shrink-0 text-(--notion-fg)/70" />
                북마크
              </Link>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              RSS ({rssSources.length})
            </p>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              {rssSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${selectedSourceId === item.id ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
            </div>
          </section>
        </nav>
      </aside>
    </ModalTransition>
  );
}
