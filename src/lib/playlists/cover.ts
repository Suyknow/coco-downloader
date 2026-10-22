/** Route official artwork through the bounded same-origin cover proxy. */
export function playlistCoverUrl(url?: string) {
  return url ? `/api/playlists/cover?${new URLSearchParams({ url })}` : undefined;
}
