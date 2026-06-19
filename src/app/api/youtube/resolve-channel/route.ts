import { NextResponse } from "next/server";
import { parseYouTubeChannelInput } from "@/lib/youtube-channel-parse";
import { resolveYouTubeChannel } from "@/lib/youtube";
import { takeToken } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  // 비용 보호: 익명 호출이 YouTube API 쿼터를 소진하지 않도록 IP 기준 레이트리밋.
  const ip = getClientIp(request);
  const rl = takeToken(`resolve-channel:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해 주세요.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = (await request.json()) as { input?: string };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) {
      return NextResponse.json({ error: "input 필요" }, { status: 400 });
    }

    const parsed = parseYouTubeChannelInput(input);
    if (!parsed) {
      return NextResponse.json(
        { error: "채널 URL 또는 ID를 입력해 주세요. 예: youtube.com/@조코딩 또는 UC..." },
        { status: 400 }
      );
    }

    const resolved = await resolveYouTubeChannel(parsed);
    if (!resolved) {
      return NextResponse.json(
        { error: "채널을 찾을 수 없습니다. URL·핸들·채널 ID를 확인해 주세요." },
        { status: 404 }
      );
    }

    return NextResponse.json(resolved);
  } catch {
    return NextResponse.json({ error: "처리 중 오류" }, { status: 500 });
  }
}
