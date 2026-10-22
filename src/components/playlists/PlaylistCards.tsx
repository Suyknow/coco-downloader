"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { message } from "antd";
import type { PlaylistSummary } from "@/types/playlist";
import { playlistPreview } from "@/lib/playlists/client";
import { Artwork } from "../music/Artwork";
export { Artwork } from "../music/Artwork";
import styles from "./discovery.module.css";
import { RankIndicator } from "./RankIndicator";

export const platformNames = { netease: "网易云音乐", qq: "QQ音乐", kugou: "酷狗音乐" };
type Preview = NonNullable<PlaylistSummary["preview"]>;

function usePreview(item: PlaylistSummary, enabled: boolean) {
  const [preview, setPreview] = useState<Preview>(item.preview ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  useEffect(() => {
    if (!enabled || (item.preview?.length && item.preview.every(song => song.cover && song.trend && song.trend.type !== "unknown"))) return;
    let disposed = false;
    setStatus("loading");
    playlistPreview(item).then(data => {
      if (disposed) return;
      setPreview(data.items.map((song, index) => ({ title: song.title, artist: song.artists.join(" / "), cover: song.cover, trend: song.trend?.type !== "unknown" ? song.trend ?? item.preview?.[index]?.trend : item.preview?.[index]?.trend })));
      setStatus("ready");
    }).catch(() => { if (!disposed) setStatus("error"); });
    return () => { disposed = true; };
  }, [item, enabled]);
  return { preview, status };
}

export function ChartCard({ item, onOpen }: { item: PlaylistSummary; onOpen: (item: PlaylistSummary) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const { preview, status } = usePreview(item, visible);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "60px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const covers = [preview[0]?.cover || item.cover, preview[1]?.cover || item.cover, preview[2]?.cover || item.cover];
  return <button ref={ref} type="button" className={styles.chartCard} onClick={() => onOpen(item)} aria-label={`查看${platformNames[item.platform]}${item.name}`}>
    <span className={styles.chartCardHeader}><strong>{item.name}</strong><span>{item.updateFrequency || "查看榜单"}</span></span>
    <span className={styles.chartCardBody}>
      <span className={styles.coverStack}>{covers.map((cover, index) => <Artwork key={`${index}:${cover}`} url={cover} className={styles.stackedCover} />)}</span>
      <span className={styles.chartTracks}>
        {preview.length ? preview.slice(0, 3).map((song, index) => <span className={styles.chartTrack} key={`${index}:${song.title}`}><b>{index + 1}</b><span title={`${song.title} — ${song.artist}`}><strong>{song.title}</strong><span> — {song.artist}</span></span><RankIndicator trend={song.trend} /></span>) : status === "error" ? <span className={styles.previewHint}>曲目暂不可用，点击重试</span> : status === "ready" ? <span className={styles.previewHint}>暂无公开曲目</span> : [0, 1, 2].map(index => <span className={styles.chartTrack} key={index}><b>{index + 1}</b><span className={styles.skeletonLine} /><i>—</i></span>)}
      </span>
    </span>
  </button>;
}

function count(value?: number) {
  if (value === undefined) return "";
  return value >= 100000000 ? `${(value / 100000000).toFixed(1)}亿` : value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

export function PlaylistCard({ item, onOpen }: { item: PlaylistSummary; onOpen: (item: PlaylistSummary) => void }) {
  return <button type="button" className={styles.playlistCard} onClick={() => onOpen(item)} aria-label={`查看歌单：${item.name}`}>
    <span className={styles.playlistCoverFrame}>
      <Artwork url={item.cover} className={styles.playlistArt} />
      <span className={styles.coverAction} aria-hidden="true"><ArrowUpRight size={25} /></span>
    </span>
    <span className={styles.playlistTitle} title={item.name}>{item.name}</span>
    <span className={styles.playlistCreator} title={item.creator || platformNames[item.platform]}>{item.creator || platformNames[item.platform]}</span>
    {item.playCount !== undefined && <span className={styles.playCount}>播放量：{count(item.playCount)}</span>}
  </button>;
}

export function notifyPlaylistError(error: unknown, key: string) {
  if (error instanceof DOMException && error.name === "AbortError") return;
  void message.error({ key, content: error instanceof Error ? error.message : "歌单资料获取失败，请稍后重试" });
}
