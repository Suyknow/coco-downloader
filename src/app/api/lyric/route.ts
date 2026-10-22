import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers';
import { identifyOfficialTrack, officialProvider } from '@/lib/providers/official-source';

type LyricData = {
  songid: string;
  provider: string;
  lines: Array<{ time: number; text: string }>;
  lrc: string;
};
type LyricCapableProvider = { getLyric?: (id: string, extra?: unknown) => Promise<LyricData> };

function parseExtra(value: string | null) {
  if (!value) return undefined;
  try { return JSON.parse(value) as Record<string, unknown>; }
  catch { return undefined; }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get('id');
  const providerName = params.get('provider') || 'netease';
  const extra = parseExtra(params.get('extra'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    // Validate the selected channel before attempting any upstream request.
    const fallback = getProvider(providerName) as LyricCapableProvider;
    try {
      const track = await identifyOfficialTrack(providerName, id, extra);
      if (track) {
        const provider = officialProvider(track.platform) as LyricCapableProvider;
        const lyric = await provider.getLyric?.(track.id, { ...extra, filename: `${track.title} - ${track.artist}` });
        if (lyric && (lyric.lines.length || lyric.lrc)) return NextResponse.json({ ...lyric, source: 'official' });
      }
    } catch (error) {
      console.warn('Official lyric request failed:', error instanceof Error ? error.message : 'Unknown failure');
    }
    // A channel-provided lyric is a fallback when no exact official match or
    // lyric is available; never match a different recording by title alone.
    if (fallback.getLyric) {
      const lyric = await fallback.getLyric(id, extra);
      return NextResponse.json({ ...lyric, source: 'channel' });
    }
    return NextResponse.json({ songid: id, provider: providerName, lines: [], lrc: '' });
  } catch (error) {
    console.error('Lyric error:', error instanceof Error ? error.message : 'Unknown failure');
    return NextResponse.json({ error: '歌词暂时无法获取' }, { status: 502 });
  }
}
