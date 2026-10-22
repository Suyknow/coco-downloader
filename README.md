<div align="center">
  <img src="desktop/app/resource/images/logo/CocoDownloader.png" alt="CoCo Downloader Logo" width="112" height="112" />
  <h1>CoCo Downloader</h1>
  <p>支持 Web 与 Windows 桌面端的音乐搜索、播放和下载工具。</p>

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PyQt5](https://img.shields.io/badge/PyQt5-Desktop-41cd52)
![QFluentWidgets](https://img.shields.io/badge/QFluentWidgets-UI-0078d4)
![License](https://img.shields.io/badge/License-MIT-green)

[下载桌面客户端](https://github.com/markcxx/coco-downloader/releases)

</div>

## 功能介绍

### Web 端

- **歌曲搜索**：按音乐平台和渠道搜索歌曲、歌手与专辑，支持结果筛选和多选。
- **发现歌单**：浏览网易云音乐、QQ 音乐和酷狗音乐的分类歌单，通过分享链接导入公开歌单。
- **排行榜**：在发现页面切换至排行榜，选择平台查看榜单及歌曲趋势。
- **在线播放**：支持播放、暂停、上一曲、下一曲、进度拖动、音量控制和播放模式切换。
- **音乐下载**：支持单曲下载、批量下载、音质选择和下载任务管理，具体能力随所选渠道而定。
- **渠道切换**：歌单播放与下载优先使用同平台可直接解析歌曲标识的渠道，失败后尝试其他渠道。
- **主题切换**：支持浅色与深色主题。

### 桌面端

- 按平台和渠道搜索歌曲，支持在线试听与播放列表操作。
- 播放进度拖动、音量调节和播放模式切换。
- 单曲与批量下载、音质选择和下载任务管理。
- 自定义下载目录与文件命名规则。
- 浅色、深色和跟随系统主题。
- 保存用户配置，记录运行日志。
- 支持 Nuitka 打包与 Inno Setup 安装包构建。

## 平台与渠道

| 音乐平台 | 渠道 |
| --- | --- |
| 网易云音乐 | Meting、51ape、煎饼 |
| QQ 音乐 | VKeys、51ape、煎饼 |
| 酷狗音乐 | 90svip、煎饼 |
| 酷我音乐 | 波点 · 天宝、米兔（QQMP3）、煎饼、歌曲海、力音 · 网盘下载 |

搜索框中的平台菜单用于选择具体渠道。发现歌单中的平台筛选用于浏览该平台的歌单资料。

## 快速开始

### Web 开发

使用 Node.js 20.9 或更高版本，在项目根目录执行：

```bash
npm ci
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

生产环境运行：

```bash
npm run build
npm run start
```

### Docker 部署

使用仓库提供的 Compose 配置：

```bash
docker compose up -d
```

默认使用 `markcxx/coco-downloader:latest` 镜像并监听 `3000` 端口，可通过 `PORT` 环境变量调整端口。

### 桌面端开发

使用 Python 3.12 与 uv。首次配置环境时，在项目根目录打开 PowerShell，执行：

```powershell
cd desktop
uv venv --python 3.12
uv pip install -r requirements-lock.txt
```

已有环境时，在 `desktop` 目录直接启动：

```powershell
.\.venv\Scripts\python.exe CoCo-downloader.py
```

修改 Qt 资源后，在同一目录重新生成资源文件：

```powershell
.\.venv\Scripts\python.exe -m PyQt5.pyrcc_main app/resource/resource.qrc -o app/common/resource.py
```

### Windows 打包

安装 Visual Studio C++ Build Tools 与 Inno Setup，在 `desktop` 目录执行 Nuitka 打包脚本：

```powershell
.\.venv\Scripts\python.exe deploy.py
```

程序输出到 `desktop/build/CoCo-downloader.dist/`。随后用 Inno Setup 打开并编译 `desktop/CoCo-downloader.iss`，安装包输出到 `desktop/dist/`。

安装包版本可通过 `APP_VERSION` 环境变量设置，应与桌面程序版本保持一致。

## 项目结构

```text
coco-downloader/
├─ src/
│  ├─ app/                  # Web 页面与 API 路由
│  ├─ components/           # 共用界面组件
│  ├─ lib/
│  │  ├─ providers/         # 搜索与音频解析渠道
│  │  └─ playlists/         # 歌单、榜单与平台资料
│  └─ types/                # TypeScript 类型定义
├─ desktop/
│  ├─ CoCo-downloader.py    # 桌面程序入口
│  ├─ app/                  # 桌面界面、服务、配置与资源
│  ├─ deploy.py             # Nuitka 打包脚本
│  └─ CoCo-downloader.iss   # Inno Setup 安装脚本
├─ docs/                    # 开发文档
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

## 技术栈

| 部分 | 主要技术 |
| --- | --- |
| Web | Next.js、React、TypeScript、Tailwind CSS、Ant Design、Framer Motion |
| 桌面端 | Python、PyQt5、QFluentWidgets、PyQt5-Frameless-Window |
| 构建与部署 | Docker、Nuitka、Inno Setup |

## 致谢

- [QFluentWidgets](https://github.com/zhiyiYo/PyQt-Fluent-Widgets)：桌面端 Fluent Design 界面组件。
- [musicdl](https://github.com/CharlesPikachu/musicdl)：部分接口实现参考。
- [LINUX DO](https://linux.do/)：社区支持与帮助。

## 使用说明

音乐内容来自第三方服务，本项目不存储音乐文件。请遵守相关平台规则，尊重音乐版权并支持正版音乐。

## 许可证

本项目使用 MIT License。
