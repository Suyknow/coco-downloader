import type { PlaylistCategory, PlaylistDetail, PlaylistKind, PlaylistPlatform, PlaylistQuery, PlaylistSummary, PlaylistTrack, RankTrend } from "@/types/playlist";
import { image, number as n, page, record as r, rows, text as t, PlaylistError, type Raw } from "./shared";
import { kugouListKey, kugouMid, kugouRequest, neteaseRequest, qqRequest } from "./requests";

function qqTrend(song: Raw): RankTrend {
  const value = Math.abs(parseFloat(t(song.rankValue)));
  const types = { 1: "up", 2: "down", 3: "same", 4: "new", 6: "heat" } as const;
  return { type: types[Number(song.rankType) as keyof typeof types] ?? "unknown", value: Number.isFinite(value) ? value : undefined };
}
function kugouTrend(song: Raw): RankTrend {
  const business = r(song.business);
  if (business.last_sort === undefined || business.last_sort === null || !business.sort) return { type: "unknown" };
  const previous = Number(business.last_sort), current = Number(business.sort);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return { type: "unknown" };
  return { type: previous === 0 ? "new" : previous > current ? "up" : previous < current ? "down" : "same", value: Math.abs(previous - current) };
}

function summary(platform: PlaylistPlatform, kind: PlaylistKind, value: Raw): PlaylistSummary {
  const cover = r(value.cover), creator = r(value.creator);
  return {
    platform, kind, id: t(value.id ?? value.topId ?? value.rankid ?? value.global_collection_id),
    name: t(value.name ?? value.title ?? value.rankname ?? value.specialname),
    cover: image(value.coverImgUrl) || image(value.headPicUrl) || image(value.imgurl) || image(value.img) || image(value.img_9) || image(value.pic) || image(cover.default_url),
    description: t(value.description ?? value.desc ?? value.intro), creator: t(creator.nickname ?? creator.nick ?? value.nickname ?? value.list_create_username),
    trackCount: n(value.trackCount ?? value.totalNum ?? value.song_cnt ?? value.songcount ?? value.count), playCount: n(value.playCount ?? value.listenNum ?? value.play_times ?? value.play_count),
    updateFrequency: t(value.updateFrequency ?? value.updateTips),
    tags: Array.isArray(value.tags) ? value.tags.map(tag => typeof tag === "string" ? tag : t(r(tag).name)).filter(Boolean) : rows(value.musiclib_tags).map(tag => t(tag.tag_name)).filter(Boolean),
    createdAt: value.createTime ? n(value.createTime) : value.ctime ? n(value.ctime) * 1000 : value.create_time ? n(value.create_time) * 1000 : undefined,
  };
}

function track(platform: PlaylistPlatform, value: Raw): PlaylistTrack {
  if (platform === "netease") {
    const album = r(value.al ?? value.album);
    return { platform, id: t(value.id), title: t(value.name), artists: rows(value.ar ?? value.artists).map(x => t(x.name)), album: t(album.name), cover: image(album.picUrl), durationMs: n(value.dt ?? value.duration), identifiers: { songId: t(value.id), albumId: t(album.id) } };
  }
  if (platform === "qq") {
    const album = r(value.album);
    return { platform, id: t(value.mid ?? value.songmid ?? value.id), title: t(value.title ?? value.name ?? value.songname), artists: rows(value.singer).map(x => t(x.name)), album: t(album.name), cover: image(album.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${album.mid}.jpg` : undefined), durationMs: n(value.interval) * 1000, identifiers: { songId: t(value.id), mid: t(value.mid ?? value.songmid), albumId: t(album.mid ?? album.id) } };
  }
  const audio = r(value.audio_info), album = r(value.album_info ?? value.albuminfo), trans = r(value.trans_param);
  const hash = t(value.hash ?? audio.hash_128 ?? r(value.deprecated).hash);
  const artists = rows(value.authors ?? value.singerinfo).length ? rows(value.authors ?? value.singerinfo).map(x => t(x.author_name ?? x.name)) : [t(value.author_name ?? value.singername)];
  let title = t(value.songname ?? value.name ?? value.filename);
  if (!value.songname && title.startsWith(artists.join("、") + " - ")) title = title.slice(artists.join("、").length + 3);
  return { platform, id: hash || t(value.album_audio_id ?? value.audio_id), title, artists: artists.filter(Boolean), album: t(album.album_name ?? album.name ?? value.album_name), cover: image(value.cover ?? album.sizable_cover ?? trans.union_cover), durationMs: n(audio.duration_128 ?? value.duration ?? value.timelen ?? value.timelength), identifiers: { songId: t(value.album_audio_id ?? value.audio_id), hash, albumId: t(value.album_id) } };
}

export async function getCharts(platform: PlaylistPlatform): Promise<PlaylistSummary[]> {
  if (platform === "netease") return rows((await neteaseRequest("toplist")).list).map(x => summary(platform, "chart", x));
  if (platform === "qq") {
    const data = await qqRequest("music.musicToplist.Toplist", "GetAll", {});
    return rows(data.group).flatMap(group => rows(group.toplist)).map(x => ({ ...summary(platform, "chart", x), preview: rows(x.song).slice(0, 3).map(song => ({ title: t(song.title), artist: t(song.singerName), cover: image(song.cover), trend: qqTrend(song) })) }));
  }
  const data = r((await kugouRequest("/ocean/v6/rank/list", { plat: 2, withsong: 1, parentid: 0 })).data);
  return rows(data.info).flatMap(x => [x, ...rows(x.children)]).filter(x => x.rankid).map(x => ({ ...summary(platform, "chart", x), preview: rows(x.songinfo).slice(0, 3).map(song => ({ title: t(song.name), artist: t(song.author), cover: image(r(song.trans_param).union_cover) })) }));
}

export async function getCategories(platform: PlaylistPlatform): Promise<PlaylistCategory[]> {
  if (platform === "netease") {
    const data = await neteaseRequest("playlist/catalogue"), groups = r(data.categories);
    return [{ id: "全部", name: "全部", group: "推荐" }, ...rows(data.sub).map(x => ({ id: t(x.name), name: t(x.name), group: t(groups[t(x.category)]) }))];
  }
  if (platform === "qq") {
    const data = await qqRequest("music.playlist.PlaylistSquare", "GetAllTag", { qq: "" });
    return rows(data.v_group).flatMap(group => rows(group.v_item).filter(x => x.name !== "AI歌单").map(x => ({ id: t(x.id), name: t(x.name), group: t(group.group_name) })));
  }
  const data = await kugouRequest("/pubsongs/v1/get_tags_by_type", {}, { tag_type: "collection", tag_id: 0, source: 3 });
  return [{ id: "0", name: "推荐", group: "推荐" }, ...rows(data.data).flatMap(group => rows(group.son).map(x => ({ id: t(x.tag_id), name: t(x.tag_name), group: t(group.tag_name) })))];
}

export async function getPlaylists(platform: PlaylistPlatform, query: PlaylistQuery) {
  const { category, order, limit, offset } = query;
  if (platform === "netease") {
    const data = await neteaseRequest("playlist/list", { cat: category || "全部", order, limit, offset, total: true });
    return page(rows(data.playlists).map(x => summary(platform, "playlist", x)), n(data.total), offset, limit, typeof data.more === "boolean" ? data.more : undefined);
  }
  if (platform === "qq") {
    // This upstream supports category filtering, but no chronological sort parameter.
    if (order === "new") throw new PlaylistError("QQ音乐分类接口暂不支持最新排序，请选择热门", 400);
    const current = Math.floor(offset / limit);
    const data = await qqRequest("music.playlist.PlayListCategory", "get_category_content", { caller: "0", category_id: Number(category || 3317), size: limit, page: current, use_page: 1 });
    const content = r(data.content);
    return page(rows(content.v_item).map(x => { const basic = r(x.basic); return summary(platform, "playlist", { ...basic, id: basic.tid, trackCount: basic.song_cnt, playCount: basic.play_cnt }); }), n(content.total_cnt), offset, limit);
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const time = Math.round(Date.now() / 1000).toString();
      const data = r((await kugouRequest("/v2/special_recommend", {}, {
        appid: 1005, mid: kugouMid, clientver: 12569, platform: "android", clienttime: time, userid: 0, module_id: 1, page: Math.floor(offset / limit) + 1, pagesize: limit, key: kugouListKey(time),
        special_recommend: { withtag: 1, withsong: 1, sort: order === "new" ? 2 : 1, ugc: 1, is_selected: 0, withrecommend: 1, area_code: 1, categoryid: Number(category || 0) }, req_multi: 1, retrun_min: 5, return_special_falg: 1,
      }, { "x-router": "specialrec.service.kugou.com" })).data);
      // Some successful responses contain only OlexpIds. Missing data is an
      // upstream failure, not an empty category; never cache it as an empty page.
      if (!Array.isArray(data.special_list)) throw new PlaylistError("酷狗分类接口返回了不完整数据，请稍后重试");
      const items = rows(data.special_list).map(x => summary(platform, "playlist", x));
      const more = data.has_next === true || data.has_next === 1 || data.has_next === "1";
      const total = Number(data.total);
      const totalKnown = Number.isSafeInteger(total) && total >= offset + items.length;
      return { ...page(items, totalKnown ? total : offset + items.length, offset, limit, more), totalKnown };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function getDetail(platform: PlaylistPlatform, id: string, kind: PlaylistKind, offset: number, limit: number): Promise<PlaylistDetail> {
  if (platform === "netease") {
    const data = await neteaseRequest("v6/playlist/detail", { id, n: 100000, s: 0 });
    const playlist = r(data.playlist);
    if (!playlist.id) throw new PlaylistError("歌单不存在或未公开", 404);
    const ids = rows(playlist.trackIds).slice(offset, offset + limit).map(x => ({ id: x.id }));
    // Public playlist/detail often embeds only a small preview; fetch the requested IDs.
    const songs = ids.length ? rows((await neteaseRequest("v3/song/detail", { c: JSON.stringify(ids) })).songs) : rows(playlist.tracks).slice(offset, offset + limit);
    const ranks = new Map(rows(playlist.trackIds).map(x => [t(x.id), x]));
    return { playlist: summary(platform, kind, playlist), ...page(songs.map(x => {
      const item = track(platform, x), info = ranks.get(item.id);
      if (kind === "chart" && info?.ratio !== undefined && Number.isFinite(Number(info.ratio))) item.trend = { type: "heat", value: Number(info.ratio) };
      return item;
    }), n(playlist.trackCount), offset, limit) };
  }
  if (platform === "qq") {
    if (kind === "chart") {
      const data = await qqRequest("musicToplist.ToplistInfoServer", "GetDetail", { topid: Number(id), offset, num: limit, period: "" });
      const info = r(data.data);
      if (!info.topId) throw new PlaylistError("榜单不存在或暂不可用", 404);
      return { playlist: summary(platform, kind, info), ...page(rows(data.songInfoList).map((x, index) => ({ ...track(platform, x), trend: qqTrend(rows(info.song)[index] ?? {}) })), n(info.totalNum), offset, limit) };
    }
    const data = await qqRequest("music.srfDissInfo.aiDissInfo", "uniform_get_Dissinfo", { disstid: Number(id), userinfo: 1, tag: 1, orderlist: 1, song_begin: offset, song_num: limit, onlysonglist: 0, enc_host_uin: "" });
    const info = r(data.dirinfo);
    if (!info.id) throw new PlaylistError("歌单不存在或未公开", 404);
    return { playlist: summary(platform, kind, { ...info, coverImgUrl: info.picurl, trackCount: info.songnum, playCount: info.listennum, creator: { nickname: info.host_nick } }), ...page(rows(data.songlist).map(x => track(platform, x)), n(info.songnum), offset, limit) };
  }
  if (kind === "chart") {
    const [meta, songs] = await Promise.all([
      kugouRequest("/ocean/v6/rank/info", { rank_cid: 0, rankid: id, with_album_img: 1, zone: "" }),
      kugouRequest("/openapi/kmr/v2/rank/audio", {}, { show_portrait_mv: 1, show_type_total: 1, filter_original_remarks: 1, area_code: 1, pagesize: limit, rank_cid: 0, type: 1, page: Math.floor(offset / limit) + 1, rank_id: id }, { "kg-tid": "369" }),
    ]);
    const data = r(songs.data);
    return { playlist: summary(platform, kind, { ...r(meta.data), rankid: id }), ...page(rows(data.songlist).map(x => ({ ...track(platform, x), trend: kugouTrend(x) })), n(data.total ?? songs.total), offset, limit) };
  }
  const [meta, songs] = await Promise.all([
    kugouRequest("/v3/get_list_info", {}, { data: [{ global_collection_id: id }], userid: 0, token: "" }, { "x-router": "pubsongs.kugou.com" }),
    kugouRequest("/pubsongs/v2/get_other_list_file_nofilt", { area_code: 1, begin_idx: offset, plat: 1, type: 1, mode: 1, personal_switch: 1, extend_fields: "abtags,hot_cmt,popularization", pagesize: limit, global_collection_id: id }),
  ]);
  const info = rows(meta.data)[0] ?? r(meta.data), data = r(songs.data);
  if (!Object.keys(info).length) throw new PlaylistError("歌单不存在或未公开", 404);
  return { playlist: summary(platform, kind, { ...info, global_collection_id: id }), ...page(rows(data.songs ?? data.info ?? data.list).map(x => track(platform, x)), n(data.count ?? data.total ?? info.count), offset, limit) };
}
