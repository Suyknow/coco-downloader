# coding: utf-8
from .base import MusicProvider
from .at38 import At38Provider
from .gequhai import GequhaiProvider
from .bodian import BodianProvider
from .jianbin import JianbinProvider
from .kugou import KugouProvider
from .livepoo import LivepooProvider
from .netease_official import NeteaseOfficialProvider
from .qq import QQProvider
from .qqmp3 import QQMp3Provider

PROVIDERS: dict[str, MusicProvider] = {
    "netease": NeteaseOfficialProvider(),
    "at38-netease": At38Provider("at38-netease", "wy"),
    "at38-qq": At38Provider("at38-qq", "qq"),
    "kugou": KugouProvider(),
    "bodian": BodianProvider(),
    "gequhai": GequhaiProvider(),
    "qq": QQProvider(),
    "qqmp3": QQMp3Provider(),
    "livepoo": LivepooProvider(),
    "jianbin-netease": JianbinProvider("jianbin-netease", "netease"),
    "jianbin-qq": JianbinProvider("jianbin-qq", "qq"),
    "jianbin-kugou": JianbinProvider("jianbin-kugou", "kugou"),
    "jianbin-kuwo": JianbinProvider("jianbin-kuwo", "kuwo"),
}

# Keep provider IDs stable for saved playlists; group their labels by music service.
PROVIDER_GROUPS = {
    "网易云音乐": [("Meting", "netease"), ("51ape", "at38-netease"), ("煎饼", "jianbin-netease")],
    "QQ音乐": [("VKeys", "qq"), ("51ape", "at38-qq"), ("煎饼", "jianbin-qq")],
    "酷狗音乐": [("煎饼", "jianbin-kugou"), ("90svip", "kugou")],
    "酷我音乐": [("波点 · 天宝", "bodian"), ("米兔（QQMP3）", "qqmp3"),
             ("煎饼", "jianbin-kuwo"), ("歌曲海", "gequhai"), ("力音 · 网盘下载", "livepoo")],
    "咪咕音乐": [],
}
PROVIDER_DISPLAY_NAMES = {
    f"{platform} / {label}": provider_id
    for platform, channels in PROVIDER_GROUPS.items() for label, provider_id in channels
}
# Older labels are still accepted when loading saved settings.
LEGACY_PROVIDER_NAMES = {
    "酷狗音乐 / 90svip（本地网络）": "kugou",
    "云音乐": "netease", "QQ音乐（VKeys）": "qq", "酷狗音乐（90svip）": "kugou",
    "歌曲海": "gequhai", "波点": "bodian", "QQMP3": "qqmp3", "力音": "livepoo",
    "煎饼-1": "jianbin-netease", "煎饼-2": "jianbin-qq",
    "煎饼-3": "jianbin-kugou", "煎饼-4": "jianbin-kuwo",
}


def get_provider(name: str = "netease") -> MusicProvider:
    provider_key = PROVIDER_DISPLAY_NAMES.get(name, LEGACY_PROVIDER_NAMES.get(name, name))
    if provider_key == "qq-official":
        provider_key = "qq"  # Compatibility with existing playlist items.
    if provider_key not in PROVIDERS:
        raise ValueError(f"不支持的音源：{name}")
    return PROVIDERS[provider_key]


def get_all_providers() -> list[MusicProvider]:
    return list(PROVIDERS.values())


__all__ = [
    "MusicProvider",
    "PROVIDER_DISPLAY_NAMES",
    "PROVIDER_GROUPS",
    "get_all_providers",
    "get_provider",
]
