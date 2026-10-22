import { NextRequest } from "next/server";
import { getCategories } from "@/lib/playlists/adapters";
import { metadata, respond } from "@/lib/playlists/api";
import { platform } from "@/lib/playlists/shared";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return respond(async () => {
    const source = platform(request.nextUrl.searchParams.get("platform"));
    return metadata(`categories:${source}`, async () => ({ platform: source, items: await getCategories(source), orders: source === "qq" ? ["hot"] : ["hot", "new"] }));
  });
}
