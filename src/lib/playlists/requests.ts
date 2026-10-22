import { createHash } from "node:crypto";
import { metadataHttp, record, text, PlaylistError, type Raw } from "./shared";

export async function neteaseRequest(path: string, params: Raw = {}) {
  const { data } = await metadataHttp.get(`https://music.163.com/api/${path}`, { params, headers: { Referer: "https://music.163.com/" } });
  const result = record(data);
  if (result.code !== 200) throw new PlaylistError(text(result.message) || "网易云歌单资料暂不可用");
  return result;
}

export async function qqRequest(module: string, method: string, param: Raw) {
  const { data } = await metadataHttp.post("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    comm: { ct: 24, cv: 0, format: "json", uin: 0 }, req_0: { module, method, param },
  }, { headers: { Referer: "https://y.qq.com/" } });
  const result = record(data), response = record(result.req_0);
  if (result.code !== 0 || response.code !== 0) throw new PlaylistError("QQ音乐歌单资料暂不可用");
  return record(response.data);
}

const md5 = (value: string) => createHash("md5").update(value).digest("hex");
const androidKey = "OIlwieks28dk2k092lksi2UIkp";
export const kugouListKey = (time: string) => md5(`1005${androidKey}12569${time}`);
export const kugouMid = md5("-");

// Signature and public metadata parameters follow MakcRe/KuGouMusicApi (MIT).
export async function kugouRequest(path: string, params: Raw = {}, body?: Raw, headers: Record<string, string> = {}) {
  const query: Raw = { dfid: "-", mid: kugouMid, uuid: md5(`-${kugouMid}`), appid: 1005, clientver: 12569, userid: 0, clienttime: Math.floor(Date.now() / 1000), ...params };
  const payload = body ? JSON.stringify(body) : "";
  query.signature = md5(androidKey + Object.keys(query).sort().map(key => `${key}=${query[key]}`).join("") + payload + androidKey);
  const { data } = await metadataHttp.request({
    url: `https://gateway.kugou.com${path}`, params: query, method: body ? "POST" : "GET", data: payload || undefined,
    headers: { "User-Agent": "Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi", "Content-Type": "application/json", dfid: "-", mid: kugouMid, clienttime: text(query.clienttime), ...headers },
  });
  const result = record(data);
  if (!Object.keys(result).length || result.status === 0 || (result.error_code !== undefined && result.error_code !== 0)) throw new PlaylistError(text(result.error) || text(result.errmsg) || "酷狗歌单资料暂不可用");
  return result;
}
