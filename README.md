<div align="center">
  <img src="desktop/app/resource/images/logo/CocoDownloader.png" alt="CoCo Downloader Logo" width="112" height="112" />
  <h1>CoCo Downloader</h1>
  <p>一个覆盖 Web 与桌面端的音乐搜索、播放和下载项目。</p>
</div>

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PyQt5](https://img.shields.io/badge/PyQt5-Desktop-41cd52)
![QFluentWidgets](https://img.shields.io/badge/QFluentWidgets-UI-0078d4)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

## 项目定位

CoCo Downloader 不是单一页面应用，而是一组围绕“音乐检索与获取体验”组织的 Web 与桌面客户端实现。

仓库当前包含两条主线：

- `src/`：主 Web 应用，提供音乐搜索、在线试听、批量下载、播放栏和主题体验。
- `desktop/`：PyQt5 桌面端，提供原生窗口、搜索列表、播放栏、下载任务管理和本地配置能力。

Web 端适合浏览器和 Docker 部署；桌面端适合打包成 Windows 安装包或便携版。

## 功能概览

### Web 应用

- 多音源聚合搜索
- 在线播放与底部播放器
- 播放、暂停、上一曲、下一曲、进度拖动、音量控制和播放模式切换
- 批量下载与下载抽屉
- JOOX 音质选择弹窗
- 深色 / 浅色主题切换
- 基于 Next.js App Router 的 API Routes

### 桌面端

`desktop/` 是 PyQt5 桌面客户端，核心体验更接近本地音乐工具。

主要能力：

- 搜索音乐并展示结果列表
- 播放、暂停、上一曲、下一曲、播放模式切换
- 播放进度拖动与音量控制
- 单曲下载与下载任务展示
- 下载目录和文件命名规则配置
- 浅色 / 深色 / 跟随系统主题
- 用户配置保存到系统 AppData 目录
- 支持 Nuitka 打包和 Inno Setup 安装包制作

## 架构解析

```text
coco-downloader/
├─ src/                         # 主 Web 应用
│  ├─ app/                      # Next.js App Router 页面与 API Routes
│  │  ├─ api/download/          # 下载接口
│  │  ├─ api/search/            # 搜索接口
│  │  └─ api/url/               # 播放直链接口
│  ├─ components/               # Web UI 组件
│  ├─ lib/providers/            # 音源 provider 策略实现
│  └─ types/                    # TypeScript 类型
├─ desktop/                     # PyQt5 桌面端
│  ├─ CoCo-downloader.py        # 桌面端入口
│  ├─ app/common/               # 配置、资源、信号总线和样式管理
│  ├─ app/components/           # 播放栏、搜索卡片、下载任务卡片等复用组件
│  ├─ app/services/             # 搜索、下载、播放和 provider 服务
│  ├─ app/view/                 # 主窗口、首页、下载页、设置页
│  └─ app/resource/             # qrc、qss、图片、翻译资源
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

### Web 端分层

Web 主应用把“页面交互”和“音源解析”拆开：

- `src/app/page.tsx` 负责组织首页体验。
- `src/components/PlayerBar.tsx`、`DownloadDrawer.tsx`、`QualitySelectModal.tsx` 等组件承载交互界面。
- `src/app/api/*` 是浏览器调用的服务入口。
- `src/lib/providers/impl/*` 是各个音源的实际解析实现。

这种结构让前端不直接关心每个音源的细节。新增音源时，优先在 `providers` 层补实现，再在统一入口注册。

### 桌面端分层

桌面端按 Qt 应用常见边界拆分：

- `view/`：页面和窗口，如主窗口、首页、下载页、设置页。
- `components/`：可复用 UI 组件，如播放栏、搜索卡片、下载任务卡片。
- `services/`：业务服务，如搜索服务、下载服务、播放服务。
- `services/providers/`：不同音源 provider。
- `common/`：配置、资源、样式、信号总线等基础设施。
- `models/`：音乐数据模型。

配置文件通过 `QStandardPaths.AppDataLocation` 写入用户级 AppData 目录，避免打包后写入安装目录。

## 快速开始

### Web 主应用

```bash
npm install
npm run dev
```

默认访问：

```text
http://localhost:3000
```

生产构建：

```bash
npm run build
npm run start
```

### Docker

```bash
docker compose up -d
```

或直接运行镜像：

```bash
docker run -d -p 3000:3000 --name coco-downloader markcxx/coco-downloader:latest
```

### 桌面端

建议使用 Python 3.12，并为桌面端单独创建虚拟环境。Windows PowerShell：

```powershell
cd desktop
uv venv .venv --python 3.12
uv pip install --python .venv/Scripts/python.exe -r requirements-lock.txt
.\.venv\Scripts\python.exe CoCo-downloader.py
```

已有上述环境时直接运行启动命令，无需重复创建；`.venv` 是 uv 管理的项目环境目录。
`requirements.txt` 是直接依赖列表，`requirements-lock.txt` 记录本次 Windows Python 3.12 验证环境。

桌面回归测试（模拟网络响应，不下载第三方音乐）：

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

如果修改了 `resource.qrc`，需要重新生成 Qt 资源文件：

```bash
python -m PyQt5.pyrcc_main app/resource/resource.qrc -o app/common/resource.py
```

Windows 打包：

```powershell
cd desktop
.\.venv\Scripts\python.exe deploy.py
$env:APP_VERSION = '0.0.3'
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" CoCo-downloader.iss
```

Windows 编译使用本机 MSVC（Visual Studio C++ Build Tools），默认 4 个编译任务。
Nuitka 生成 `desktop/build/CoCo-downloader.dist` 后，使用 Inno Setup 6.5 或更高版本编译安装脚本。
安装工具：`winget install --id JRSoftware.InnoSetup -e --source winget`。
打开下列 `.iss` 文件并点击 Compile，或使用安装目录中的 `ISCC.exe` 编译。

安装包脚本位于：

```text
desktop/CoCo-downloader.iss
```

安装包输出到 `desktop/dist/`。简体中文语言文件随仓库提供，来源为
[Inno Setup 6.7.3 官方仓库](https://github.com/jrsoftware/issrc/blob/is-6_7_3/Files/Languages/Unofficial/ChineseSimplified.isl)。

## 音源说明

### 桌面端渠道实测（2026-10-11）

本次使用“晴天”和“稻香”分别搜索，每个渠道抽取前两条结果，校验音频文件头；
另对每个有可用音频的渠道至少一首歌曲执行静音 Qt 播放，确认播放进度实际推进。
这代表测试样本通过，不保证全部歌曲、全部音质或之后的服务可用性。

| 状态 | 渠道 | 实测结果 |
| --- | --- | --- |
| 样本通过 | 云音乐、QQ、酷狗、歌曲海、波点、QQMP3、煎饼1–4 | 两个关键词均返回歌曲与有效音频；Qt 实播通过 |
| 部分可用 | 咪咕 | 两个关键词的 Live 版本可用，原版仍返回服务错误；失败不再当作音频交给播放器 |
| 未恢复 | 力音 | 官网对“晴天、稻香、周杰伦”均返回空结果，没有可验证的播放样本 |

修复包括：煎饼访客会话初始化、波点主备解析、咪咕音频响应校验和音质回退、QQ 的 MP3 试听策略，以及 QQMP3 试听入口。
0.0.3 同步修复 Web：歌曲海改用当前搜索入口并保留播放会话，QQMP3 校验音频后自动切换备用接口。
桌面端使用 QFluentWidgets InfoBar 提示搜索、播放、下载和未捕获 Python 异常；Web 对应显示 Toast。
两端首页均说明第三方渠道稳定性限制。桌面异常日志位于应用配置目录的 `app.log`。
QQ 下载仍按高音质优先，试听使用 Qt5 可正常播放的 MP3 流。
原始结果保存在 `desktop/diagnostics/provider-status-2026-10-11.json`。
追加桌面复测见 `desktop/diagnostics/provider-followup-2026-10-11.json`；
Web 实际音频与封面验证见 `desktop/diagnostics/web-provider-status-2026-10-11.json`。

在 `desktop` 目录重新实测（会联网，静音播放片段）：

```powershell
.\.venv\Scripts\python.exe tools/probe_providers.py --playback
```

使用 `--query 稻香` 更换关键词，`--only qq bodian` 指定渠道，`--output build/results.json` 指定报告路径。

项目内聚合了多个第三方音乐搜索与解析来源。当前代码中包含的 provider 主要包括：

- 爱听
- 波点音乐
- 布谷音乐
- 歌曲宝
- 歌曲海
- 煎饼音乐系列（支持多平台解析）
- JOOX
- 米兔音乐
- LivePoo
- 咪咕音乐
- cenguigui解析（cenguigui API）
- 海棠解析（haitang API）
- XCVTS解析（xcvts/cyapi/vkeys API）
- QQMP3

不同音源的可用性、音质和返回字段会随第三方站点变化而变化。项目通过 provider 层隔离这些差异，尽量把上层 UI 和 API 保持稳定。

## 技术栈

### 服务器自动部署

推送 `main` 后，`.github/workflows/docker-push.yml` 构建并发布镜像，再通过 SSH 部署该提交 SHA 对应的镜像。标签推送仅发布镜像。
GitHub `production` Environment 需配置 `DEPLOY_HOST`、`DEPLOY_PORT`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`。
服务器部署文件位于 `/home/ubuntu/coco-deploy`，独立 Compose 项目名为 `coco-downloader`，绑定 `127.0.0.1:3004`。
部署会等待 HTTP 健康检查，失败时恢复旧镜像；首次迁移保留旧容器直到新服务健康。不修改同机博客或反向代理。
SSH 密钥存放于 GitHub 加密 Secrets，仓库不保存服务器密码或私钥。
与 MarkAI 相同，Actions 每次上传 `deploy/compose.yaml` 和 `deploy/deploy.sh`，再通过 SSH 登录镜像仓库并执行部署。

### Web

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion / motion
- Lucide React
- Axios
- Cheerio

### Desktop

- Python
- PyQt5
- PyQt-Fluent-Widgets
- PyQt5-Frameless-Window
- Nuitka
- Inno Setup


## 致谢

桌面端界面基于 [QFluentWidgets](https://github.com/zhiyiYo/PyQt-Fluent-Widgets) 构建。QFluentWidgets 为 PyQt/PySide 提供了 Fluent Design 风格的组件、设置卡片、导航、主题和图标体系，让桌面端能够以较低成本获得现代化的 Windows 应用体验。

感谢LINUXDO社区提供的帮助：https://linux.do/
感谢开源项目musicdl的部分接口支持： https://github.com/CharlesPikachu/musicdl

## 免责声明

1. 本项目仅供个人学习、技术研究与交流使用，严禁用于商业用途。
2. 项目不存储任何音乐文件，所有音乐内容均来自第三方公开API接口。
3. 项目中使用的所有音源接口均为第三方服务提供。
4. 第三方音源的可用性、数据准确性和版权状态不由本项目保证。
6. 请勿将本项目用于任何违反当地法律法规的行为，请尊重音乐版权。
7. 如本项目内容侵犯了您的权益，请通过 GitHub Issues 联系处理，我们会及时响应。
8. **下载的音乐文件仅供个人学习研究使用，，请支持正版音乐。**

## 许可证

本项目使用 MIT License。
