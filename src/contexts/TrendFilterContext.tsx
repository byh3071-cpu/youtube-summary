"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type TrendFilterContextValue = {
  selectedTrendKeyword: string | null;
  /** 선택된 트렌드의 대표 영상 제목들(정확 매칭용) */
  selectedTrendSamples: string[];
  setSelectedTrendKeyword: (keyword: string | null, samples?: string[]) => void;
  /** 클릭 시 선택(또는 같은 키워드면 해제) */
  toggleTrendKeyword: (keyword: string, samples?: string[]) => void;
};

const TrendFilterContext = createContext<TrendFilterContextValue | null>(null);

export function TrendFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<{ keyword: string | null; samples: string[] }>({
    keyword: null,
    samples: [],
  });

  const setSelectedTrendKeyword = useCallback((keyword: string | null, samples: string[] = []) => {
    setSelected({ keyword, samples: keyword ? samples : [] });
  }, []);

  const toggleTrendKeyword = useCallback((keyword: string, samples: string[] = []) => {
    setSelected((prev) =>
      prev.keyword === keyword ? { keyword: null, samples: [] } : { keyword, samples },
    );
  }, []);

  return (
    <TrendFilterContext.Provider
      value={{
        selectedTrendKeyword: selected.keyword,
        selectedTrendSamples: selected.samples,
        setSelectedTrendKeyword,
        toggleTrendKeyword,
      }}
    >
      {children}
    </TrendFilterContext.Provider>
  );
}

export function useTrendFilter(): TrendFilterContextValue | null {
  return useContext(TrendFilterContext);
}
