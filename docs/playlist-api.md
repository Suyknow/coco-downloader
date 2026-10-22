# 歌单资料接口

本模块独立于搜索与音频解析渠道，仅请求平台公开榜单、分类和歌单资料。
支持 `netease`、`qq`、`kugou`。不使用登录 Cookie，不处理私人或需要登录才能查看的歌单。
发现歌单页面已接入本模块；客户端调用封装位于 `src/lib/playlists/client.ts`。
发现歌单页面顶部通过共用的分段切换组件选择“歌单 / 排行榜”，两个界面分别加载，不同时展示。
排行榜通过下拉框选择平台，只读取当前平台榜单，默认展示前六个，可展开全部榜单。
歌单筛选读取平台原生分类；分类为单选，因为上游接口不能任意组合多个分类条件。
点击卡片展示真实歌曲列表，顶部导入链接也使用同一详情页面。

## 路由

| 请求 | 用途 |
| --- | --- |
| `GET /api/playlists/charts?platform=netease` | 平台排行榜，返回 `{ platform, items }` |
| `GET /api/playlists/categories?platform=qq` | 平台原生分类及支持的排序，返回 `{ platform, items, orders }` |
| `GET /api/playlists?platform=kugou&category=0&order=hot&limit=30&offset=0` | 分类歌单 |
| `GET /api/playlists/detail?platform=qq&id=62&kind=chart&limit=30&offset=0` | 榜单或普通歌单详情及一页歌曲 |
| `POST /api/playlists/import`，JSON `{ "url": "歌单分享链接" }` | 识别分享链接，返回歌单详情及前 30 首歌曲 |
| `GET /api/playlists/cover?url=...` | 从固定官方图片 CDN 读取封面 |

列表响应为 `{ items, total, offset, limit, hasMore }`，详情额外包含 `playlist`。
酷狗分类歌单有时提供 `total`；仅在其为有效总数时标记 `totalKnown: true`，否则 `total` 表示当前已知数量。
酷狗有时返回 `status: 1` 但缺少 `special_list`，会最多尝试三次，仍不完整则报错，不把这种响应作为空分类缓存。
每页默认 30，最多 100。QQ 分类歌单和酷狗分类歌单、酷狗榜单采用页码分页，offset 必须是 limit 的整数倍。
QQ 分类接口没有最新排序能力，`orders` 只包含 `hot`，不接受 `new`。
分类 ID 必须使用对应平台 categories 接口返回的 ID，不能把网易云分类名传给 QQ 或酷狗。

`kind` 为 `playlist` 或 `chart`，默认 `playlist`。QQ 榜单 ID 和普通歌单 ID 不能混用。
酷狗普通歌单使用上游 `global_collection_id`，例如 `collection_3_1456892349_255_0`，不能传 `specialid`。

## 链接识别

- 网易云：`https://music.163.com/#/playlist?id=...`、`/playlist?id=...`、`/playlist/...`、`/discover/toplist?id=...`。
- QQ：`https://y.qq.com/n/ryqq/playlist/...`、`/n/yqq/playsquare/....html`、`disstid` 分享参数、`/n2/m/share/details/taoge.html?id=...`，以及 `toplist` 榜单链接。支持跟随 `c6.y.qq.com/base/fcgi-bin/u` 官方短链的 HTTP 跳转。
- 酷狗：包含 `global_collection_id` 或 `rankid` 的链接；普通歌单网页中公开的全局歌单 ID 也可识别。
- 可从分享文案提取网址；短链最多跟随五次，且每次跳转都必须落在固定音乐平台域名白名单。
- 不执行分享页脚本。仅靠客户端脚本跳转或需要登录的分享链接可能无法识别，返回明确错误，不能视为已支持全部分享形式。

返回错误为 `{ error: string }`。参数错误 400，公开歌单不存在 404，无法识别链接 422，上游失败 502。
资料请求有超时、响应大小限制和最多 200 个条目的短期内存缓存；失败响应不缓存。

## 歌曲身份

歌曲返回 `platform`、`id`、`title`、`artists`、`album`、`cover`、`durationMs` 和 `identifiers`。
网易云保留 songId，QQ 同时保留数字 songId 和 mid，酷狗保留 hash 与音频 ID。
这些是平台资料标识，**不能直接假定与所有第三方音频渠道兼容**。资料请求不自动解析音频；用户播放或下载时由 `channel-resolver.ts` 映射并尝试同平台渠道。

| 平台 | 可直接传入官方歌曲标识的渠道 | 必须先搜索匹配的渠道 |
| --- | --- | --- |
| 网易云 | Meting（songId）、51ape（songId） | 煎饼（搜索结果中的签名链接） |
| QQ | VKeys（mid）、51ape（mid） | 煎饼（搜索结果中的签名链接） |
| 酷狗 | 90svip（hash） | 煎饼（搜索结果中的签名链接） |

播放优先能直接接收平台标识的渠道；下载先按是否支持自动批量下载排序，再优先直接接收平台标识的渠道。
搜索匹配要求歌名一致且歌手相符，有时长时也校验时长差，不能直接拿搜索首项替代歌曲。
以上说明的是参数兼容性，不代表第三方渠道持续可用。失败后尝试下一渠道，全部失败才报最终错误。

## 参考来源

- `markcxx/multiPlatformMusicApi`：QQ 的 Toplist、PlaylistSquare、PlayListCategory、aiDissInfo 模块及参数。
- `markcxx/CloudMusicApi`：网易云 toplist、playlist_catlist、top_playlist、playlist_detail、song_detail。
- `markcxx/KugouMusicAPI`：rank_list、rank_info、rank_audio、playlist_tags、top_playlist、playlist_detail、playlist_track_all，以及 Android 参数签名。
- 本地参考代码的 MIT 声明保存在 `docs/third-party/`。

## 首页卡片

- 榜单卡片显示真实的前三首歌曲，封面按三层叠放；上游无封面预览时，卡片进入视口后读取前三首详情。
- 趋势统一为 `up/down/new/same/heat/unknown`。QQ 映射其 rankType/rankValue，酷狗对比 business.last_sort/sort；网易云 ratio 以热度百分比展示，不能解释为名次变化。缺少数据仍显示中性标记。
- 歌单卡片使用方形封面，下方独立显示标题、创建者和播放量；宽屏五列，按屏幕宽度逐级减为四列、三列、两列。
- 榜单前三首预览按视口加载，最多三个请求并发，短期缓存复用。歌单卡片不再在悬停时请求歌曲列表，点击后进入详情。
- 筛选复用本地 Inko PPT 筛选组件的实现，包括自适应选项宽度、更多/收起以及高度过渡。
- 图片代理只允许官方图片 CDN、验证每次重定向、限制图片类型和大小，不提供任意 URL 代理。基于文件头识别实际图片，兼容网易云的 image/jpg；代理失败时客户端尝试原始 CDN 地址，封面仍失败则显示占位图。

开发时读取过平台公开响应以确认数据结构；未运行本项目构建、测试或浏览器验收，不代表线上全部接口已验证。

## 共用界面组件

- `SelectMenu`：经过统一主题配置的自定义下拉菜单，替代榜单平台原生 select。
- `SegmentedControl`：导航栏的模式切换与发现页面的歌单/排行榜切换共用，分别拥有独立的滑块动画。
- `SearchField`：歌曲搜索、歌单导入、歌曲列表筛选共用输入框、按钮、聚焦及深色主题样式，通过尺寸参数适配各个位置。
- `SongBatchBar`：搜索页和歌单详情共用的底部多选操作栏；歌单批量下载可设置默认音质。
- `SongList` / `SongCheckbox` / `SongRowActions`：搜索结果和歌单详情共用的歌曲行、多选和操作按钮。
- `SongListToolbar` / `SongActionButton`：本地筛选与列表操作。
- `PlaylistHeader`：封面、简介、创建者、标签和操作区；只显示接口实际提供的信息。
- `RankIndicator`：榜单趋势；`Artwork`：封面代理、原图回退与占位图。
- 歌单详情播放、下载使用已有服务；操作范围为已加载/当前筛选的歌曲，未假装加载全部曲目。播放队列独立于搜索结果。
