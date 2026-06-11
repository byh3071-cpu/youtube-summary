"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { MessageCircle, X, Loader2, Trash2, Copy, ListTodo } from "lucide-react";
import { feedQAAction } from "@/app/actions/feed-qa";
import type { FeedQAHistoryTurn } from "@/app/actions/feed-qa";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";

type Props = {
  selectedSourceId?: string;
};

type ChatMessage = FeedQAHistoryTurn;

function storageKey(sourceId: string | undefined) {
  return `focus-feed:feed-qa:v1:${sourceId ?? "all"}`;
}

function buildMarkdownThread(messages: ChatMessage[]): string {
  const lines = ["# Focus Feed — 피드 Q&A", ""];
  let qIdx = 0;
  for (const m of messages) {
    if (m.role === "user") {
      qIdx += 1;
      lines.push(`## 질문 ${qIdx}`, "", m.content, "");
    } else {
      lines.push(`### 답변 ${qIdx}`, "", m.content, "");
    }
  }
  return lines.join("\n");
}

export default function FeedQADrawer({ selectedSourceId }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const key = useMemo(() => storageKey(selectedSourceId), [selectedSourceId]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned: ChatMessage[] = [];
      for (const row of parsed) {
        if (
          row &&
          typeof row === "object" &&
          (row as ChatMessage).role === "user" &&
          typeof (row as ChatMessage).content === "string"
        ) {
          cleaned.push({ role: "user", content: (row as ChatMessage).content.slice(0, 2000) });
        } else if (
          row &&
          typeof row === "object" &&
          (row as ChatMessage).role === "assistant" &&
          typeof (row as ChatMessage).content === "string"
        ) {
          cleaned.push({ role: "assistant", content: (row as ChatMessage).content.slice(0, 4000) });
        }
      }
      if (cleaned.length) queueMicrotask(() => setMessages(cleaned));
    } catch {
      /* ignore */
    }
  }, [key]);

  const persist = useCallback(
    (next: ChatMessage[]) => {
      setMessages(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* quota */
      }
    },
    [key],
  );

  const clearThread = () => {
    setErr("");
    setQ("");
    persist([]);
  };

  const copyThread = async () => {
    const md = buildMarkdownThread(messages);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      setErr("클립보드 복사에 실패했습니다.");
    }
  };

  const firstUserLine = messages.find((m) => m.role === "user")?.content?.trim() ?? "";

  const submit = () => {
    setErr("");
    const trimmed = q.trim();
    if (trimmed.length < 2) return;

    startTransition(async () => {
      const history: FeedQAHistoryTurn[] = messages;
      const res = await feedQAAction(trimmed, selectedSourceId ?? null, history);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      persist([
        ...messages,
        { role: "user", content: trimmed.slice(0, 500) },
        { role: "assistant", content: res.answer },
      ]);
      setQ("");
      window.dispatchEvent(new CustomEvent("focus-feed:usage-updated"));
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 데스크톱에서도 하단 라디오 푸터/안내(z-50, 높이 ~5rem)에 가리지 않도록 5.5rem 위에 띄운다.
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-(--notion-border) bg-(--notion-bg) text-(--notion-fg) shadow-lg transition hover:bg-(--notion-hover)"
        aria-label="피드 Q&A 열기"
      >
        <MessageCircle size={22} strokeWidth={2} />
      </button>

      {open ? (
        // 라디오 푸터(z-50)·재생목록 서랍(z-55/56)보다 위에 떠야 입력·전송 버튼이 가리지 않는다.
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-start sm:justify-end sm:p-4 sm:pt-24">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feed-qa-title"
            className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl border border-(--notion-border) bg-(--notion-bg) pb-[env(safe-area-inset-bottom,0px)] shadow-2xl sm:max-h-[min(36rem,calc(100vh-6rem))] sm:rounded-2xl sm:pb-0"
          >
            <div className="flex items-center justify-between border-b border-(--notion-border) px-4 py-3">
              <h2 id="feed-qa-title" className="text-sm font-semibold text-(--notion-fg)">
                피드 Q&A
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={clearThread}
                  className="rounded-lg p-1.5 text-(--notion-fg)/55 hover:bg-(--notion-hover)"
                  title="대화 지우기"
                  aria-label="대화 지우기"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => void copyThread()}
                  disabled={messages.length === 0}
                  className="rounded-lg p-1.5 text-(--notion-fg)/55 hover:bg-(--notion-hover) disabled:opacity-40"
                  title="마크다운으로 복사 (Notion 등)"
                  aria-label="마크다운으로 복사"
                >
                  <Copy size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-(--notion-fg)/55 hover:bg-(--notion-hover)"
                  aria-label="패널 닫기"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
              <p className="text-[12px] leading-relaxed text-(--notion-fg)/55">
                최근 피드(최대 50개)를 바탕으로 답합니다. 멀티턴은 브라우저에만 저장됩니다. 로그인·Free 플랜은 질문마다 일일 한도가 차감됩니다.
              </p>

              {messages.length > 0 ? (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-(--notion-border)/60 bg-(--notion-gray)/10 p-2 text-[12px]">
                  {messages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={`rounded-lg px-2 py-1.5 ${m.role === "user" ? "bg-(--notion-bg) text-(--notion-fg)/85" : "bg-(--notion-gray)/40 text-(--notion-fg)/75"}`}
                    >
                      <span className="font-semibold text-[10px] uppercase text-(--notion-fg)/45">
                        {m.role === "user" ? "질문" : "답변"}
                      </span>
                      <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <label className="text-[11px] font-medium text-(--notion-fg)/60" htmlFor="feed-qa-input">
                질문
              </label>
              <textarea
                id="feed-qa-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="예: 이번 주 피드에서 에이전트 관련 언급을 요약해 줘"
                className="w-full resize-none rounded-xl border border-(--notion-border) bg-(--notion-gray)/20 px-3 py-2 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/35"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || q.trim().length < 2}
                  onClick={submit}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-(--focus-accent) px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 min-[380px]:flex-none"
                >
                  {pending ? <Loader2 className="animate-spin" size={18} /> : null}
                  답변 받기
                </button>
                {firstUserLine ? (
                  <a
                    href={`https://todoist.com/add?content=${encodeURIComponent(firstUserLine.slice(0, 400))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-(--notion-border) px-3 py-2.5 text-xs font-semibold text-(--notion-fg)/75 hover:bg-(--notion-hover)"
                  >
                    <ListTodo size={16} />
                    Todoist에 첫 질문 추가
                  </a>
                ) : null}
              </div>
              {err ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-200/90">
                  {err}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
