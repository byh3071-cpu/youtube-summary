import {
  RESOURCE_CATEGORIES,
  SUMMARY_TAGS,
  type ResourceCategory,
  type SectionAnalysis,
  type SummaryTag,
  type VideoAnalysis,
} from "../notion-section-analyzer";
import type { VideoDigest } from "./types";

/**
 * 캐시된 디제스트를 기존 노션 동기화가 쓰는 VideoAnalysis 형태로 변환.
 * (Step 7에서 notion-sync.ts의 analyzeVideoForNotion 호출을 대체 —
 *  노션 정리 시 LLM 재분석 제거 + 600줄 샘플링 손실 해소)
 */
export function digestToVideoAnalysis(digest: VideoDigest): VideoAnalysis {
  const category: ResourceCategory =
    digest.category && (RESOURCE_CATEGORIES as readonly string[]).includes(digest.category)
      ? (digest.category as ResourceCategory)
      : "일반";

  const tags: SummaryTag[] = (digest.tags ?? [])
    .filter((t): t is SummaryTag => (SUMMARY_TAGS as readonly string[]).includes(t))
    .slice(0, 4);

  const sections: SectionAnalysis[] = digest.sections.map((s) => {
    // 같은 구간(±90초)의 인용을 excerpt로 매칭, 없으면 첫 요점
    const quote = digest.quotes.find(
      (q) =>
        q.seconds !== undefined &&
        s.seconds !== undefined &&
        Math.abs(q.seconds - s.seconds) <= 90,
    );
    return {
      timestamp: s.timestamp,
      title: s.title,
      points: s.points,
      excerpt: quote?.text ?? s.points[0] ?? "",
    };
  });

  return {
    headline: digest.headline,
    category,
    tags,
    summary: digest.summary,
    sections:
      sections.length > 0
        ? sections
        : [{ timestamp: null, title: "전체", points: [], excerpt: "" }],
    openQuestions: digest.openQuestions,
  };
}
