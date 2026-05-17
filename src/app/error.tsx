"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-(--notion-fg)">문제가 발생했습니다</h1>
      <p className="mt-3 text-sm text-(--notion-fg)/60">
        {error.message || "일시적인 오류입니다. 잠시 후 다시 시도해 주세요."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-full border border-(--notion-border) bg-(--notion-bg) px-5 py-2.5 text-sm font-semibold text-(--notion-fg) transition-colors hover:bg-(--notion-hover)"
      >
        다시 시도
      </button>
    </div>
  );
}
