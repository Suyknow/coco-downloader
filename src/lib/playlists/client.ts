import type { PlaylistCategory, PlaylistDetail, PlaylistPage, PlaylistPlatform, PlaylistQuery, PlaylistSummary, PlaylistKind } from "@/types/playlist";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/playlists${path}`, { ...init, signal: init.signal ?? AbortSignal.timeout(45000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "歌单资料获取失败，请稍后重试");
  return data as T;
}
export const playlistApi = {
  charts: (platform: PlaylistPlatform, signal?: AbortSignal) => request<{ platform: PlaylistPlatform; items: PlaylistSummary[] }>(`/charts?platform=${platform}`, { signal }),
  categories: (platform: PlaylistPlatform, signal?: AbortSignal) => request<{ platform: PlaylistPlatform; items: PlaylistCategory[]; orders: string[] }>(`/categories?platform=${platform}`, { signal }),
  list: (platform: PlaylistPlatform, query: PlaylistQuery, signal?: AbortSignal) => request<PlaylistPage<PlaylistSummary>>(`?${new URLSearchParams({ platform, category: query.category, order: query.order, offset: String(query.offset), limit: String(query.limit) })}`, { signal }),
  detail: (platform: PlaylistPlatform, id: string, kind: PlaylistKind = "playlist", offset = 0, limit = 30, signal?: AbortSignal) => request<PlaylistDetail>(`/detail?${new URLSearchParams({ platform, id, kind, offset: String(offset), limit: String(limit) })}`, { signal }),
  import: (url: string, signal?: AbortSignal) => request<PlaylistDetail>("/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }), signal }),
};

// Preview requests share a small concurrency pool and short cache across all cards.
const previews = new Map<string, { expires: number; promise: Promise<PlaylistDetail> }>();
const waiting: Array<() => void> = [];
let active = 0;
function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active++;
      job().then(resolve, reject).finally(() => { active--; waiting.shift()?.(); });
    };
    if (active < 3) run(); else waiting.push(run);
  });
}
export function playlistPreview(item: PlaylistSummary): Promise<PlaylistDetail> {
  const key = `${item.platform}:${item.kind}:${item.id}`;
  const hit = previews.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise: Promise<PlaylistDetail> = schedule(() => playlistApi.detail(item.platform, item.id, item.kind, 0, 3)).catch(error => {
    if (previews.get(key)?.promise === promise) previews.delete(key);
    throw error;
  });
  if (previews.size >= 180) previews.delete(previews.keys().next().value!);
  previews.set(key, { expires: Date.now() + 120000, promise });
  return promise;
}
