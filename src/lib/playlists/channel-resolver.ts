import type { MusicItem } from '@/types/music';
import { MUSIC_PLATFORMS, type MusicChannel } from '@/lib/music-channels';

type Usage = 'playback' | 'download';
export const PLATFORM_ID_CHANNELS = new Set(['netease', 'qq', 'kugou', 'at38-netease', 'at38-qq']);
type Options = {
  signal?: AbortSignal;
  attempted?: Set<string>;
  onRetry?: (channel: MusicChannel) => void;
};

export function playlistPlatform(item: MusicItem) {
  const extra = item.extra as { playlistPlatform?: string } | undefined;
  return extra?.playlistPlatform;
}

function normalized(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function artists(value: string) {
  return value.split(/\s*(?:\/|、|,|，|&|;|；)\s*/).map(normalized).filter(Boolean);
}

function seconds(value?: string) {
  if (!value || !/^\d+:\d{2}$/.test(value)) return undefined;
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
}

function matchingSong(source: MusicItem, items: MusicItem[]) {
  const sourceArtists = artists(source.artist);
  const length = seconds(source.duration);
  return items.filter(candidate => {
    if (normalized(candidate.title) !== normalized(source.title)) return false;
    const candidateArtists = artists(candidate.artist);
    if (!sourceArtists.length || !sourceArtists.some(artist => candidateArtists.includes(artist))) return false;
    const candidateLength = seconds(candidate.duration);
    return length === undefined || candidateLength === undefined || Math.abs(length - candidateLength) <= 6;
  }).sort((a, b) => Number(normalized(b.album || '') === normalized(source.album || '')) - Number(normalized(a.album || '') === normalized(source.album || '')))[0];
}

async function channelItem(source: MusicItem, channel: MusicChannel, signal?: AbortSignal): Promise<MusicItem> {
  const extra = source.extra as Record<string, unknown> | undefined;
  // These channels accept the official platform ID. Jianbin instead needs the
  // signed URL returned by its own search, so never pass an official ID to it.
  const acceptsPlatformId = PLATFORM_ID_CHANNELS.has(channel.id);
  if (acceptsPlatformId && !extra?.metadataOnly) {
    return { ...source, provider: channel.id, extra: { ...extra, selectedParser: undefined, usage: undefined } };
  }
  const leadArtist = source.artist.split(/\s*(?:\/|、|,|，|&|;|；)\s*/)[0];
  const params = new URLSearchParams({ q: `${source.title} ${leadArtist}`, provider: channel.id, limit: '20' });
  const response = await fetch(`/api/search?${params}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '渠道搜索失败');
  const match = matchingSong(source, Array.isArray(data.items) ? data.items : []);
  if (!match) throw new Error('未匹配到同名、同歌手的歌曲');
  // Only Meting understands the NetEase quality values. Other providers retain
  // their own search metadata rather than receiving another channel's options.
  return channel.id === 'netease'
    ? { ...match, extra: { ...(match.extra as object), selectedLevel: extra?.selectedLevel, level: extra?.level } }
    : match;
}

export async function withPlaylistChannels<T>(source: MusicItem, usage: Usage, action: (candidate: MusicItem) => Promise<T>, options: Options = {}): Promise<T> {
  const platform = playlistPlatform(source);
  if (!platform) return action(source);
  const channels = MUSIC_PLATFORMS.find(item => item.id === platform)?.channels
    .filter(channel => usage === 'playback' ? channel.preview : channel.download !== 'source-page')
    .slice().sort((a, b) =>
      (usage === 'download' ? Number(b.download === 'direct') - Number(a.download === 'direct') : 0)
      || Number(PLATFORM_ID_CHANNELS.has(b.id)) - Number(PLATFORM_ID_CHANNELS.has(a.id))) ?? [];
  const failures: string[] = [];
  for (const [index, channel] of channels.entries()) {
    options.signal?.throwIfAborted();
    if (options.attempted?.has(channel.id)) continue;
    options.attempted?.add(channel.id);
    try {
      const candidate = await channelItem(source, channel, options.signal);
      options.signal?.throwIfAborted();
      return await action(candidate);
    } catch (error) {
      options.signal?.throwIfAborted();
      failures.push(`${channel.name}：${error instanceof Error ? error.message : '请求失败'}`);
      if (channels.slice(index + 1).some(next => !options.attempted?.has(next.id))) options.onRetry?.(channel);
    }
  }
  throw new Error(failures.length ? `此歌曲的可用渠道均未成功。${failures.join('；')}` : '此歌曲暂无其他可用渠道，请稍后重试');
}
