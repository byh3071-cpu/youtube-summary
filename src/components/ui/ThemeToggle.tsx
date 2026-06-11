"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // useEffect only runs on the client, so now we can safely show the UI
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className={`flex items-center text-(--notion-fg)/70 hover:bg-(--notion-hover) rounded-lg transition-colors ${iconOnly ? 'p-2 justify-center min-h-[44px] min-w-[44px]' : 'w-full justify-between gap-2 text-sm p-1.5 min-h-[44px] sm:min-h-0 touch-manipulation'}`}
                aria-label="테마 전환"
            >
                <div className="flex items-center gap-2">
                    <Moon size={iconOnly ? 20 : 16} />
                    {!iconOnly && <span>테마</span>}
                </div>
            </button>
        ); // fallback
    }

    // "system" 테마에서도 실제 적용된 모드 기준으로 토글되도록 resolvedTheme 사용
    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`flex items-center text-(--notion-fg)/70 hover:bg-(--notion-hover) rounded-lg transition-colors ${iconOnly ? 'p-2 justify-center min-h-[44px] min-w-[44px] touch-manipulation' : 'w-full justify-between gap-2 text-sm p-1.5 min-h-[44px] sm:min-h-0 touch-manipulation'}`}
            aria-label="테마 전환"
        >
            <div className="flex items-center gap-2">
                {isDark ? <Sun size={iconOnly ? 20 : 16} /> : <Moon size={iconOnly ? 20 : 16} />}
                {!iconOnly && <span>{isDark ? "라이트 모드" : "다크 모드"}</span>}
            </div>
        </button>
    );
}
