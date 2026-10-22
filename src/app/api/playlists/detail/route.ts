import { NextRequest } from "next/server";
import { getDetail } from "@/lib/playlists/adapters";
import { kind, metadata, parameters, playlistId, respond } from "@/lib/playlists/api";
import { PlaylistError } from "@/lib/playlists/shared";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return respond(async () => {
    const { params, platform, offset, limit } = parameters(request);
    const type = kind(params.get("kind")), id = playlistId(params.get("id"), platform, type);
    if (platform === "kugou" && type === "chart" && offset % limit) throw new PlaylistError("酷狗榜单 offset 必须是 limit 的整数倍", 400);
    return metadata(JSON.stringify(["detail", platform, id, type, offset, limit]), () => getDetail(platform, id, type, offset, limit));
  });
}
