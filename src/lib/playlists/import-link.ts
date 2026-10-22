import type { PlaylistKind, PlaylistPlatform } from "@/types/playlist";
import { metadataHttp, PlaylistError } from "./shared";
import { playlistId } from "./api";

export interface ImportedPlaylist { platform: PlaylistPlatform; id: string; kind: PlaylistKind }
const hosts = new Set(["music.163.com", "y.music.163.com", "163cn.tv", "y.qq.com", "c.y.qq.com", "i.y.qq.com", "c6.y.qq.com", "www.kugou.com", "m.kugou.com", "t1.kugou.com"]);
function safeUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new PlaylistError("请输入完整的公开歌单链接", 400); }
  if (!["https:", "http:"].includes(url.protocol) || !hosts.has(url.hostname) || url.port || url.username || url.password) throw new PlaylistError("仅支持网易云、QQ音乐和酷狗的公开歌单链接", 400);
  url.protocol = "https:";
  return url;
}
function identify(original: URL): ImportedPlaylist | null {
  const url = original.hash.startsWith("#/") ? new URL(original.hash.slice(1), original.origin) : original;
  const params = url.searchParams;
  let platform: PlaylistPlatform, id = "", kind: PlaylistKind = "playlist";
  if (url.hostname.endsWith("music.163.com")) {
    platform = "netease";
    if (!/\/(playlist|discover\/toplist)(?:\/|$)/.test(url.pathname)) return null;
    id = params.get("id") || url.pathname.match(/\/playlist\/(\d+)/)?.[1] || "";
    kind = url.pathname.includes("toplist") ? "chart" : "playlist";
  } else if (url.hostname.endsWith("y.qq.com")) {
    platform = "qq";
    const match = url.pathname.match(/\/(playlist|playsquare|toplist)\/(\d+)(?:\.html)?/);
    id = params.get("disstid") || params.get("topid") || match?.[2] || "";
    kind = params.has("topid") || match?.[1] === "toplist" ? "chart" : "playlist";
    if (!id && /playlist|playsquare|diss|\/share\/details\/taoge\.html$/.test(url.pathname)) id = params.get("id") || "";
  } else {
    platform = "kugou";
    id = params.get("global_collection_id") || "";
    if (params.has("rankid")) { id = params.get("rankid")!; kind = "chart"; }
  }
  return id ? { platform, id: playlistId(id, platform, kind), kind } : null;
}

export async function resolvePlaylistLink(input: string): Promise<ImportedPlaylist> {
  if (input.length > 4096) throw new PlaylistError("歌单链接过长", 400);
  const extracted = input.match(/https?:\/\/[^\s<>"“”]+/)?.[0]?.replace(/[，。；）)]+$/, "");
  if (!extracted) throw new PlaylistError("请粘贴包含完整网址的歌单分享链接", 400);
  let url = safeUrl(extracted);
  for (let hop = 0; hop < 5; hop++) {
    const found = identify(url);
    if (found) return found;
    // Fetch only allowlisted share pages. Validate every redirect, including cross-host hops.
    const response = await metadataHttp.get<string>(url.toString(), { maxRedirects: 0, responseType: "text", maxContentLength: 1024 * 1024, validateStatus: status => status === 200 || [301, 302, 303, 307, 308].includes(status) });
    if (response.status !== 200) {
      if (!response.headers.location) break;
      url = safeUrl(new URL(response.headers.location, url).toString());
      continue;
    }
    if (url.hostname.endsWith("kugou.com")) {
      const id = response.data.match(/"global_collection_id"\s*:\s*"(collection_\d+_\d+_\d+_\d+)"/)?.[1];
      if (id) return { platform: "kugou", kind: "playlist", id };
    }
    break;
  }
  throw new PlaylistError("无法识别这条公开歌单链接，请复制平台网页中的歌单完整地址", 422);
}
