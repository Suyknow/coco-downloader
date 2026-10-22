"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Search, Loader2, Play, Pause, Download, Check, Music, Trash2, ExternalLink, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MusicItem } from "@/types/music";
import { PlayerBar } from "@/components/PlayerBar";
import { ChannelSelect } from "@/components/ChannelSelect";
import { getMusicChannel, getMusicPlatform, supportsBatchDownload } from "@/lib/music-channels";
import { BrowserDownloadNotice } from "@/components/BrowserDownloadNotice";
import { DownloadDrawer } from "@/components/DownloadDrawer";
import { QualitySelectModal } from "@/components/QualitySelectModal";
import { FullscreenPlayerDrawer } from "@/components/FullscreenPlayerDrawer";
import { DownloadTask } from "@/types/download";
import { BrowserDirectDownloadError, fetchAudioBlob } from "@/lib/browser-download";
import { message } from "antd";

async function fetchJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(35000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '渠道请求失败，请重试或切换渠道');
  return data;
}

function notifyError(error: unknown, fallback: string, key = 'request-error') {
  const content = error instanceof Error && error.name !== 'TimeoutError' ? error.message : fallback;
  void message.error({ key, content, duration: 6 });
}

type QualityOption = {
  value: string;
  label: string;
  quality: string;
  format: string;
};

type ProviderExtra = {
  selectedQuality?: string;
  selectedFormat?: string;
  selectedLevel?: string;
  level?: string;
  selectedParser?: string;
  qualityOptions?: QualityOption[];
};

type QualityModalState = {
  mode: "single" | "batch";
  items: MusicItem[];
  qualityItemCount: number;
  optionKind: "quality" | "downloadSource";
};

type LyricLine = {
  time: number;
  text: string;
};

function buildQualityValue(extra?: ProviderExtra) {
  if (extra?.selectedParser) {
    return extra.selectedParser;
  }
  if (extra?.selectedLevel) {
    return extra.selectedLevel;
  }
  if (extra?.level) {
    return extra.level;
  }
  if (extra?.selectedQuality && extra?.selectedFormat) {
    return `${extra.selectedQuality}:${extra.selectedFormat}`;
  }
  return extra?.qualityOptions?.[0]?.value || "";
}

function buildDownloadFilename(item: MusicItem) {
  const cleanTitle = item.title.replace(/\s+/g, " ").trim();
  const extra = getProviderExtra(item);
  const extension = extra?.selectedFormat?.toLowerCase() || "mp3";
  return `${cleanTitle}.${extension}`;
}

function collectQualityOptions(items: MusicItem[]) {
  const map = new Map<string, QualityOption>();
  for (const item of items) {
    const options = getProviderExtra(item)?.qualityOptions || [];
    for (const option of options) {
      if (!map.has(option.value)) {
        map.set(option.value, option);
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const aQuality = Number(a.quality);
    const bQuality = Number(b.quality);
    if (!Number.isFinite(aQuality) || !Number.isFinite(bQuality)) return 0;
    return bQuality - aQuality;
  });
}

function applyQualityChoice(item: MusicItem, value: string) {
  const extra = getProviderExtra(item);
  if (!extra) return item;
  const match =
    extra.qualityOptions?.find((option) => option.value === value) ||
    extra.qualityOptions?.[0];
  if (!match) return item;
  if (item.provider === "netease") {
    return {
      ...item,
      extra: {
        ...(item.extra as Record<string, unknown>),
        selectedLevel: match.value,
        level: match.value,
      },
    };
  }
  if (item.provider === "qq" || item.provider === "kugou") {
    return {
      ...item,
      extra: {
        ...(item.extra as Record<string, unknown>),
        selectedParser: match.value,
        selectedFormat: match.format,
      },
    };
  }
  if (item.provider !== "joox") return item;
  return {
    ...item,
    extra: {
      ...(item.extra as Record<string, unknown>),
      selectedQuality: match.quality,
      selectedFormat: match.format,
    },
  };
}

function getQualityItems(items: MusicItem[]) {
  return items.filter((item) => (getProviderExtra(item)?.qualityOptions || []).length > 0);
}

function buildUrlRequest(item: MusicItem) {
  const params = new URLSearchParams({
    id: item.id,
    provider: item.provider || "netease",
  });
  if (item.extra !== undefined) {
    params.set("extra", JSON.stringify(item.extra));
  }
  return `/api/url?${params.toString()}`;
}

function getProviderExtra(item: MusicItem): ProviderExtra | undefined {
  if (!item.extra || typeof item.extra !== "object") return undefined;
  return item.extra as ProviderExtra;
}

const SourceLinkButton = ({ item }: { item: MusicItem }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    
    setLoading(true);
    try {
      const data = await fetchJson(buildUrlRequest(item));
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        void message.error(data.error || '无法获取源链接');
      }
    } catch (error) {
      console.error(error);
      notifyError(error, '获取链接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#404752] transition-colors hover:bg-[#005faa]/10 hover:text-[#005faa]"
      title="打开源文件链接"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
    </button>
  );
};

type PlayMode = "order" | "shuffle" | "single";
const SEARCH_PAGE_SIZE = 20;

export default function Home() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("netease");
  const [results, setResults] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Playback State
  const [activeMusic, setActiveMusic] = useState<MusicItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("order");
  const [shuffleOrder, setShuffleOrder] = useState<string[]>([]);
  const [shuffleIndex, setShuffleIndex] = useState(-1);
  const handlePlayRef = useRef<(item: MusicItem) => void>(() => undefined);
  const getNextIndexRef = useRef<() => number>(() => -1);

  const [searched, setSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingCount, setDownloadingCount] = useState(0);
  
  // Download Manager State
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [resolvingMusicId, setResolvingMusicId] = useState<string | null>(null);
  const [qualityModal, setQualityModal] = useState<QualityModalState | null>(null);
  const [selectedQualityValue, setSelectedQualityValue] = useState("");
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);
  const [playerDrawerSession, setPlayerDrawerSession] = useState(0);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [lyricLoading, setLyricLoading] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const activeChannel = getMusicChannel(provider);
  const activePlatform = getMusicPlatform(provider);
  const batchSupported = supportsBatchDownload(provider);
  const showBrowserDownloadNotice = activeChannel?.download === 'browser' || downloadTasks.some(task =>
    task.musicItem.provider === provider && task.delivery !== 'source-page' && (task.status === 'browser-ready' || task.status === 'handed-off')
  );

  const changeChannel = (id: string) => {
    setProvider(id);
    setResults([]);
    setSelectedIds(new Set());
    setHasMoreResults(false);
    setSearched(false);
  };

  const openPlayerDrawer = () => {
    setPlayerDrawerSession((session) => session + 1);
    setPlayerDrawerOpen(true);
  };

  const buildShuffleOrder = (ids: string[]) => {
    const next = [...ids];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const fetchSearchPage = async (offset: number) => {
    const params = new URLSearchParams({
      q: query.trim(),
      provider,
      limit: String(SEARCH_PAGE_SIZE),
      offset: String(offset),
    });
    const data = await fetchJson(`/api/search?${params.toString()}`);
    const items = Array.isArray(data.items) ? data.items : [];
    setHasMoreResults(items.length === SEARCH_PAGE_SIZE);
    return items as MusicItem[];
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setResults([]);
    setSelectedIds(new Set());
    setHasMoreResults(false);
    
    try {
      const items = await fetchSearchPage(0);
      setResults(items);
      if (!items.length) void message.warning("未找到歌曲，或第三方渠道暂不可用，请更换关键词或渠道");
    } catch (err) {
      console.error(err);
      notifyError(err, "搜索失败，请重试或切换渠道");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || loading || !query.trim()) return;

    setLoadingMore(true);
    try {
      const items = await fetchSearchPage(results.length);
      setResults((prev) => [...prev, ...items]);
    } catch (err) {
      console.error(err);
      notifyError(err, "搜索失败，请重试或切换渠道");
    } finally {
      setLoadingMore(false);
    }
  };

  const syncShuffleIndex = (id: string) => {
    const index = shuffleOrder.indexOf(id);
    if (index >= 0) {
      setShuffleIndex(index);
      return;
    }
    if (results.length > 0) {
      const ids = results.map(r => r.id);
      const nextOrder = buildShuffleOrder(ids);
      setShuffleOrder(nextOrder);
      setShuffleIndex(nextOrder.indexOf(id));
    } else {
      setShuffleIndex(-1);
    }
  };

  const playRequestRef = useRef(0);
  const handlePlay = async (item: MusicItem) => {
    if (getMusicChannel(item.provider)?.preview === false) {
      void message.info('此渠道仅提供网盘下载，请前往源站保存，暂不支持试听');
      return;
    }
    if (resolvingMusicId === item.id) return;
    const requestId = ++playRequestRef.current;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (activeMusic?.id === item.id && activeMusic.provider === item.provider && audio.src) {
        if (playing) { audio.pause(); setPlaying(false); }
        else { await audio.play(); setPlaying(true); }
        return;
      }
      audio.pause();
      setActiveMusic(item);
      syncShuffleIndex(item.id);
      setPlaying(false);
      setCurrentTime(0);
      setResolvingMusicId(item.id);
      const preview = { ...item, extra: { ...(item.extra as Record<string, unknown> || {}), usage: 'playback' } };
      const data = await fetchJson(buildUrlRequest(preview));
      if (requestId !== playRequestRef.current) return;
      if (data.delivery === 'source-page') throw new Error('此渠道仅提供源站下载，不支持试听');
      if (!data.url) throw new Error(data.error || '渠道未返回播放链接');
      if (data.cover) setActiveMusic({ ...item, cover: data.cover });
      audio.src = data.url;
      audio.load();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          audio.play(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('音频加载超时，请重试或切换渠道')), 35000); }),
        ]);
      } finally { clearTimeout(timeout); }
      if (requestId === playRequestRef.current) setPlaying(true);
    } catch (error) {
      if (requestId !== playRequestRef.current) return;
      audio.pause();
      setActiveMusic(null);
      setPlaying(false);
      notifyError(error, '播放失败，请重试或切换渠道', 'playback');
    } finally {
      if (requestId === playRequestRef.current) setResolvingMusicId(null);
    }
  };
  handlePlayRef.current = handlePlay;

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  useEffect(() => {
    const ids = results.map(r => r.id);
    if (ids.length === 0) {
      setShuffleOrder([]);
      setShuffleIndex(-1);
      return;
    }
    setShuffleOrder(buildShuffleOrder(ids));
  }, [results]);

  useEffect(() => {
    if (!activeMusic) {
      setShuffleIndex(-1);
      return;
    }
    const index = shuffleOrder.indexOf(activeMusic.id);
    setShuffleIndex(index);
  }, [activeMusic, shuffleOrder]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!activeMusic) {
      setLyricLines([]);
      setLyricLoading(false);
      return;
    }

    let cancelled = false;
    setLyricLoading(true);
    setLyricLines([]);

    const params = new URLSearchParams({
      id: activeMusic.id,
      provider: activeMusic.provider || "netease",
    });
    if (activeMusic.extra !== undefined) {
      params.set("extra", JSON.stringify(activeMusic.extra));
    }

    fetch(`/api/lyric?${params.toString()}`)
      .then(async (res) => { if (!res.ok) throw new Error("歌词加载失败"); return res.json(); })
      .then((data) => {
        if (cancelled) return;
        const lines = Array.isArray(data?.lines) ? data.lines : [];
        setLyricLines(
          lines.filter(
            (line: LyricLine) =>
              typeof line.time === "number" && typeof line.text === "string" && line.text.trim()
          )
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Lyric load failed", error);
          void message.warning({ key: "lyrics", content: "歌词加载失败，不影响歌曲播放" });
          setLyricLines([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLyricLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMusic]);

  const executeDownload = async (task: DownloadTask, browserWindow?: Window | null, handoffImmediately = false) => {
    try {
      // Update status to downloading
      setDownloadTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'downloading' } : t
      ));

      const params = new URLSearchParams({
        id: task.musicItem.id,
        provider: task.musicItem.provider || 'netease',
      });
      if (task.musicItem.extra !== undefined) params.set('extra', JSON.stringify(task.musicItem.extra));
      const response = await fetch(`/api/download?${params}`, { cache: 'no-store' });
      const delivery = await response.json();
      if (!response.ok || typeof delivery.url !== 'string') throw new Error(delivery.error || '下载链接获取失败');
      const extension = String(delivery.type || '').toLowerCase();
      const fileName = ['mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg', 'opus'].includes(extension)
        ? task.fileName.replace(/\.[^.]+$/, `.${extension}`)
        : task.fileName;
      const sourcePage = delivery.delivery === 'source-page';
      if (sourcePage || getMusicChannel(task.musicItem.provider)?.download === 'browser') {
        if (handoffImmediately) {
          if (browserWindow && !browserWindow.closed) {
            browserWindow.location.replace(delivery.url);
          } else {
            // If popups are blocked or the reserved tab was closed, hand off
            // in this tab so downloading never requires another button click.
            window.location.assign(delivery.url);
          }
        }
        setDownloadTasks(prev => prev.map(t => t.id === task.id ? {
          ...t, fileName, sourceUrl: delivery.url, delivery: sourcePage ? 'source-page' : 'audio',
          status: handoffImmediately ? 'handed-off' : 'browser-ready',
          notice: sourcePage ? '请在源站选择网盘入口保存，网页无法跟踪后续进度。' : '已交给浏览器处理，网页无法跟踪后续进度。',
        } : t));
        return;
      }
      setDownloadTasks(prev => prev.map(t => t.id === task.id ? { ...t, fileName, sourceUrl: delivery.url } : t));
      let blob: Blob;
      try {
        blob = await fetchAudioBlob(delivery.url, (progress, receivedBytes, totalBytes) => {
          setDownloadTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress, receivedBytes, totalBytes } : t));
        });
      } catch (error) {
        if (!(error instanceof BrowserDirectDownloadError)) throw error;
        setDownloadTasks(prev => prev.map(t => t.id === task.id ? {
          ...t, status: 'browser-ready', progress: 0, receivedBytes: undefined, totalBytes: undefined, notice: error.message,
        } : t));
        return;
      }

      // Handle completion
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);

      setDownloadTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, fileName, status: 'completed', progress: 100 } : t
      ));

    } catch (err: unknown) {
      if (browserWindow && !browserWindow.closed) browserWindow.close();
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : '下载失败';
      void message.error({ key: `download-${task.id}`, content: `${task.musicItem.title}：${errorMessage}`, duration: 6 });
      setDownloadTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'error', error: errorMessage } : t
      ));
    }
  };

  const createTask = (item: MusicItem): DownloadTask => {
    const taskId = `${item.id}-${Date.now()}`;
    return {
      id: taskId,
      musicItem: item,
      status: 'pending',
      progress: 0,
      fileName: buildDownloadFilename(item),
      startTime: Date.now()
    };
  };

  const startSingleDownload = async (item: MusicItem) => {
    const newTask = createTask(item);
    const downloadMode = getMusicChannel(item.provider)?.download;
    const browserDownload = downloadMode === 'browser' || downloadMode === 'source-page';
    // Reserve the tab during the click gesture, before URL resolution awaits
    // the server; opening it afterward can trigger popup blocking.
    const browserWindow = browserDownload ? window.open('about:blank', '_blank') : undefined;
    if (browserWindow) {
      browserWindow.opener = null;
      browserWindow.document.title = '正在准备下载';
      browserWindow.document.body.textContent = '正在获取下载链接，请稍候…';
    }

    setDownloadTasks(prev => [newTask, ...prev]);
    if (!browserDownload) setIsDrawerOpen(true);

    await executeDownload(newTask, browserWindow, browserDownload);
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const openQualityModal = (items: MusicItem[], mode: "single" | "batch") => {
    const qualityItems = getQualityItems(items);
    if (qualityItems.length === 0) return false;
    const options = collectQualityOptions(qualityItems);
    if (options.length === 0) return false;
    const optionKind = "quality" as const;
    setSelectedQualityValue(buildQualityValue(getProviderExtra(qualityItems[0])) || options[0].value);
    setQualityModal({
      mode,
      items,
      qualityItemCount: qualityItems.length,
      optionKind,
    });
    return true;
  };

  const startBatchDownload = async (items: MusicItem[]) => {
    if (items.some(item => !supportsBatchDownload(item.provider))) {
      void message.info('所选渠道需逐首交给浏览器下载，不支持网页自动批量下载；可使用客户端');
      return;
    }
    if (items.length > 5) {
      if (!confirm(`即将下载 ${items.length} 首歌曲，可能需要一些时间，是否继续？`)) return;
    }

    const newTasks: DownloadTask[] = items.map((item) => ({
      ...createTask(item),
      id: `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    setDownloadTasks(prev => [...newTasks, ...prev]);
    setIsDrawerOpen(true);
    setDownloadingCount(items.length);

    const CONCURRENCY_LIMIT = 3;
    const queue = [...newTasks];
    const activePromises: Promise<void>[] = [];

    const processQueue = async () => {
      while (queue.length > 0) {
        if (activePromises.length >= CONCURRENCY_LIMIT) {
          await Promise.race(activePromises);
        }
        
        const task = queue.shift();
        if (task) {
          const promise = executeDownload(task).then(() => {
            setDownloadingCount(prev => Math.max(0, prev - 1));
            // Remove self from active promises
            const index = activePromises.indexOf(promise);
            if (index > -1) activePromises.splice(index, 1);
          });
          activePromises.push(promise);
        }
      }
      // Wait for remaining
      await Promise.all(activePromises);
    };

    await processQueue();
    setDownloadingCount(0);
  };

  const requestDownloadOne = async (item: MusicItem) => {
    const downloadMode = getMusicChannel(item.provider)?.download;
    if (downloadMode !== 'browser' && downloadMode !== 'source-page' && openQualityModal([item], "single")) return;
    await startSingleDownload(item);
  };

  const handleBatchDownload = async () => {
    if (!batchSupported) {
      void message.info('当前渠道不支持网页自动批量下载，请逐首下载或使用客户端');
      return;
    }
    const items = results.filter(r => selectedIds.has(r.id));
    if (items.length === 0) return;
    if (openQualityModal(items, "batch")) return;
    await startBatchDownload(items);
  };

  const confirmQualityDownload = async () => {
    if (!qualityModal) return;
    const items = qualityModal.items.map((item) => applyQualityChoice(item, selectedQualityValue));
    const mode = qualityModal.mode;
    setQualityModal(null);
    if (mode === "single") {
      await startSingleDownload(items[0]);
      return;
    }
    await startBatchDownload(items);
  };

  const currentIndex = activeMusic ? results.findIndex(r => r.id === activeMusic.id) : -1;
  const getNextIndex = () => {
    if (!activeMusic) return -1;
    if (playMode === "shuffle") {
      if (shuffleIndex >= 0 && shuffleIndex < shuffleOrder.length - 1) {
        const nextId = shuffleOrder[shuffleIndex + 1];
        return results.findIndex(r => r.id === nextId);
      }
      return -1;
    }
    if (currentIndex >= 0 && currentIndex < results.length - 1) {
      return currentIndex + 1;
    }
    return -1;
  };
  getNextIndexRef.current = getNextIndex;

  const getPrevIndex = () => {
    if (!activeMusic) return -1;
    if (playMode === "shuffle") {
      if (shuffleIndex > 0) {
        const prevId = shuffleOrder[shuffleIndex - 1];
        return results.findIndex(r => r.id === prevId);
      }
      return -1;
    }
    if (currentIndex > 0) {
      return currentIndex - 1;
    }
    return -1;
  };

  const canNext = getNextIndex() >= 0;
  const canPrev = getPrevIndex() >= 0;

  const handleNext = () => {
    const nextIndex = getNextIndex();
    if (nextIndex >= 0) handlePlay(results[nextIndex]);
  };
  const handlePrev = () => {
    const prevIndex = getPrevIndex();
    if (prevIndex >= 0) handlePlay(results[prevIndex]);
  };

  const togglePlayMode = () => {
    setPlayMode(prev => {
      if (prev === "order") return "shuffle";
      if (prev === "shuffle") return "single";
      return "order";
    });
  };

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);

    };
    const handleEnded = () => {
      if (playMode === "single") {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play()
            .then(() => setPlaying(true))
            .catch((error) => { setPlaying(false); notifyError(error, "播放失败", "playback"); });
        }
        return;
      }
      const nextIndex = getNextIndexRef.current();
      if (nextIndex >= 0) {
        handlePlayRef.current(results[nextIndex]);
      } else {
        setPlaying(false);
      }
    };

    const handleError = () => {
      setPlaying(false);
      setResolvingMusicId(null);
      setActiveMusic(null);
      void message.error({ key: 'playback', content: '音频无法加载或格式不受支持，请重试或切换渠道', duration: 6 });
    };
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playing, playMode, results]);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#fcf9f8] text-[#1b1b1c] selection:bg-[#d3e3ff] selection:text-[#001c39] pb-36 transition-colors duration-300 dark:bg-[#111315] dark:text-[#f3f0ef]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center px-4 py-10 md:px-12">
        <motion.div 
          layout
          className={cn(
            "flex w-full flex-col items-center justify-center transition-all duration-500",
            searched ? "mt-0 mb-8" : "min-h-[calc(100vh-220px)]"
          )}
        >
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#d3e3ff] text-[#005faa] shadow-[0_8px_24px_rgba(0,0,0,0.04)] dark:bg-[#003f6d] dark:text-[#a3c9ff]">
            <Music className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-center text-[28px] font-bold leading-9 tracking-normal text-[#1b1b1c] md:text-[32px] md:leading-10 dark:text-[#f3f0ef]">
            COCO音乐下载站
          </h1>
          <p className="mb-8 text-center text-base leading-6 text-[#404752] dark:text-[#c6c6c7]">
            搜索、播放与下载依赖第三方渠道的稳定性，不保证持续有效；失败时请重试或切换渠道。
          </p>

          <form onSubmit={handleSearch} className="w-full max-w-2xl rounded-2xl border border-[#e5e2e1]/70 bg-[#f6f3f2] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-300 focus-within:border-[#005faa]/30 focus-within:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#242526]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <ChannelSelect value={provider} onChange={changeChannel} disabled={loading || loadingMore} />
              <div className="hidden h-8 w-px bg-[#c0c7d4]/40 sm:block" />
              <div className="relative flex min-w-0 flex-1 items-center">
                <Search className="absolute left-3 h-5 w-5 text-[#404752] dark:text-[#c6c6c7]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                  placeholder="输入歌曲名、歌手或专辑..."
                  className="h-12 w-full rounded-xl border-none bg-transparent py-3 pl-10 pr-28 text-base leading-6 text-[#1b1b1c] outline-none placeholder:text-[#404752]/60 focus:ring-0 dark:text-[#f3f0ef] dark:placeholder:text-[#c6c6c7]/60"
              />
              <button
                type="submit"
                disabled={loading}
                  className="absolute bottom-1 right-1 top-1 flex cursor-pointer items-center gap-1 rounded-lg bg-[#005faa] px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0078d4] active:scale-95 disabled:cursor-wait disabled:opacity-70"
              >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>搜索</span>}
                  {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
              </div>
            </div>
          </form>
          {activeChannel && (
            <p className="mt-3 w-full max-w-2xl rounded-xl bg-[#d3e3ff]/35 px-4 py-3 text-xs leading-5 text-[#404752] dark:bg-[#003f6d]/25 dark:text-[#c6c6c7]">
              <span className="mr-2 font-semibold">{activePlatform?.name} · {activeChannel.name}</span>
              {activeChannel.description}
            </p>
          )}
          {showBrowserDownloadNotice && (
            <BrowserDownloadNotice className="mt-3 w-full max-w-2xl rounded-xl bg-[#d3e3ff]/35 px-4 py-3 dark:bg-[#003f6d]/25" />
          )}

          <AnimatePresence>
            {!searched && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-[#404752] dark:text-[#c6c6c7]"
              >
                <span className="mr-1">热门推荐:</span>
                {["周杰伦", "林俊杰", "陈奕迅", "孙燕姿"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="cursor-pointer rounded-full border border-[#c0c7d4]/30 bg-[#f0eded] px-3 py-1.5 text-[#1b1b1c] transition-colors hover:bg-[#eae7e7] dark:border-white/10 dark:bg-[#242526] dark:text-[#f3f0ef] dark:hover:bg-[#303030]"
                  >
                    {tag}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <div className="mx-auto w-full max-w-[1160px] flex-1">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 text-[#404752] dark:text-[#c6c6c7]"
              >
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#005faa]" />
                <p>正在搜索歌曲...</p>
              </motion.div>
            ) : results.length > 0 ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-24"
              >
                <div className="mb-6">
                  <div>
                    <h2 className="text-[28px] font-bold leading-9 text-[#1b1b1c] md:text-[32px] md:leading-10 dark:text-[#f3f0ef]">搜索结果</h2>
                    <p className="mt-1 text-sm leading-5 text-[#404752] dark:text-[#c6c6c7]">
                      找到 {results.length} 首相关歌曲 · {activePlatform?.name} / {activeChannel?.name}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "mb-2 hidden gap-4 border-b border-[#c0c7d4]/30 px-4 py-2 text-xs font-medium text-[#404752] md:grid dark:text-[#c6c6c7]",
                    "grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_120px]"
                  )}
                >
                  <div className="flex justify-center items-center">
                      <button 
                        onClick={toggleAll}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer",
                          selectedIds.size === results.length && results.length > 0
                            ? "bg-[#005faa] border-[#005faa] text-white" 
                            : "border-[#c0c7d4] bg-white hover:border-[#005faa] dark:bg-[#242526]"
                        )}
                      >
                        {selectedIds.size === results.length && results.length > 0 && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  <div>歌曲</div>
                  <div className="hidden md:block">歌手</div>
                  <div className="hidden md:block">专辑</div>
                  <div className="text-right">操作</div>
                </div>

                <div className="flex flex-col gap-2">
                  {results.map((item) => {
                    const isActive = activeMusic?.id === item.id;
                    const isSelected = selectedIds.has(item.id);
                    
                    return (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onDoubleClick={() => handlePlay(item)}
                        className={cn(
                          "group flex cursor-pointer select-none items-center gap-3 overflow-hidden rounded-xl border border-[#c0c7d4]/20 bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300 hover:bg-[#fcf9f8] hover:shadow-md active:scale-[0.99] md:grid md:gap-4 md:p-5 dark:border-white/10 dark:bg-[#242526] dark:hover:bg-[#303030]",
                          "md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_120px]",
                          isActive && "border-[#005faa]/30 bg-[#d3e3ff]/35"
                        )}
                      >
                        <div className="flex justify-center items-center">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                              className={cn(
                                "w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer",
                                isSelected 
                                  ? "bg-[#005faa] border-[#005faa] text-white" 
                                  : "border-[#c0c7d4] bg-white hover:border-[#005faa] dark:bg-[#242526]"
                              )}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden md:flex-none">
                          <div 
                            onClick={(e) => { e.stopPropagation(); handlePlay(item); }}
                            className="group/cover relative h-12 w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-[#f0eded] transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg md:h-14 md:w-14 dark:bg-[#303030]"
                          >
                            {item.cover ? (
                              <Image
                                src={item.cover}
                                alt={item.title}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#404752]">
                                <Music className="w-5 h-5" />
                              </div>
                            )}
                            <div className={cn(
                              "absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity",
                              isActive ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100"
                            )}>
                              {resolvingMusicId === item.id ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              ) : isActive && playing ? (
                                <Pause className="w-4 h-4 text-white fill-current" />
                              ) : (
                                <Play className="w-4 h-4 text-white fill-current" />
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 overflow-hidden">
                            <span className={cn(
                              "truncate text-base font-bold leading-6",
                              isActive ? "text-[#005faa] dark:text-[#a3c9ff]" : "text-[#1b1b1c] dark:text-[#f3f0ef]"
                            )}>
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-sm text-[#404752] md:hidden dark:text-[#c6c6c7]">
                              {item.artist}{item.album ? ` · ${item.album}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="hidden truncate text-sm text-[#404752] md:block dark:text-[#c6c6c7]">
                          <div className="truncate">{item.artist}</div>
                        </div>

                        <div className="hidden truncate text-sm text-[#404752] md:block dark:text-[#c6c6c7]">
                          {item.album || "-"}
                        </div>

                        <div className="ml-auto flex justify-end gap-1 pl-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 md:ml-0 md:gap-2 md:pl-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePlay(item); }}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#404752] transition-colors hover:bg-[#005faa]/10 hover:text-[#005faa] dark:text-[#c6c6c7] dark:hover:text-[#a3c9ff]"
                            disabled={getMusicChannel(item.provider)?.preview === false}
                            title={getMusicChannel(item.provider)?.preview === false ? "网盘下载渠道不支持试听" : isActive && playing ? "暂停" : "播放"}
                          >
                            {resolvingMusicId === item.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : isActive && playing ? (
                              <Pause className="h-5 w-5 fill-current" />
                            ) : (
                              <Play className="h-5 w-5 fill-current" />
                            )}
                          </button>
                          <SourceLinkButton item={item} />
                          <button
                              onClick={(e) => { e.stopPropagation(); requestDownloadOne(item); }}
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#005faa] text-white shadow-sm transition-all hover:bg-[#0078d4] hover:shadow-md active:scale-95"
                              title={getMusicChannel(item.provider)?.download === "source-page" ? "前往源站下载" : getMusicChannel(item.provider)?.download === "browser" ? "交给浏览器下载" : "下载"}
                            >
                              <Download className="w-5 h-5" />
                            </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {hasMoreResults ? (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#c0c7d4]/40 bg-white px-5 py-2.5 text-sm font-medium text-[#1b1b1c] shadow-sm transition-colors hover:border-[#005faa]/30 hover:bg-[#d3e3ff]/35 disabled:cursor-wait disabled:opacity-70 dark:border-white/10 dark:bg-[#242526] dark:text-[#f3f0ef] dark:hover:bg-[#303030]"
                    >
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {loadingMore ? "加载中..." : "加载更多"}
                    </button>
                  </div>
                ) : null}
              </motion.div>
            ) : searched ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center text-[#404752] dark:text-[#c6c6c7]"
              >
                <p>未找到相关歌曲，换个关键词试试？</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <DownloadDrawer
          isOpen={isDrawerOpen}
          onOpen={() => setIsDrawerOpen(true)}
          onClose={() => setIsDrawerOpen(false)}
          tasks={downloadTasks}
          onBrowserHandoff={(taskId) => setDownloadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'handed-off' } : t))}
          onRemoveTask={(taskId) => setDownloadTasks(prev => prev.filter(t => t.id !== taskId))}
          onClearCompleted={() => setDownloadTasks(prev => prev.filter(t => t.status === 'downloading' || t.status === 'pending'))}
        />

      <QualitySelectModal
        isOpen={Boolean(qualityModal)}
        title={
          qualityModal?.optionKind === "downloadSource"
            ? qualityModal?.mode === "batch"
              ? "选择批量下载线路"
              : "选择下载线路"
            : qualityModal?.mode === "batch"
              ? "选择批量下载音质"
              : "选择下载音质"
        }
        description={
          qualityModal?.optionKind === "downloadSource"
            ? qualityModal?.mode === "batch"
              ? `本次会把所选线路应用到 ${qualityModal?.qualityItemCount || 0} 首支持线路选择的曲目。`
              : "请选择本次下载使用的解析线路。"
            : qualityModal?.mode === "batch"
              ? `本次会把所选音质应用到 ${qualityModal?.qualityItemCount || 0} 首支持音质选择的曲目。`
              : "请选择本次下载使用的音质。"
        }
        options={qualityModal ? collectQualityOptions(getQualityItems(qualityModal.items)) : []}
        value={selectedQualityValue}
        onChange={setSelectedQualityValue}
        onClose={() => setQualityModal(null)}
        onConfirm={confirmQualityDownload}
      />

      {/* Floating Download Toggle Button (Bottom Right) */}
      <AnimatePresence>
        {!isDrawerOpen && downloadTasks.length > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsDrawerOpen(true)}
            className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#005faa] text-white shadow-lg shadow-[#005faa]/25 transition-all hover:bg-[#0078d4] active:scale-95"
          >
            <div className="relative">
               <Download className="w-6 h-6" />
               {downloadTasks.some(t => t.status === 'downloading') && (
                 <span className="absolute -top-1 -right-1 flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                 </span>
               )}
            </div>
            <span className="absolute right-full mr-4 whitespace-nowrap rounded bg-[#303030] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              查看下载任务
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Batch Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="pointer-events-none fixed bottom-24 left-0 right-0 z-40 flex justify-center"
          >
            <div className="pointer-events-auto flex items-center gap-6 rounded-full bg-[#303030]/95 px-6 py-3 text-[#f3f0ef] shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
              <span className="text-sm font-medium">
                已选择 <span className="font-bold text-[#a3c9ff]">{selectedIds.size}</span> 首歌曲
              </span>
              
              <div className="h-5 w-px bg-[#c0c7d4]/30"></div>

              <button 
                onClick={handleBatchDownload}
                disabled={downloadingCount > 0 || !batchSupported}
                title={batchSupported ? "批量下载所选歌曲" : "当前渠道需逐首下载，可使用客户端进行批量下载"}
                className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
              >
                {downloadingCount > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    剩余 {downloadingCount} 首...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {batchSupported ? "批量下载" : "仅支持逐首下载"}
                  </>
                )}
              </button>

              <button 
                onClick={() => setSelectedIds(new Set())}
                className="cursor-pointer rounded-full p-1.5 text-[#f3f0ef]/75 transition-colors hover:bg-white/10 hover:text-[#ffdad6]"
                title="取消选择"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Bar */}
      <AnimatePresence>
        {activeMusic && (
          <PlayerBar 
            currentMusic={activeMusic}
            isPlaying={playing}
            isResolving={resolvingMusicId === activeMusic.id}
            onPlayPause={() => { void handlePlay(activeMusic); }}
            onNext={canNext ? handleNext : undefined}
            onPrev={canPrev ? handlePrev : undefined}
            playMode={playMode}
            onTogglePlayMode={togglePlayMode}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            volume={volume}
            onVolumeChange={setVolume}
            onOpenPlayer={openPlayerDrawer}
          />
        )}
      </AnimatePresence>

      <FullscreenPlayerDrawer
        key={`${activeMusic?.id || "empty"}-${playerDrawerSession}`}
        isOpen={playerDrawerOpen}
        music={activeMusic}
        isPlaying={playing}
        lyrics={lyricLines}
        lyricLoading={lyricLoading}
        currentTime={currentTime}
        duration={duration}
        onClose={() => setPlayerDrawerOpen(false)}
        onPlayPause={() => { if (activeMusic) void handlePlay(activeMusic); }}
        onPrev={canPrev ? handlePrev : undefined}
        onNext={canNext ? handleNext : undefined}
        onSeek={handleSeek}
      />
    </main>
  );
}
