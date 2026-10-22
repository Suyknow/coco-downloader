import type { ReactNode } from "react";
import type { PlaylistSummary } from "@/types/playlist";
import { Artwork, platformNames } from "./PlaylistCards";
import styles from "./discovery.module.css";

export function PlaylistHeader({ playlist, children }: { playlist: PlaylistSummary; children?: ReactNode }) {
  const created = playlist.createdAt ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(playlist.createdAt) : "";
  return <header className={styles.playlistHeader}>
    <Artwork key={playlist.cover} url={playlist.cover} className={styles.headerCover} />
    <div className={styles.headerContent}><span className={styles.eyebrow}>{platformNames[playlist.platform]} · {playlist.kind === "chart" ? "排行榜" : "歌单"}</span><h1>{playlist.name}</h1>
      {playlist.description && <p className={styles.headerDescription}>{playlist.description.replace(/<[^>]+>/g, "")}</p>}
      <div className={styles.headerMeta}>{playlist.creator && <span>{playlist.creator}</span>}{playlist.tags?.length ? <span>标签：{playlist.tags.join(" / ")}</span> : null}{created && <span>{created} 创建</span>}{playlist.trackCount ? <span>{playlist.trackCount} 首</span> : null}{playlist.playCount ? <span>{playlist.playCount.toLocaleString("zh-CN")} 次播放</span> : null}</div>
      {children}
    </div>
  </header>;
}
