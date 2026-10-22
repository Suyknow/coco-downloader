import { NextRequest } from "next/server";
import { getPlaylists } from "@/lib/playlists/adapters";
import { metadata, parameters, respond } from "@/lib/playlists/api";
import { PlaylistError } from "@/lib/playlists/shared";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return respond(async () => {
    const { params, platform, offset, limit } = parameters(request);
    const category = params.get("category") || "", order = params.get("order") || "hot";
    if (order !== "hot" && order !== "new") throw new PlaylistError("排序应为 hot 或 new", 400);
    if (category.length > 40 || (platform !== "netease" && category && !/^\d{1,10}$/.test(category))) throw new PlaylistError("请使用分类接口返回的分类 ID", 400);
    if (platform !== "netease" && offset % limit) throw new PlaylistError("该平台 offset 必须是 limit 的整数倍", 400);
    return metadata(JSON.stringify(["list", platform, category, order, offset, limit]), () => getPlaylists(platform, { category, order, offset, limit }));
  });
}
