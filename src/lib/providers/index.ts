import { At38Provider } from './impl/at38';
import { GequhaiProvider } from './impl/gequhai';
import { MusicProvider } from '@/types/music';
import { BodianProvider } from './impl/bodian';
import { QQProvider } from './impl/qq';
import { KugouProvider } from './impl/kugou';
import { QQMp3Provider } from './impl/qqmp3';
import { LivepooProvider } from './impl/livepoo';
import { JianbinProvider } from './impl/jianbin';
import { NeteaseOfficialProvider } from './impl/netease';
import { GDStudioProvider } from './impl/gdstudio';
import { GequkeProvider } from './impl/gequke';

const providers: Record<string, MusicProvider> = {
  'netease': new NeteaseOfficialProvider(),
  'gdstudio-netease': new GDStudioProvider(),
  'at38-netease': new At38Provider('at38-netease', 'wy'),
  'at38-qq': new At38Provider('at38-qq', 'qq'),
  qq: new QQProvider(),
  kugou: new KugouProvider(),
  bodian: new BodianProvider(),
  gequhai: new GequhaiProvider(),
  gequke: new GequkeProvider(),
  qqmp3: new QQMp3Provider(),
  livepoo: new LivepooProvider(),
  'jianbin-netease': new JianbinProvider('jianbin-netease', 'netease'),
  'jianbin-qq': new JianbinProvider('jianbin-qq', 'qq'),
  'jianbin-kugou': new JianbinProvider('jianbin-kugou', 'kugou'),
  'jianbin-kuwo': new JianbinProvider('jianbin-kuwo', 'kuwo'),
};

export function getProvider(name: string = 'netease'): MusicProvider {
  const provider = Object.hasOwn(providers, name) ? providers[name] : undefined;
  if (!provider) throw new Error('该渠道已下架或不存在，请重新选择音乐平台与渠道');
  return provider;
}

export function getAllProviders(): MusicProvider[] {
  return Object.values(providers);
}
