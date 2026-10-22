export type PlaylistPlatform = "netease" | "qq" | "kugou";
export type PlaylistKind = "playlist" | "chart";
export interface RankTrend { type: "up" | "down" | "new" | "same" | "heat" | "unknown"; value?: number }

export interface PlaylistSummary {
  id: string;
  platform: PlaylistPlatform;
  kind: PlaylistKind;
  name: string;
  cover?: string;
  description?: string;
  creator?: string;
  trackCount?: number;
  playCount?: number;
  updateFrequency?: string;
  tags?: string[];
  createdAt?: number;
  preview?: Array<{ title: string; artist: string; cover?: string; trend?: RankTrend }>;
}

// Metadata identities are platform-specific; they are not audio resolver IDs.
export interface PlaylistTrack {
  id: string;
  platform: PlaylistPlatform;
  title: string;
  artists: string[];
  album?: string;
  cover?: string;
  durationMs?: number;
  trend?: RankTrend;
  identifiers: { songId?: string; mid?: string; hash?: string; albumId?: string };
}

export interface PlaylistCategory { id: string; name: string; group: string }
export interface PlaylistPage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  totalKnown?: boolean;
}
export interface PlaylistDetail extends PlaylistPage<PlaylistTrack> { playlist: PlaylistSummary }
export interface PlaylistQuery { category: string; order: "hot" | "new"; offset: number; limit: number }
