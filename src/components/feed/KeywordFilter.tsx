"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { storage } from "@/lib/storage";
import { AutoAnimateList } from "@/components/ui/AutoAnimateList";

function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ");
}

import type { FeedCategory } from "@/types/feed";
import { FEED_CATEGORIES } from "@/lib/sources";

export function useKeywordFilter() {
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    const syncFromStorage = () => {
      const prefs = storage.getPreferences();
      setKeywords(prefs.keywords);
    };

    syncFromStorage();

    if (typeof window !== "undefined") {
      window.addEventListener("focus-feed:preferences-updated", syncFromStorage);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus-feed:preferences-updated", syncFromStorage);
      }
    };
  }, []);

  const addKeyword = (newKeyword: string) => {
    const normalizedKeyword = normalizeKeyword(newKeyword);
    if (!normalizedKeyword) return;
    storage.addKeyword(normalizedKeyword);
    setKeywords(storage.getPreferences().keywords);
  };

  const removeKeyword = (keyword: string) => {
    storage.removeKeyword(keyword);
    setKeywords(storage.getPreferences().keywords);
  };

  const clearKeywords = () => {
    keywords.forEach((keyword) => storage.removeKeyword(keyword));
    setKeywords([]);
  };

  return { keywords, addKeyword, removeKeyword, clearKeywords };
}

interface KeywordFilterProps {
  keywords: string[];
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kw: string) => void;
  onClearKeywords: () => void;
  selectedCategory?: FeedCategory | null;
  onCategoryChange?: (category: FeedCategory | null) => void;
  /** 현재 피드에 실제 존재하는 카테고리만 전달. 없으면 전체 표시 */
  availableCategories?: FeedCategory[];
  /** 보기 전환(전체/유튜브/RSS)과 함께 표시할 때 설명·여백 축소 */
  compact?: boolean;
  /** 헤더 오른쪽에 추가로 표시할 컴포넌트 (예: 보기 전환 버튼) */
  headerRight?: ReactNode;
}

export default function KeywordFilter({
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onClearKeywords,
  selectedCategory,
  onCategoryChange,
  availableCategories,
  compact = false,
  headerRight,
}: KeywordFilterProps) {
  const displayCategories = availableCategories ?? FEED_CATEGORIES;
  const [isAdding, setIsAdding] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const hasActiveFilters = keywords.length > 0;
  const [collapsed, setCollapsed] = useState(true);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddKeyword(newKeyword);
    setNewKeyword("");
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setNewKeyword("");
    setIsAdding(false);
  };

  return (
    <section
      className={
        compact
          ? "mb-4 rounded-xl border border-(--notion-border) bg-(--notion-bg) px-3 pt-0 pb-1 sm:px-3.5"
          : // 소스 상세: 헤더 아래에 붙고, 그 아래 트렌드 레이더가 붙음
            "mb-0 rounded-b-none rounded-t-none border border-t-0 border-(--notion-border) bg-(--notion-bg) px-5 pt-0 pb-1 sm:px-7 mt-0"
      }
    >
      <div className={compact ? "mb-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1" : "mb-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"}>
        {compact ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h2 className="mb-0 shrink-0 text-sm font-semibold">
                필터
              </h2>
              {headerRight ? <div className="min-w-0 flex-1">{headerRight}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(prev => !prev)}
              aria-label={collapsed ? "필터 패널 열기" : "필터 패널 접기"}
              className="flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-(--notion-border) px-2.5 py-1 text-xs font-semibold text-(--notion-fg)/70 transition-colors touch-manipulation hover:bg-(--notion-hover) sm:min-h-0"
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              {collapsed ? "열기" : "접기"}
            </button>
          </>
        ) : (
          <div className="flex min-w-0 flex-col gap-2 sm:min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="mb-0 shrink-0 text-sm font-semibold">
                필터
              </h2>
              <div className="flex items-center gap-2">
                {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
                <button
                  type="button"
                  onClick={() => setCollapsed(prev => !prev)}
                  aria-label={collapsed ? "필터 패널 열기" : "필터 패널 접기"}
                  title={collapsed ? "필터 패널 열기" : "필터 패널 접기"}
                  className="flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-full border border-(--notion-border) px-2.5 py-1 font-semibold text-(--notion-fg)/70 transition-colors touch-manipulation hover:bg-(--notion-hover) sm:min-h-0"
                >
                  {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  <span>{collapsed ? "열기" : "접기"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!collapsed && onCategoryChange && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-(--notion-fg)/55">카테고리</span>
            <button
                type="button"
                onClick={() => onCategoryChange(null)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${!selectedCategory ? "border-(--notion-fg)/40 bg-(--notion-hover) text-(--notion-fg)" : "border-(--notion-border) text-(--notion-fg)/60 hover:bg-(--notion-hover)"}`}
            >
                전체
            </button>
            {displayCategories.map((cat) => (
                <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryChange(cat)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedCategory === cat ? "border-(--notion-fg)/40 bg-(--notion-hover) text-(--notion-fg)" : "border-(--notion-border) text-(--notion-fg)/60 hover:bg-(--notion-hover)"}`}
                >
                    {cat}
          </button>
        ))}
      </div>
      )}

      {!collapsed && (
      <AutoAnimateList className="flex flex-wrap items-center gap-2">
        {keywords.map(keyword => (
          <div
            key={keyword}
            className="flex items-center gap-1 rounded-full bg-(--notion-hover) px-2.5 py-1 text-xs font-semibold"
          >
            <span># {keyword}</span>
            <button
              type="button"
              onClick={() => onRemoveKeyword(keyword)}
              aria-label={`${keyword} 필터 제거`}
              className="rounded-full p-0.5 text-(--notion-fg)/40 hover:bg-(--notion-gray) hover:text-(--notion-fg)"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="flex flex-wrap items-center gap-2">
            <label htmlFor="keyword-filter-input" className="sr-only">
              관심 키워드 입력
            </label>
            <input
              id="keyword-filter-input"
              name="keyword"
              type="text"
              autoFocus
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  handleCancelAdd();
                }
              }}
              placeholder="관심 키워드를 입력하세요"
              aria-label="관심 키워드 입력"
              className="w-full sm:w-48 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1.5 text-sm font-medium focus:border-(--notion-fg)/30 focus:outline-none"
            />

            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full bg-(--notion-fg) px-3 py-1.5 text-xs font-semibold text-(--notion-bg) transition-opacity hover:opacity-90"
            >
              <Check size={12} />
              저장
            </button>

            <button
              type="button"
              onClick={handleCancelAdd}
              className="rounded-full border border-(--notion-border) px-3 py-1.5 text-xs font-semibold text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover)"
            >
              취소
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-(--notion-border) px-3 py-1.5 text-xs font-semibold text-(--notion-fg)/50 transition-colors hover:bg-(--notion-hover)"
          >
            <Plus size={12} />
            <span>키워드 추가</span>
          </button>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearKeywords}
            className="rounded-full px-2 py-1 text-xs font-semibold text-(--notion-fg)/45 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          >
            전체 해제
          </button>
        )}
      </AutoAnimateList>
      )}

      {!collapsed && !compact && (
        <div className="mt-3 space-y-1.5">
          {!hasActiveFilters && !isAdding && (
            <p className="text-xs leading-relaxed text-(--notion-fg)/45">
              예시: `AI`, `생산성`, `개발`, `자동화`
            </p>
          )}
          <p className="text-[11px] text-(--notion-fg)/40">
            키워드 필터는 이 기기·이 브라우저에만 저장됩니다.
          </p>
        </div>
      )}
    </section>
  );
}
