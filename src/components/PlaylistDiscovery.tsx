"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, ListMusic, ChartNoAxesColumnIncreasing } from "lucide-react";
import type { PlaylistPage, PlaylistPlatform, PlaylistSummary } from "@/types/playlist";
import { playlistApi } from "@/lib/playlists/client";
import { useDiscoveryMode } from "./DiscoveryMode";
import { SegmentedControl } from "./SegmentedControl";
import FilterRow, { type TemplateFilter } from "./playlists/FilterRow";
import { ChartCard, PlaylistCard, notifyPlaylistError, platformNames } from "./playlists/PlaylistCards";
import { PlaylistDetailView } from "./playlists/PlaylistDetailView";
import { usePlaylistResource } from "./playlists/usePlaylistResource";
import styles from "./playlists/discovery.module.css";
import { SelectMenu } from "./SelectMenu";
import type { PlaylistPlayerProps } from "./playlists/PlaylistDetailView";

const platforms: PlaylistPlatform[] = ["netease", "qq", "kugou"];
const platformFilter: TemplateFilter = { id: "platform", label: "平台", allowAll: false, options: platforms.map(id => ({ id, label: platformNames[id] })) };

function ChartSection({ platform, onPlatformChange, onOpen }: { platform: PlaylistPlatform; onPlatformChange: (platform: PlaylistPlatform) => void; onOpen: (item: PlaylistSummary) => void }) {
  const load = useCallback((signal: AbortSignal) => playlistApi.charts(platform, signal), [platform]);
  const { data, loading, error, retry } = usePlaylistResource(load, `charts-${platform}`);
  const [expanded, setExpanded] = useState(false);
  const items = data?.items.filter((item, index, list) => list.findIndex(other => other.id === item.id) === index) ?? [];
  return <section className={styles.chartSection}>
    <div className={styles.sectionHeading}>
      <h2>排行榜</h2>
      <div className={styles.chartControls}>
        <div className={styles.platformSelect}><span>平台</span><SelectMenu label="排行榜平台" value={platform} onChange={value => onPlatformChange(value as PlaylistPlatform)} options={platforms.map(source => ({ value: source, label: platformNames[source] }))} /></div>
        {items.length > 6 && <button type="button" className={styles.textButton} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "收起榜单" : `全部 ${items.length} 个榜单`}<ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : undefined }} /></button>}
      </div>
    </div>
    {error ? <div className={styles.status}>{error}<button onClick={retry}>重试</button></div> : <div className={styles.chartGrid}>
      {loading ? [0, 1, 2, 3, 4, 5].map(index => <div className={`${styles.chartCard} ${styles.skeletonCard}`} key={index}><span className={styles.skeletonLine} /><span className={styles.skeletonChart} /></div>) : (expanded ? items : items.slice(0, 6)).map(item => <ChartCard key={item.id} item={item} onOpen={onOpen} />)}
    </div>}
    {!loading && !error && !items.length && <p className={styles.status}>此平台暂未返回榜单</p>}
  </section>;
}

function PlaylistResults({ platform, category, order, onOpen }: { platform: PlaylistPlatform; category: string; order: "hot" | "new"; onOpen: (item: PlaylistSummary) => void }) {
  const load = useCallback((signal: AbortSignal) => playlistApi.list(platform, { category, order, offset: 0, limit: 15 }, signal), [platform, category, order]);
  const { data, loading, error, retry } = usePlaylistResource(load, "playlist-list");
  const [extra, setExtra] = useState<PlaylistSummary[]>([]);
  const [lastPage, setLastPage] = useState<PlaylistPage<PlaylistSummary> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const items = [...(data?.items ?? []), ...extra].filter((item, index, list) => list.findIndex(other => other.id === item.id) === index);
  async function loadMore() {
    if (lock.current || !data) return;
    lock.current = true; setLoadingMore(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await playlistApi.list(platform, { category, order, offset: (lastPage ?? data).offset + 15, limit: 15 }, controller.signal);
      if (!controller.signal.aborted) { setExtra(previous => [...previous, ...result.items]); setLastPage(result); }
    } catch (error) { if (!controller.signal.aborted) notifyPlaylistError(error, "playlist-list-more"); }
    finally { if (!controller.signal.aborted) { lock.current = false; setLoadingMore(false); } }
  }
  return <div aria-busy={loading}>
    <div className={styles.resultBar}><span>{category ? "分类精选" : "精选歌单"}</span><span>{loading ? "正在读取…" : error ? "读取失败" : `已显示 ${items.length} 张歌单`}</span></div>
    {error ? <div className={styles.status}>{error}<button onClick={retry}>重新读取</button></div> : <div className={styles.playlistGrid}>
      {loading ? Array.from({ length: 10 }, (_, index) => <div className={styles.skeletonPlaylist} key={index}><span className={styles.skeletonLine} /></div>) : items.map(item => <PlaylistCard key={`${item.platform}:${item.id}`} item={item} onOpen={onOpen} />)}
    </div>}
    {!loading && !error && !items.length && <p className={styles.status}>该分类暂未返回歌单，请尝试其他分类。</p>}
    {(lastPage ?? data)?.hasMore && !error && <button className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>{loadingMore && <Loader2 size={15} className="animate-spin" />}{loadingMore ? "正在读取…" : "加载更多歌单"}</button>}
  </div>;
}

function PlaylistBrowseSection({ onOpen }: { onOpen: (item: PlaylistSummary) => void }) {
  const [platform, setPlatform] = useState<PlaylistPlatform>("netease");
  const [category, setCategory] = useState({ group: "", id: "" });
  const [order, setOrder] = useState<"hot" | "new">("hot");
  const loadCategories = useCallback((signal: AbortSignal) => playlistApi.categories(platform, signal), [platform]);
  const categories = usePlaylistResource(loadCategories, "playlist-categories");
  const groups = useMemo<TemplateFilter[]>(() => {
    const map = new Map<string, TemplateFilter>();
    for (const item of categories.data?.items ?? []) {
      if (item.name === "全部" || item.name === "全部歌单") continue;
      const name = item.group || "分类";
      const group: TemplateFilter = map.get(name) ?? { id: `${platform}-${name}`, label: name, options: [] };
      if (!group.options.some(option => option.id === item.id)) group.options.push({ id: item.id, label: item.name });
      map.set(name, group);
    }
    return [...map.values()];
  }, [platform, categories.data]);
  return <section className={styles.playlists}>
    <div className={styles.sectionHeading}><h2>发现更多歌单</h2><span className={styles.sectionHint}>按平台和分类，找到喜欢的声音</span></div>
    <div className={styles.filters}>
      <FilterRow group={platformFilter} value={platform} onChange={value => { setPlatform(value as PlaylistPlatform); setCategory({ group: "", id: "" }); setOrder("hot"); }} />
      {categories.loading ? <div className={styles.filterLoading}><Loader2 size={13} className="animate-spin" />正在读取平台分类…</div> : categories.error ? <div className={styles.filterLoading}>{categories.error}<button onClick={categories.retry}>重试</button></div> : groups.map(group => <FilterRow key={group.id} group={group} value={category.group === group.id ? category.id : ""} onChange={id => setCategory({ group: group.id, id })} />)}
      <FilterRow group={{ id: "playlist-order", label: "排序", allowAll: false, options: [{ id: "hot", label: "热门" }, ...(categories.data?.orders.includes("new") ? [{ id: "new", label: "最新" }] : [])] }} value={order} onChange={value => setOrder(value as "hot" | "new")} />
    </div>
    <PlaylistResults key={`${platform}:${category.id}:${order}`} platform={platform} category={category.id} order={order} onOpen={onOpen} />
  </section>;
}

export function PlaylistDiscovery(player: PlaylistPlayerProps) {
  const { importedPlaylist, setImportedPlaylist } = useDiscoveryMode();
  const [mode, setMode] = useState<"playlists" | "charts">("playlists");
  const [chartPlatform, setChartPlatform] = useState<PlaylistPlatform>("netease");
  const [selected, setSelected] = useState<{ mode: "playlists" | "charts"; item: PlaylistSummary } | null>(null);
  const imported = importedPlaylist;
  const selectedPlaylist = imported?.playlist ?? (selected?.mode === mode ? selected.item : null);
  const position = useRef(0);
  function open(item: PlaylistSummary) { position.current = window.scrollY; setImportedPlaylist(null); setSelected({ mode, item }); window.scrollTo({ top: 0, behavior: "instant" }); }
  function back() { setSelected(null); setImportedPlaylist(null); requestAnimationFrame(() => window.scrollTo({ top: position.current, behavior: "instant" })); }
  return <motion.section className={styles.discovery} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: .3 }}>
    {!selectedPlaylist && <div className={styles.browseNavigation}><SegmentedControl<"playlists" | "charts"> value={mode} onChange={value => { setMode(value); setSelected(null); setImportedPlaylist(null); }} label="发现内容" options={[
      { value: "playlists", label: "歌单", icon: <ListMusic size={15} /> },
      { value: "charts", label: "排行榜", icon: <ChartNoAxesColumnIncreasing size={15} /> },
    ]} /></div>}
    <AnimatePresence mode="wait" initial={false}>
      {selectedPlaylist ? <motion.div key={`${mode}:${selectedPlaylist.platform}:${selectedPlaylist.kind}:${selectedPlaylist.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <PlaylistDetailView item={selectedPlaylist} initial={imported ?? undefined} onBack={back} backLabel={mode === "charts" ? "返回排行榜" : "返回发现歌单"} {...player} />
      </motion.div> : <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}>
        <div className={styles.intro}><span className={styles.eyebrow}>{mode === "charts" ? "排行榜" : "发现歌单"}</span><h1>{mode === "charts" ? "听见此刻的热门。" : "下一首喜欢，从这里开始。"}</h1></div>
        {mode === "charts" ? <ChartSection key={chartPlatform} platform={chartPlatform} onPlatformChange={setChartPlatform} onOpen={open} /> : <PlaylistBrowseSection onOpen={open} />}
      </motion.div>}
    </AnimatePresence>
  </motion.section>;
}
