"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import MobileNavDrawer from "./MobileNavDrawer";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

export default function MobileHeaderWithNav({
  sourceStatus,
  selectedSourceId,
  selectedCategory,
  youtubeSources,
}: {
  sourceStatus: MergedFeedResult["sourceStatus"];
  selectedSourceId?: string;
  selectedCategory?: string;
  youtubeSources?: FeedSource[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-(--notion-border) bg-(--notion-bg)/92 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-(--notion-border) pl-1.5 pr-2.5 text-(--notion-fg)/70 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="메뉴 열기"
          >
            {/* 햄버거 아이콘으로 '메뉴'임을 명확히 한다(UX-32). 로고는 브랜드용으로 유지. */}
            <Menu size={20} className="shrink-0" aria-hidden />
            <Image
              src="/rogo.png"
              alt="Focus Feed"
              width={124}
              height={38}
              className="object-contain object-left"
              priority
            />
          </button>
          <div className="min-w-0 flex-1" aria-hidden />
          <div className="flex items-center gap-2">
            <LoginButton />
          </div>
        </div>
      </header>
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sourceStatus={sourceStatus}
        selectedSourceId={selectedSourceId}
        selectedCategory={selectedCategory}
        youtubeSources={youtubeSources}
      />
    </>
  );
}
