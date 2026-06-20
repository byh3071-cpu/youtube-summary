"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER = 400;

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      // 플로팅 스택(아래→위): 라디오 푸터(z-50, ~5rem) → Q&A 버튼(bottom 5.5rem, h-12) → 맨 위로(이 버튼).
      // Q&A 버튼 위로 띄워 우하단에서 같은 자리 겹침을 막는다(UX-20).
      className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-(--notion-border) bg-(--notion-bg) shadow-lg text-(--notion-fg)/70 hover:bg-(--notion-hover) hover:text-(--notion-fg) md:right-6"
      aria-label="맨 위로"
      title="맨 위로"
    >
      <ArrowUp size={18} />
    </button>
  );
}
