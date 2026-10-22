import { NextRequest } from "next/server";
import { resolvePlaylistLink } from "@/lib/playlists/import-link";
import { getDetail } from "@/lib/playlists/adapters";
import { metadata, respond } from "@/lib/playlists/api";
import { PlaylistError, record } from "@/lib/playlists/shared";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return respond(async () => {
    // Read a bounded body even when a client omits Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new PlaylistError("请提供歌单链接", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); throw new PlaylistError("请求内容过长", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let body;
    try { body = record(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch { throw new PlaylistError("请求内容应为 JSON", 400); }
    if (typeof body.url !== "string" || !body.url.trim()) throw new PlaylistError("请提供歌单链接", 400);
    const { platform, id, kind } = await resolvePlaylistLink(body.url);
    return metadata(JSON.stringify(["detail", platform, id, kind, 0, 30]), () => getDetail(platform, id, kind, 0, 30));
  });
}
