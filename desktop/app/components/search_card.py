# coding: utf-8
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import QVBoxLayout, QHBoxLayout, QLabel, QToolButton, QMenu

from qfluentwidgets import CaptionLabel, IndeterminateProgressBar, SearchLineEdit, SimpleCardWidget, setFont
from app.services.providers import PROVIDER_DISPLAY_NAMES, PROVIDER_GROUPS


class ChannelMenuButton(QToolButton):
    """Music platform menu with a submenu for each search channel."""

    currentTextChanged = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._provider_id = "netease"
        self._actions = {}
        menu = QMenu(self)
        menu.setToolTipsVisible(True)
        for platform, channels in PROVIDER_GROUPS.items():
            submenu = menu.addMenu(platform)
            submenu.setToolTipsVisible(True)
            if not channels:
                submenu.addAction("暂无可用渠道（解析异常，暂时停用）").setEnabled(False)
            for label, provider_id in channels:
                action = submenu.addAction(label)
                action.setCheckable(True)
                action.setChecked(provider_id == self._provider_id)
                if provider_id == "livepoo":
                    action.setToolTip("前往源站使用网盘保存，不支持试听或自动批量下载")
                elif provider_id == "kugou":
                    action.setToolTip("机房 IP 可能被拦截，建议使用本地网络客户端")
                else:
                    action.setToolTip("客户端支持直接下载与批量下载")
                action.triggered.connect(lambda checked=False, key=provider_id: self._select_channel(key))
                self._actions[provider_id] = action
        self.setMenu(menu)
        self.setPopupMode(QToolButton.InstantPopup)
        self.setText("网易云音乐")

    def currentData(self):
        return self._provider_id

    def _select_channel(self, provider_id):
        self._provider_id = provider_id
        for key, action in self._actions.items():
            action.setChecked(key == provider_id)
        label = next(name for name, key in PROVIDER_DISPLAY_NAMES.items() if key == provider_id)
        self.setText(label.split(" / ", 1)[0])
        self.setToolTip(label)
        self.currentTextChanged.emit(label)


class SearchCard(SimpleCardWidget):
    """Search card with search input and platform selector"""

    searchRequested = pyqtSignal(str, str)
    platformChanged = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumHeight(250)

        self.vBoxLayout = QVBoxLayout(self)
        self.titleLabel = QLabel(self.tr("发现你的音乐世界"), self)
        self.descLabel = QLabel(
            self.tr("无论是熟悉的旋律，还是未知的惊喜，都在这里等你探索 ✨"),
            self
        )

        self.searchLayout = QHBoxLayout()
        self.searchInput = SearchLineEdit(self)
        self.platformComboBox = ChannelMenuButton(self)
        self.progressBar = IndeterminateProgressBar(self)
        self.previewHintLabel = CaptionLabel(self.tr("力音当前提供网盘入口，请前往源站保存；不支持试听或批量下载"), self)
        self.stabilityLabel = CaptionLabel(self.tr("搜索、播放与下载依赖第三方渠道的稳定性，不保证持续有效；失败时请重试或切换渠道。"), self)
        self.stabilityLabel.setWordWrap(True)
        self.stabilityLabel.setAlignment(Qt.AlignCenter)

        self._init_ui()
        self._connect_signals()

    def _init_ui(self):
        setFont(self.titleLabel, 24, QFont.Weight.Bold)
        setFont(self.descLabel, 14, QFont.Weight.Normal)

        self.titleLabel.setObjectName('titleLabel')
        self.descLabel.setObjectName('descLabel')
        self.titleLabel.setAlignment(Qt.AlignCenter)
        self.descLabel.setAlignment(Qt.AlignCenter)

        self.searchInput.setPlaceholderText(self.tr("搜索歌曲、歌手或专辑..."))
        self.searchInput.setFixedHeight(40)
        self.searchInput.searchSignal.connect(self._on_search)

        self.platformComboBox.setFixedWidth(245)
        self.platformComboBox.setFixedHeight(40)

        self.searchLayout.setSpacing(12)
        self.searchLayout.addWidget(self.searchInput, 1)
        self.searchLayout.addWidget(self.platformComboBox)

        self.progressBar.hide()
        self.progressBar.pause()
        self.previewHintLabel.hide()
        self.previewHintLabel.setAlignment(Qt.AlignCenter)

        self.vBoxLayout.setContentsMargins(24, 24, 24, 24)
        self.vBoxLayout.setSpacing(12)
        self.vBoxLayout.addWidget(self.titleLabel)
        self.vBoxLayout.addWidget(self.descLabel)
        self.vBoxLayout.addSpacing(8)
        self.vBoxLayout.addLayout(self.searchLayout)
        self.vBoxLayout.addWidget(self.stabilityLabel)
        self.vBoxLayout.addWidget(self.previewHintLabel)
        self.vBoxLayout.addWidget(self.progressBar)

    def _connect_signals(self):
        self.searchInput.returnPressed.connect(self._on_return_pressed)
        self.platformComboBox.currentTextChanged.connect(self._on_platform_changed)

    def _on_search(self, keyword: str):
        """Handle search action"""
        if keyword.strip():
            platform = self.platformComboBox.currentData()
            self.searchRequested.emit(keyword, platform)

    def _on_return_pressed(self) -> None:
        """Search with the same behavior as the search button."""
        self._on_search(self.searchInput.text())

    def clear_search(self):
        """Clear search input"""
        self.searchInput.clear()

    def set_searching(self, searching: bool) -> None:
        """Show or hide the indeterminate search progress bar"""
        self.progressBar.setVisible(searching)
        if searching:
            self.progressBar.resume()
        else:
            self.progressBar.pause()

    def set_controls_enabled(self, enabled: bool) -> None:
        """Enable or disable search controls while keeping status widgets active"""
        self.searchInput.setEnabled(enabled)
        self.platformComboBox.setEnabled(enabled)

    def set_preview_hint_visible(self, visible: bool) -> None:
        """Show unsupported-preview hint below the search box"""
        self.previewHintLabel.setVisible(visible)

    def _on_platform_changed(self, platform: str) -> None:
        provider_id = self.platformComboBox.currentData()
        hints = {
            "livepoo": "力音当前提供网盘入口，需前往源站保存；不支持试听或批量下载。",
            "kugou": "90svip 可能拦截机房 IP，建议在本地网络使用客户端。",
            "gequhai": "搜索歌曲海曲库，客户端支持直接下载和批量下载。",
        }
        label = next((name for name, key in PROVIDER_DISPLAY_NAMES.items() if key == provider_id), provider_id)
        self.stabilityLabel.setText(f"{label} · {hints.get(provider_id, '客户端支持直接下载和批量下载；渠道失败时请尝试同平台的其他渠道。')}")
        self.platformChanged.emit(provider_id)
