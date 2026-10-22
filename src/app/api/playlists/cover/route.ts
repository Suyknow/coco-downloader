import { NextRequest, NextResponse } from "next/server";
import { metadataHttp, PlaylistError } from "@/lib/playlists/shared";

const hosts = new Set(["p1.music.126.net", "p2.music.126.net", "p3.music.126.net", "p4.music.126.net", "p5.music.126.net", "p6.music.126.net", "y.gtimg.cn", "music-file.y.qq.com", "c1.kgimg.com", "imge.kugou.com", "imgessl.kugou.com"]);
function allowed(value: string) {
  const url = new URL(value);
  const officialCover = hosts.has(url.hostname) || /^p\d+\.music\.126\.net$/.test(url.hostname);
  if (url.protocol !== "https:" || !officialCover || url.port || url.username || url.password) throw new PlaylistError("不支持的封面地址", 400);
  return url;
}
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const value = request.nextUrl.searchParams.get("url");
    if (!value || value.length > 2048) throw new PlaylistError("缺少有效封面地址", 400);
    let url = allowed(value);
    for (let hop = 0; hop < 4; hop++) {
      const response = await metadataHttp.get<ArrayBuffer>(url.toString(), { responseType: "arraybuffer", signal: request.signal, headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: url.hostname.includes("qq.com") || url.hostname === "y.gtimg.cn" ? "https://y.qq.com/" : url.hostname.endsWith("126.net") ? "https://music.163.com/" : "https://www.kugou.com/" }, maxContentLength: 6 * 1024 * 1024, maxRedirects: 0, validateStatus: status => status === 200 || [301, 302, 307, 308].includes(status) });
      if (response.status !== 200) {
        if (!response.headers.location) break;
        url = allowed(new URL(response.headers.location, url).toString());
        continue;
      }
      // CDNs also use image/jpg or octet-stream. Recognize actual raster bytes.
      const bytes = Buffer.from(response.data);
      const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
        : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
        : /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString()) ? "image/gif"
        : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp"
        : bytes.subarray(4, 8).toString() === "ftyp" && /avif|avis/.test(bytes.subarray(8, 32).toString()) ? "image/avif" : "";
      if (!type) throw new PlaylistError("源站未返回可用图片");
      return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
    }
    throw new PlaylistError("封面跳转次数过多");
  } catch (error) {
    return NextResponse.json({ error: error instanceof PlaylistError ? error.message : "封面暂时无法加载" }, { status: error instanceof PlaylistError ? error.status : 502 });
  }
}
