"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useIsHydrated } from "@/lib/use-is-hydrated";

/** /images/icons/ 내 라이트·다크 버전이 있는 아이콘. 파일명 그대로 사용 (다크는 _dark 또는 __dark) */
const ICON_PATHS: Record<string, { light: string; dark: string }> = {
  Play_the_radio: { light: "/images/icons/Play_the_radio.png", dark: "/images/icons/Play_the_radio_dark.png" },
  Feed_List: { light: "/images/icons/Feed_List1.png", dark: "/images/icons/Feed_List_dark.png" },
  AI_summary: { light: "/images/icons/AI_summary1.png", dark: "/images/icons/AI_summary__dark.png" },
  Connect_Sync: { light: "/images/icons/Connect_Sync.png", dark: "/images/icons/Connect_Sync_dark.png" },
};

/** 단일 버전만 있는 아이콘 (라이트만 사용) */
const ICON_SINGLE: Record<string, string> = {
  a_briefing_summary: "/images/icons/a_briefing_summary.png",
  /** 라디오 플레이어 5개 (실제 파일명 기준) */
  close_player: "/images/icons/Close%20Player.png",
  watch_mini_video: "/images/icons/Watch%20mini-video.png",
  view_fullscreen: "/images/icons/View%20the%20full%20screen.png",
  feed_list1: "/images/icons/Feed_List1.png",
  ai_summary1: "/images/icons/AI_summary1.png",
};

export type ThemeIconName = keyof typeof ICON_PATHS | keyof typeof ICON_SINGLE;

interface ThemeIconProps {
  name: ThemeIconName;
  alt: string;
  size?: number;
  className?: string;
}

export function ThemeIcon({ name, alt, size = 24, className = "" }: ThemeIconProps) {
  const isHydrated = useIsHydrated();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const singleSrc = ICON_SINGLE[name as keyof typeof ICON_SINGLE];
  if (singleSrc) {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <Image src={singleSrc} alt={alt} width={size} height={size} className="object-contain" />
      </span>
    );
  }

  const paths = ICON_PATHS[name as keyof typeof ICON_PATHS];
  if (!paths) return null;

  const src = !isHydrated ? paths.light : isDark ? paths.dark : paths.light;

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <Image src={src} alt={alt} width={size} height={size} className="object-contain" />
    </span>
  );
}
