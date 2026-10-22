import axios from "axios";
import type { PlaylistPage, PlaylistPlatform } from "@/types/playlist";

export type Raw = Record<string, unknown>;
export const record = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
export const rows = (value: unknown): Raw[] => Array.isArray(value) ? value.map(record) : [];
export const text = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value) : "";
export const number = (value: unknown): number => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function image(value: unknown) {
  const url = text(value).replace(/^http:/, "https:").replace(/\{size\}/g, "400");
  return /^https:\/\//.test(url) ? url : undefined;
}
export function page<T>(items: T[], total: number, offset: number, limit: number, more?: boolean): PlaylistPage<T> {
  return { items, total, offset, limit, hasMore: more ?? offset + items.length < total };
}
export class PlaylistError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export const metadataHttp = axios.create({ timeout: 12000, maxRedirects: 3, maxContentLength: 12 * 1024 * 1024, headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
export function platform(value: string | null): PlaylistPlatform {
  if (value === "netease" || value === "qq" || value === "kugou") return value;
  throw new PlaylistError("请选择网易云、QQ音乐或酷狗音乐", 400);
}

// Bound cache growth and collapse concurrent metadata requests. Never cache failures.
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
export function cached<T>(key: string, fetcher: () => Promise<T>, ttl = 120000): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  const value: Promise<T> = fetcher().catch(error => { if (cache.get(key)?.value === value) cache.delete(key); throw error; });
  cache.set(key, { expires: Date.now() + ttl, value });
  return value;
}
