import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeaderWithNav from "@/components/layout/MobileHeaderWithNav";
import FloatingRadioPlayer from "@/components/player/FloatingRadioPlayer";
import CustomSourcesSync from "@/components/feed/CustomSourcesSync";
import ScrollToTop from "@/components/ui/ScrollToTop";
import AuthErrorBanner from "@/components/ui/AuthErrorBanner";
import AuthSuccessBanner from "@/components/ui/AuthSuccessBanner";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

interface LayoutProps {
    children: ReactNode;
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
    selectedCategory?: string;
    youtubeSources?: FeedSource[];
    customYouTubeSourceIds?: string[];
    latestVideoBySource?: Record<string, string>;
    authError?: string;
    authErrorHint?: string;
    authSuccess?: boolean;
    /** 롱폼/숏폼 리얼 뷰일 때 상단·좌우 여백 제거해 플레이어가 맨 위까지 꽉 차게 */
    reelMode?: boolean;
}

export default function AppLayout({ children, sourceStatus, selectedSourceId, selectedCategory, youtubeSources, customYouTubeSourceIds, latestVideoBySource, authError, authErrorHint, authSuccess, reelMode }: LayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-(--notion-bg) text-(--notion-fg)">
            <a
                href="#main"
                className="absolute left-4 top-4 z-[100] rounded-md bg-(--notion-fg) px-4 py-2 text-sm font-medium text-(--notion-bg) outline-none ring-2 ring-(--notion-fg) -translate-y-[200%] transition-transform focus:translate-y-0 focus:outline-none"
            >
                본문으로 건너뛰기
            </a>
            <div className={`w-full shrink-0 space-y-1.5 px-2 sm:px-4 md:px-6 ${reelMode ? "py-0" : "py-1.5"}`}>
                <AuthSuccessBanner authSuccess={authSuccess ?? false} />
                <AuthErrorBanner authError={authError} authErrorHint={authErrorHint} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col md:flex-row">
            <MobileHeaderWithNav
                sourceStatus={sourceStatus}
                selectedSourceId={selectedSourceId}
                selectedCategory={selectedCategory}
                youtubeSources={youtubeSources}
            />

            <Sidebar
                sourceStatus={sourceStatus}
                selectedSourceId={selectedSourceId}
                selectedCategory={selectedCategory}
                youtubeSources={youtubeSources}
                customYouTubeSourceIds={customYouTubeSourceIds}
                latestVideoBySource={latestVideoBySource}
            />

            <main
                id="main"
                tabIndex={-1}
                className={`min-w-0 flex-1 touch-pan-y overscroll-y-contain ${
                    reelMode ? "px-0 pt-0 pb-0" : "px-2 pt-2 pb-28 sm:px-4 sm:pt-4 sm:pb-32 md:px-6 lg:px-8"
                }`}
            >
                <div className={reelMode ? "w-full max-w-none" : "mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-none"}>
                    {children}
                </div>
            </main>

            <FloatingRadioPlayer />
            <CustomSourcesSync />
            <ScrollToTop />
            </div>
        </div>
    );
}
