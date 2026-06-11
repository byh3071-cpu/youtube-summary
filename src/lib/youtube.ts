import { FeedItem } from "../types/feed";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const REVALIDATE_SECONDS = 7200;

/** 동일 경고를 중복 출력하지 않기 위한 Set */
const warnedKeys = new Set<string>();

function warnOnce(key: string, message: string) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

export type YouTubeFetchStatus = "ready" | "missing_api_key" | "invalid_api_key" | "request_failed";

export interface YouTubeFeedResult {
  items: FeedItem[];
  status: YouTubeFetchStatus;
}

interface YouTubePlaylistItem {
  id?: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    resourceId?: {
      videoId?: string;
    };
    thumbnails?: {
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
}

interface YouTubePlaylistResponse {
  items?: YouTubePlaylistItem[];
}

interface YouTubeVideoDetailsResponse {
  items?: Array<{
    id?: string;
    contentDetails?: {
      duration?: string;
    };
    snippet?: {
      liveBroadcastContent?: "live" | "upcoming" | "none";
    };
  }>;
}

interface YouTubeChannelResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      thumbnails?: YouTubeThumbnails;
    };
  }>;
}

interface YouTubeThumbnails {
  default?: { url?: string };
  medium?: { url?: string };
  high?: { url?: string };
}

/** 썸네일 목록에서 가장 큰 해상도를 우선 선택합니다 */
function pickBestThumbnail(thumbs?: YouTubeThumbnails): string | undefined {
  return thumbs?.medium?.url || thumbs?.high?.url || thumbs?.default?.url;
}

function hasUsableApiKey(apiKey: string | undefined): apiKey is string {
  if (!apiKey) {
    return false;
  }

  const normalizedApiKey = apiKey.trim();

  return normalizedApiKey !== "" && normalizedApiKey !== "your_youtube_api_key_here";
}

function logMissingApiKeyWarning() {
  warnOnce("missing_api_key", "YOUTUBE_API_KEY is missing or using the example placeholder. Skipping YouTube fetch.");
}

function logInvalidApiKeyWarning() {
  warnOnce("invalid_api_key", "YOUTUBE_API_KEY is invalid. Skipping YouTube sources until a valid key is configured.");
}

function logGenericYouTubeWarning(channelName: string, status: number) {
  warnOnce(`request_failed:${channelName}`, `YouTube feed request failed for ${channelName} with status ${status}.`);
}

/**
 * Google 오류 body가 키 만료·무효·API 미활성 같은 운영 설정 오류인지 판별.
 * 키 만료는 HTTP 400 `API key expired`로 내려오므로 상태 코드만으로 구분하면 안 된다.
 */
function isYouTubeConfigErrorBody(errorText: string): boolean {
  return (
    errorText.includes("API key expired") ||
    errorText.includes("API_KEY_INVALID") ||
    errorText.includes("API key not valid") ||
    errorText.includes("keyInvalid") ||
    errorText.includes("accessNotConfigured")
  );
}

// 주어진 Channel ID (UC...)를 Uploads Playlist ID (UU...)로 변환
export function getUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith("UC")) {
    return "UU" + channelId.substring(2);
  }
  // 이미 UU로 시작하거나 형식이 다를 경우 그대로 반환
  return channelId;
}

export function getYouTubeConfigurationStatus(): YouTubeFetchStatus {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) {
    return "missing_api_key";
  }

  return "ready";
}

function parseIsoDurationToSeconds(iso?: string): number | undefined {
  if (!iso) return undefined;
  // 예: PT8H6M45S, PT15M3S, PT45S
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return undefined;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export interface VideoDetailsMap {
  durationSeconds: Record<string, number>;
  isLive: Record<string, boolean>;
}

async function fetchVideoDetails(videoIds: string[]): Promise<VideoDetailsMap> {
  const empty = { durationSeconds: {}, isLive: {} };
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) return empty;
  if (videoIds.length === 0) return empty;

  const params = new URLSearchParams({
    part: "contentDetails,snippet",
    id: videoIds.join(","),
    key: YOUTUBE_API_KEY!,
  });

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as YouTubeVideoDetailsResponse;
    const durationSeconds: Record<string, number> = {};
    const isLive: Record<string, boolean> = {};
    for (const item of data.items ?? []) {
      const id = item.id;
      if (!id) continue;
      const durIso = item.contentDetails?.duration;
      const seconds = parseIsoDurationToSeconds(durIso);
      if (typeof seconds === "number" && seconds > 0) durationSeconds[id] = seconds;
      const lb = item.snippet?.liveBroadcastContent;
      isLive[id] = lb === "live" || lb === "upcoming";
    }
    return { durationSeconds, isLive };
  } catch {
    return empty;
  }
}

async function fetchChannelAvatar(channelId: string): Promise<string | undefined> {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) return undefined;

  const params = new URLSearchParams({
    part: "snippet",
    id: channelId,
    key: YOUTUBE_API_KEY!,
  });

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as YouTubeChannelResponse;
    return pickBestThumbnail(data.items?.[0]?.snippet?.thumbnails);
  } catch {
    return undefined;
  }
}

export async function fetchYouTubeFeed(channelId: string, channelName: string): Promise<YouTubeFeedResult> {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) {
    logMissingApiKeyWarning();
    return { items: [], status: "missing_api_key" };
  }

  const playlistId = getUploadsPlaylistId(channelId);
  const maxResults = 50; // 채널당 최대 50개 (API 상한), 이전 영상까지 더 많이 표시
  const searchParams = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: String(maxResults),
    key: YOUTUBE_API_KEY,
  });
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?${searchParams.toString()}`;

  try {
    // Next.js 15의 fetch 캐싱: { next: { revalidate: 7200 } } (2시간)
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS }
    });

    if (!response.ok) {
      const errorText = await response.text();
      // 채널마다 동일 오류가 반복 출력되지 않도록 warnOnce 사용
      warnOnce(
        `http_error:${channelName}:${response.status}`,
        `[YouTube] ${channelName} HTTP ${response.status}: ${errorText.slice(0, 400)}`,
      );

      if ((response.status === 400 || response.status === 403) && isYouTubeConfigErrorBody(errorText)) {
        if (errorText.includes("accessNotConfigured")) {
          warnOnce("api_not_enabled", "[YouTube] YouTube Data API v3가 활성화되지 않았습니다. console.cloud.google.com에서 활성화해 주세요.");
        } else {
          logInvalidApiKeyWarning();
        }
        return { items: [], status: "invalid_api_key" };
      }

      logGenericYouTubeWarning(channelName, response.status);
      return { items: [], status: "request_failed" };
    }

    const data = (await response.json()) as YouTubePlaylistResponse;
    
    if (!data.items) {
      return { items: [], status: "ready" };
    }

    const videoIds = data.items
      .map((item) => item.snippet?.resourceId?.videoId)
      .filter((id): id is string => !!id);

    const { durationSeconds: durationMap, isLive: liveMap } = await fetchVideoDetails(videoIds);
    const avatarUrl = await fetchChannelAvatar(channelId);

    // 결과를 공통 FeedItem 형식으로 매핑
    const items = data.items.flatMap((item) => {
      const snippet = item.snippet;

      if (!snippet?.title || !snippet.publishedAt) {
        return [];
      }

      const videoId = snippet.resourceId?.videoId;

      if (!videoId) {
        return [];
      }
      
      return [{
        id: videoId,
        title: snippet.title,
        link: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        pubDate: snippet.publishedAt,
        source: "YouTube",
        sourceId: channelId,
        sourceName: channelName,
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
        durationSeconds: durationMap[videoId],
        isLive: liveMap[videoId],
        sourceAvatarUrl: avatarUrl,
      } satisfies FeedItem];
    });

    return { items, status: "ready" };

  } catch (error) {
    warnOnce(`fetch_failed:${channelName}`, `Failed to fetch YouTube feed for ${channelName}.`);
    if (error) console.warn(error);

    return { items: [], status: "request_failed" };
  }
}

/** 채널 ID 또는 @핸들로 채널 정보 조회 (채널 추가 시 사용) */
export interface ResolvedChannel {
  channelId: string;
  channelName: string;
  avatarUrl?: string;
}

export async function resolveYouTubeChannel(parsed: { type: "channelId"; channelId: string } | { type: "handle"; handle: string }): Promise<ResolvedChannel | null> {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) {
    return null;
  }
  const params = new URLSearchParams({
    part: "snippet",
    key: YOUTUBE_API_KEY,
  });
  if (parsed.type === "channelId") {
    params.set("id", parsed.channelId);
  } else {
    params.set("forHandle", parsed.handle.startsWith("@") ? parsed.handle : `@${parsed.handle}`);
  }
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`, {
      // 채널명·아바타는 거의 안 바뀌므로 24시간 캐시 — 페이지 SSR 시 아바타 해석 비용 절감
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          thumbnails?: {
            default?: { url?: string };
            medium?: { url?: string };
            high?: { url?: string };
          };
        };
      }>;
    };
    const channel = data.items?.[0];
    if (!channel?.id || !channel.snippet?.title) return null;
    const thumb = pickBestThumbnail(channel.snippet.thumbnails);
    return {
      channelId: channel.id,
      channelName: channel.snippet.title,
      avatarUrl: thumb,
    };
  } catch {
    return null;
  }
}

/** 단일 영상의 제목·설명 조회 (요약 폴백용). 자막이 없을 때 사용 */
export interface VideoSnippet {
  title: string;
  description: string;
}

export async function getVideoSnippet(videoId: string): Promise<VideoSnippet | null> {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) {
    return null;
  }
  const params = new URLSearchParams({
    part: "snippet",
    id: videoId,
    key: YOUTUBE_API_KEY,
  });
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: Array<{ snippet?: { title?: string; description?: string } }> };
    const snippet = data.items?.[0]?.snippet;
    if (!snippet?.title) return null;
    return {
      title: snippet.title,
      description: snippet.description ?? "",
    };
  } catch {
    return null;
  }
}
