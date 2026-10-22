const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { Readable } = require('node:stream');
const ts = require('typescript');

// Load the application TypeScript with the same alias used by Next.js.
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args);
};
const originalTs = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};
const { MUSIC_PLATFORMS, supportsBatchDownload } = require('../src/lib/music-channels.ts');
const { getProvider, getAllProviders } = require('../src/lib/providers/index.ts');
const axios = require('axios');
const originalAdapter = axios.defaults.adapter;
after(() => {
  axios.defaults.adapter = originalAdapter;
  Module._resolveFilename = originalResolve;
  if (originalTs) require.extensions['.ts'] = originalTs;
  else delete require.extensions['.ts'];
});
function reply(config, data, headers = {}, status = 200) {
  return { config, data, headers, status, statusText: String(status) };
}

test('each selectable channel routes to its own provider; removed providers never fall back to NetEase', () => {
  const ids = MUSIC_PLATFORMS.flatMap(p => p.channels.map(c => c.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(getAllProviders().map(p => p.name)), new Set(ids));
  for (const id of ids) assert.equal(getProvider(id).name, id);
  for (const id of ['migu', 'not-a-channel', '__proto__', 'constructor']) assert.throws(() => getProvider(id), /已下架或不存在/);
  assert.equal(MUSIC_PLATFORMS.find(p => p.id === 'migu').channels.length, 0);
});

test('browser and source-page channels cannot be automatically batch downloaded', () => {
  for (const id of ['bodian', 'qqmp3', 'jianbin-kuwo', 'gequhai', 'livepoo']) assert.equal(supportsBatchDownload(id), false);
  for (const id of ['netease', 'qq', 'kugou', 'jianbin-netease', 'jianbin-qq', 'jianbin-kugou']) assert.equal(supportsBatchDownload(id), true);
  assert.equal(supportsBatchDownload('migu'), false);
});

test('saved selections for removed resolvers fail without silently using another channel', async () => {
  const requests = [];
  axios.defaults.adapter = async config => { requests.push(config.url); throw new Error('must not request'); };
  await assert.rejects(getProvider('qq').getPlayInfo('song', { selectedParser: 'xcvts' }), /已下架/);
  await assert.rejects(getProvider('qq').getPlayInfo('song', { selectedParser: 'cyapi' }), /已下架/);
  await assert.rejects(getProvider('kugou').getPlayInfo('song', { selectedParser: 'haitang' }), /已下架/);
  assert.deepEqual(requests, []);
});

test('Gequhai establishes a homepage session before search and carries it into audio resolution', async () => {
  const { GequhaiProvider } = require('../src/lib/providers/impl/gequhai.ts');
  const provider = new GequhaiProvider();
  const requests = [];
  let homepageVisits = 0;
  axios.defaults.adapter = async config => {
    requests.push(config);
    const url = new URL(config.url);
    if (url.hostname === 'www.gequhai.com') {
      if (url.pathname === '/') {
        homepageVisits++;
        if (homepageVisits === 1) return reply(config, '<script>location.reload()</script>', { 'set-cookie': ['session=test-session; Path=/'] }, 403);
        assert.match(config.headers.get('Cookie'), /session=test-session/);
        return reply(config, '<html>home</html>');
      }
      assert.match(config.headers.get('Cookie'), /session=test-session/);
      if (url.pathname === '/search') return reply(config, '<table id="myTables"><tbody><tr><td>1</td><td><a href="/play/123">晴天</a></td><td>周杰伦</td></tr></tbody></table>');
      if (url.pathname === '/play/123') return reply(config, '<script>window.play_id="123";</script>');
      if (url.pathname === '/api/music') return reply(config, { data: { url: 'https://audio.example.com/song.mp3' } });
    }
    if (url.hostname === 'audio.example.com') return reply(config, Readable.from([Buffer.from('ID3')]), { 'content-type': 'audio/mpeg' });
    throw new Error('Unexpected request');
  };
  const items = await provider.search('晴天');
  assert.equal(items[0].title, '晴天');
  const info = await provider.getPlayInfo(items[0].id, items[0].extra);
  assert.equal(info.url, 'https://audio.example.com/song.mp3');
  assert.deepEqual(requests.slice(0, 3).map(r => new URL(r.url).pathname), ['/', '/', '/search']);
});

test('Livepoo delivers the source page and ignores obsolete embedded audio URLs', async () => {
  const requests = [];
  axios.defaults.adapter = async config => {
    requests.push(config.url);
    return reply(config, '<script>const mp3_url="https://pan.quark.cn/s/example";const music_mp3Url="https://expired.example.com/old.mp3";</script>');
  };
  const info = await getProvider('livepoo').getPlayInfo('228908');
  assert.equal(info.delivery, 'source-page');
  assert.equal(info.type, '');
  assert.equal(info.url, 'https://www.livepoo.cn/music/info.html?id=MUSIC_228908');
  await assert.rejects(getProvider('livepoo').getPlayInfo('../../private'), /ID 无效/);
  assert.equal(requests.length, 1);

  const { GET } = require('../src/app/api/download/route.ts');
  const { NextRequest } = require('next/server');
  const response = await GET(new NextRequest('http://localhost/api/download?provider=livepoo&id=228908'));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.delivery, 'source-page');
  assert.equal(data.url, info.url);
});
