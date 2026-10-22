import { NextRequest, NextResponse } from "next/server";
import { providerErrorMessage } from "@/lib/api-error";
import type { PlaylistKind, PlaylistPlatform } from "@/types/playlist";
import { cached, platform, PlaylistError } from "./shared";

export function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!value.trim() || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new PlaylistError("分页参数超出允许范围", 400);
  return parsed;
}
export function parameters(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return { params, platform: platform(params.get("platform")), offset: integer(params.get("offset"), 0, 0, 100000), limit: integer(params.get("limit"), 30, 1, 100) };
}
export function kind(value: string | null): PlaylistKind {
  if (value === null || value === "playlist") return "playlist";
  if (value === "chart") return "chart";
  throw new PlaylistError("内容类型应为 playlist 或 chart", 400);
}
export function playlistId(value: string | null, platform: PlaylistPlatform, kind: PlaylistKind) {
  if (!value || value.length > 100) throw new PlaylistError("缺少有效歌单 ID", 400);
  const valid = platform === "kugou" && kind === "playlist" ? /^(?:collection_\d+_\d+_\d+_\d+|[1-9]\d{0,19})$/ : /^[1-9]\d{0,19}$/;
  if (!valid.test(value)) throw new PlaylistError("歌单 ID 格式不正确", 400);
  if (platform === "qq" && !Number.isSafeInteger(Number(value))) throw new PlaylistError("歌单 ID 超出支持范围", 400);
  return value;
}
export async function respond(fetcher: () => Promise<unknown>) {
  try { return NextResponse.json(await fetcher(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof PlaylistError ? error.message : providerErrorMessage(error) }, { status: error instanceof PlaylistError ? error.status : 502 });
  }
}
export function metadata(key: string, fetcher: () => Promise<unknown>) { return cached(`playlist:${key}`, fetcher); }
