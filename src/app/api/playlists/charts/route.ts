import { NextRequest } from "next/server";
import { getCharts } from "@/lib/playlists/adapters";
import { metadata, respond } from "@/lib/playlists/api";
import { platform } from "@/lib/playlists/shared";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return respond(async () => {
    const source = platform(request.nextUrl.searchParams.get("platform"));
    return metadata(`charts:${source}`, async () => ({ platform: source, items: await getCharts(source) }));
  });
}
