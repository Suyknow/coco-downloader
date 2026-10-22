import type { MusicItem } from "@/types/music";
import type { PlaylistTrack } from "@/types/playlist";
import { NETEASE_QUALITY_OPTIONS } from "@/lib/music-quality";

export function playlistMusicItem(track: PlaylistTrack): MusicItem {
  const id = track.platform === "qq" ? track.identifiers.mid : track.platform === "kugou" ? track.identifiers.hash : track.identifiers.songId;
  const ms = track.durationMs;
  return {
    id: id || track.id, title: track.title, artist: track.artists.join(" / "), album: track.album, cover: track.cover,
    duration: ms ? `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}` : undefined,
    provider: track.platform,
    extra: { playlistPlatform: track.platform, cover: track.cover, metadataOnly: !id, filename: `${track.artists.join("、")} - ${track.title}`, duration: ms ? Math.floor(ms / 1000) : -1,
      ...(track.platform === "netease" ? { qualityOptions: NETEASE_QUALITY_OPTIONS, selectedLevel: "lossless", level: "lossless" } : {}),
    },
  };
}
