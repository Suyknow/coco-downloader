import type { MusicItem, PlayInfo } from '@/types/music';
import { getProvider } from '@/lib/providers';
import { getMusicPlatform } from '@/lib/music-channels';
import { JianbinProvider } from './impl/jianbin';
import { GDSTUDIO_QUALITY_OPTIONS } from '@/lib/music-quality';

export type SearchSource = 'channel' | 'official';
export type OfficialTrack = { platform: string; id: string; title: string; artist: string; album?: string };
const OFFICIAL_PROVIDERS: Record<string, string> = { netease: 'netease', qq: 'qq', kugou: 'kugou', kuwo: 'bodian' };
const PLATFORM_ID_CHANNELS = new Set(['netease', 'qq', 'kugou', 'bodian', 'at38-netease', 'at38-qq', 'livepoo', 'gdstudio-netease']);
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const artists = (value: string) => value.split(/\s*(?:\/|、|,|，|&|;|；)\s*/).map(normalize).filter(Boolean);

export function matchingTrack(track: Pick<MusicItem, 'title' | 'artist'>, items: MusicItem[]) {
  const names = artists(track.artist);
  return items.find(item => normalize(item.title) === normalize(track.title) && names.length > 0 && artists(item.artist).some(name => names.includes(name)));
}

export function officialProvider(platform: string) {
  const name = Object.hasOwn(OFFICIAL_PROVIDERS, platform) ? OFFICIAL_PROVIDERS[platform] : undefined;
  if (!name) throw new Error('当前平台暂不支持官方搜索');
  return getProvider(name);
}

export async function searchBySource(channel: string, query: string, limit: number, offset: number, source: SearchSource) {
  if (source === 'channel') return getProvider(channel).search(query, limit, offset);
  const platform = getMusicPlatform(channel)?.id;
  if (!platform) throw new Error('请先选择音乐平台与渠道');
  const items = await officialProvider(platform).search(query, limit, offset);
  return items.map(item => ({
    ...item, provider: channel,
    extra: {
      // A channel must not receive another resolver's quality/parser options.
      cover: item.cover, filename: `${item.artist}-${item.title}`,
      ...(channel === 'netease' ? (item.extra as object) : {}),
      ...(channel === 'gdstudio-netease' ? { selectedLevel: 'lossless', qualityOptions: GDSTUDIO_QUALITY_OPTIONS } : {}),
      officialTrack: { platform, id: item.id, title: item.title, artist: item.artist, album: item.album } satisfies OfficialTrack,
    },
  }));
}

export function readOfficialTrack(extra: unknown, channel: string, id: string): OfficialTrack | undefined {
  const value = (extra as { officialTrack?: OfficialTrack } | undefined)?.officialTrack;
  const platform = getMusicPlatform(channel)?.id;
  if (!value || value.platform !== platform || value.id !== id || typeof value.title !== 'string' || typeof value.artist !== 'string') return undefined;
  return value;
}

export async function resolveChannelPlayInfo(channel: string, id: string, extra?: unknown): Promise<PlayInfo> {
  const provider = getProvider(channel);
  const track = readOfficialTrack(extra, channel, id);
  if (!track || PLATFORM_ID_CHANNELS.has(channel)) return provider.getPlayInfo(id, extra);
  if (provider instanceof JianbinProvider) return provider.getByOfficialId(track.id);
  const candidates = await provider.search(track.title, 50, 0);
  const matched = matchingTrack(track, candidates);
  if (!matched) throw new Error('所选渠道未找到同名、同歌手的歌曲，请尝试渠道搜索或其他渠道');
  return provider.getPlayInfo(matched.id, matched.extra);
}

export async function identifyOfficialTrack(channel: string, id: string, extra?: unknown): Promise<OfficialTrack | undefined> {
  const platform = getMusicPlatform(channel)?.id;
  if (!platform) return undefined;
  const context = extra as { title?: string; artist?: string; officialTrack?: OfficialTrack } | undefined;
  const explicit = readOfficialTrack(extra, channel, id);
  if (explicit) return explicit;
  let officialId = PLATFORM_ID_CHANNELS.has(channel) ? id : '';
  if (channel.startsWith('jianbin-')) {
    try {
      let decoded = id;
      for (let n = 0; n < 2 && decoded.includes('%'); n++) decoded = decodeURIComponent(decoded);
      const url = new URL(decoded);
      const expected = { netease: 'wy', qq: 'qq', kugou: 'kg', kuwo: 'kw' }[platform];
      if (url.hostname === 'www.jbsou.cn' && url.searchParams.get('type') === expected) officialId = url.searchParams.get('id') || '';
    } catch { /* Use title and artist matching below when the link has no platform ID. */ }
  }
  if (!officialId && typeof context?.title === 'string' && typeof context.artist === 'string') {
    const candidates = await officialProvider(platform).search(context.title, 30, 0);
    const match = matchingTrack({ title: context.title, artist: context.artist }, candidates);
    officialId = match?.id || '';
  }
  if (!officialId) return undefined;
  return { platform, id: officialId, title: context?.title || '', artist: context?.artist || '' };
}
