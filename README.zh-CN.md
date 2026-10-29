# BAP 示例

[English](README.md) | 中文

本仓库提供 BAP MVP 的浏览器示例和真实 Wallpaper Engine Web Demo：

- `host-wallpaper/`：使用官方 Host SDK 的真实 WE 主壁纸，包含循环视频、可选 BGM、WE 回调、暂停/恢复，以及通过独立 Companion 发现的多个组件。
- `time-widget/`：使用官方 Component SDK 的双模式时间/日期组件。
- `calendar-widget/`：形态不同的双模式月历组件；独立模式使用静态风景图，嵌入模式保持透明背景。
- `assets/ASSET-PROVENANCE.md`：开放许可素材、来源和 SHA-256 记录。
- `companion/client.js`：连接单独安装的 Companion 软件，而非提供另一套协议实现。

## 构建与运行

```text
npm run build
npm test
npm run serve
```

浏览器示例：

- `http://127.0.0.1:4173/host-wallpaper/`
- `http://127.0.0.1:4173/time-widget/`
- `http://127.0.0.1:4173/calendar-widget/`

真实壁纸 Demo 构建后可复制到临时 Wallpaper Engine Web 壁纸项目中。主壁纸使用仓库内的 MDN 花朵视频；如果需要 BGM，可将获得许可的 `bgm.ogg` 放入 `assets/host-wallpaper/`。缺少该文件时，Demo 使用 Web Audio fallback 音调验证静音和音量行为。

`npm ci` 会安装 `package-lock.json` 中记录的已发布 BAP Host SDK 和 Component SDK。构建时会将这些官方 SDK 文件复制到自包含的 Demo 和 Workshop 项目包中。构建产物写入 `dist/`，并由 Git 忽略。

## 隐藏 Workshop 测试项目

`npm run build` 会生成三个相互独立的 Wallpaper Engine 项目目录：
`dist/workshop-host-wallpaper/`、`dist/workshop-time-widget/` 和
`dist/workshop-calendar-widget/`。三者分别包含
`project.json`、所需 SDK 和媒体资源。宿主包不内置任何组件或 Companion 服务，
只保留连接独立 Windows Companion 的轻量客户端。Companion 不可用时，视频壁纸仍可运行，
但不会挂载组件。

`dist/local-calendar-widget/` 是独立的本地组件包，具有不同的组件 ID，且不含
`project.json`；它仅用于本地双组件测试。另有 `dist/workshop-calendar-widget/`
包含符合现有项目模板的 WE 元数据、独立预览图和风景素材，可通过 WE 官方编辑器发布。
仅构建或复制该目录不会在线发布。

每次通过官方编辑器发布或更新 Workshop item 前运行 `npm test`。它会对三个生成包
同时执行示例项目自己的元数据策略与 BAP 通用的 WE Web/Workshop 分发检查。
仅在本地开发时，可以只运行 `npm run build`，不执行额外的分发预检查。

组件包的 `embedded.html` 在构建时生成自包含文档。宿主通过 Companion 的鉴权
资源接口读取该文档，再使用 Host SDK 的隔离 `srcdoc` 模式挂载。组件文件不会
复制进当前选中的宿主壁纸项目，也不会额外生成 WE item；独立模式入口仍使用
组件包内的资源。

本地双组件联调时，启动 Companion 前将 `BAP_LOCAL_ROOTS` 指向
`dist/local-calendar-widget/`；已订阅组件会同时自动发现。宿主按当前 Companion
预设增减组件，并按预设顺序自动布局，不打包组件副本。新生成的宿主包带有 Host
Manifest；尚未通过编辑器更新的旧订阅示例由 Companion 的过渡映射识别。
官方宿主遵循统一 Companion 策略：授权等待由 Companion 服务端期限控制（默认 300 秒）；
重连从 3 秒开始指数退避，最多 30 秒并带随机抖动；连接期间每 1.5 秒刷新有效预设。
断连会卸载嵌入式组件，但保持壁纸继续运行。
Wallpaper Engine 壁纸的 Workshop 发布或更新一律通过官方 WE 编辑器。
