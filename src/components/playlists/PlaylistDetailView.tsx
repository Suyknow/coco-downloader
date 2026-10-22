"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play, Download, ListChecks } from "lucide-react";
import type { PlaylistDetail, PlaylistSummary, PlaylistTrack } from "@/types/playlist";
import { playlistApi } from "@/lib/playlists/client";
import { notifyPlaylistError } from "./PlaylistCards";
import { usePlaylistResource } from "./usePlaylistResource";
import styles from "./discovery.module.css";
import type { MusicItem } from "@/types/music";
import { playlistMusicItem } from "@/lib/playlists/music-item";
import { SongList, SongListToolbar, SongActionButton, SongRowActions } from "../music/SongList";
import { PlaylistHeader } from "./PlaylistHeader";
import { SongBatchBar } from "../music/SongBatchBar";
import { NETEASE_QUALITY_OPTIONS } from "@/lib/music-quality";
export interface PlaylistPlayerProps {
  onPlay: (item: MusicItem, queue: MusicItem[]) => void;
  onDownload: (item: MusicItem) => void;
  onDownloadMany: (items: MusicItem[], quality?: string) => void;
  downloadingCount?: number;
  activeMusic?: MusicItem | null;
  playing?: boolean;
  resolvingId?: string | null;
}

export function PlaylistDetailView({ item, initial, onBack, backLabel = "返回发现歌单", ...player }: { item: PlaylistSummary; initial?: PlaylistDetail; onBack: () => void; backLabel?: string } & PlaylistPlayerProps) {
  const load = useCallback((signal: AbortSignal) => initial ? Promise.resolve(initial) : playlistApi.detail(item.platform, item.id, item.kind, 0, 30, signal), [initial, item]);
  const resource = usePlaylistResource(load, "playlist-detail");
  const [more, setMore] = useState<PlaylistTrack[]>([]);
  const [lastPage, setLastPage] = useState<PlaylistDetail | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const lock = useRef(false);
  const currentRequest = useRef<AbortController | null>(null);
  useEffect(() => () => currentRequest.current?.abort(), []);
  const data = resource.data;
  const info = data?.playlist ?? item;
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [batchQuality, setBatchQuality] = useState("default");
  const songs = useMemo(() => [...(data?.items ?? []), ...more].map(playlistMusicItem), [data, more]);
  const visible = songs.filter(song => `${song.title} ${song.artist} ${song.album || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const downloadItems = selection.size ? songs.filter(song => selection.has(song.id)) : visible;
  const toggle = (id: string) => setSelection(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelection(previous => { const next = new Set(previous), all = visible.every(song => next.has(song.id)); for (const song of visible) { if (all) next.delete(song.id); else next.add(song.id); } return next; });
  async function loadMore() {
    if (lock.current || !data) return;
    lock.current = true; setLoadingMore(true);
    const controller = new AbortController(); currentRequest.current = controller;
    try {
      const page = await playlistApi.detail(item.platform, item.id, item.kind, (lastPage ?? data).offset + (lastPage ?? data).limit, 30, controller.signal);
      if (!controller.signal.aborted) { setMore(previous => [...previous, ...page.items]); setLastPage(page); }
    } catch (error) { if (!controller.signal.aborted) notifyPlaylistError(error, "playlist-more"); }
    finally { if (!controller.signal.aborted) { lock.current = false; setLoadingMore(false); } }
  }
  function back() { currentRequest.current?.abort(); onBack(); }
  return <section className={styles.detail}>
    <button type="button" className={styles.back} onClick={back}><ArrowLeft size={16} />{backLabel}</button>
    <PlaylistHeader playlist={info}>
      <div className={styles.headerActions}>
        <SongActionButton primary disabled={!visible.length} onClick={() => player.onPlay(visible[0], visible)}><Play size={16} fill="currentColor" />{(lastPage ?? data)?.hasMore ? "播放当前列表" : "播放全部"}</SongActionButton>
        <SongActionButton disabled={!downloadItems.length || Boolean(player.downloadingCount)} onClick={() => player.onDownloadMany(downloadItems, selection.size ? batchQuality : undefined)}><Download size={16} />{selection.size ? `下载所选 ${selection.size} 首` : "下载当前列表"}</SongActionButton>
        <SongActionButton onClick={() => { setBatch(value => !value); setSelection(new Set()); }}><ListChecks size={16} />{batch ? "完成多选" : "批量选择"}</SongActionButton>
      </div>
    </PlaylistHeader>
    <SongListToolbar query={query} onQueryChange={setQuery}><span className={styles.songTab}>歌曲 <small>{info.trackCount || songs.length}</small></span>{selection.size > 0 && <span className={styles.selectedCount}>已选择 {selection.size} 首</span>}</SongListToolbar>
    {resource.error ? <div className={styles.status}>{resource.error}<button onClick={resource.retry}>重试</button></div> : resource.loading ? <div className={styles.status}><Loader2 size={18} className="animate-spin" />正在读取歌曲…</div> : <>
      <SongList items={visible} showIndex selectedIds={batch ? selection : undefined} onToggle={toggle} onToggleAll={toggleAll} activeMusic={player.activeMusic} playing={player.playing} resolvingId={player.resolvingId} onPlay={song => player.onPlay(song, visible)} renderActions={song => <SongRowActions item={song} selected={selection.has(song.id)} onToggleSelection={() => { setBatch(true); toggle(song.id); }} onPlay={() => player.onPlay(song, visible)} onDownload={() => player.onDownload(song)} playing={player.activeMusic?.id === song.id && player.activeMusic?.provider === song.provider && player.playing} resolving={player.resolvingId === song.id} />} emptyText={query ? "当前列表没有匹配的歌曲" : "此歌单暂未返回公开歌曲"} />
      {(lastPage ?? data)?.hasMore && <button className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>{loadingMore && <Loader2 size={15} className="animate-spin" />}{loadingMore ? "读取中…" : "加载更多歌曲"}</button>}
    </>}
    <SongBatchBar count={batch ? selection.size : 0} busy={player.downloadingCount} onDownload={() => player.onDownloadMany(songs.filter(song => selection.has(song.id)), batchQuality)} onClear={() => setSelection(new Set())} quality={batchQuality} onQualityChange={setBatchQuality} qualityOptions={[{ value: "default", label: "默认音质" }, ...(item.platform === "netease" ? NETEASE_QUALITY_OPTIONS.map(option => ({ value: option.value, label: option.label })) : [])]} />
  </section>;
}
