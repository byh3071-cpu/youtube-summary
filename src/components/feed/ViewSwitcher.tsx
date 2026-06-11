"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Youtube, Rss, LayoutGrid } from "lucide-react";

export type ViewMode = "all" | "youtube" | "rss";

const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "전체(최신순)", icon: <LayoutGrid size={14} /> },
  { id: "youtube", label: "유튜브", icon: <Youtube size={14} className="text-red-500" /> },
  { id: "rss", label: "RSS", icon: <Rss size={14} className="text-blue-500" /> },
];

export default function ViewSwitcher({ currentView }: { currentView: ViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setView = (view: ViewMode) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (view === "all") params.delete("view");
    else params.set("view", view);
    const q = params.toString();
    const newUrl = q ? `${pathname}?${q}` : pathname;
    const currentUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (newUrl !== currentUrl) router.push(newUrl);
  };

  return (
    // 360px 등 좁은 화면에서 글자가 세로로 깨지지 않도록 가로 스크롤 허용
    <div className="flex min-w-0 items-center overflow-x-auto">
      <div className="flex shrink-0 rounded-lg border border-(--notion-border) p-0.5">
        {VIEWS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation sm:min-h-0 ${
              currentView === id
                ? "bg-(--notion-hover) text-(--notion-fg)"
                : "text-(--notion-fg)/60 hover:bg-(--notion-hover)/60 hover:text-(--notion-fg)"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
