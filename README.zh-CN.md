# BAP 示例

[English](README.md) | 中文

本仓库提供 BAP MVP 的浏览器示例和真实 Wallpaper Engine Web Demo：

- `component/`：支持 Standalone/Embedded 的旧版时钟组件示例。
- `host/`：最小 Host 与 Companion mock 浏览器示例。
- `host-wallpaper/`：使用官方 Host SDK 的真实 WE 主壁纸，包含循环视频、可选 BGM、WE 回调、暂停/恢复，以及通过独立 Companion 发现的多个组件。
- `time-widget/`：使用官方 Component SDK 的双模式时间/日期组件。
- `calendar-widget/`：形态不同的双模式月历组件；独立模式使用静态风景图，嵌入模式保持透明背景。
- `assets/ASSET-PROVENANCE.md`：开放许可素材、来源和 SHA-256 记录。

## 构建与运行

```text
npm run build
npm test
npm run serve
```

浏览器示例：

- `http://127.0.0.1:4173/host/`
- `http://127.0.0.1:4173/component/`
- `http://127.0.0.1:4173/host-wallpaper/`
- `http://127.0.0.1:4173/time-widget/`
- `http://127.0.0.1:4173/calendar-widget/`

真实壁纸 Demo 构建后可复制到临时 Wallpaper Engine Web 壁纸项目中。主壁纸使用仓库内的 MDN 花朵视频；如果需要 BGM，可将获得许可的 `bgm.ogg` 放入 `assets/host-wallpaper/`。缺少该文件时，Demo 使用 Web Audio fallback 音调验证静音和音量行为。

`npm run build` 会从相邻的 `host-sdk` 和 `component-sdk` 仓库复制官方 SDK 到 `dist/sdk/`，不会重复实现 SDK 运行时。

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

组件包的 `embedded.html` 在构建时生成自包含文档。宿主通过 Companion 的鉴权
资源接口读取该文档，再使用 Host SDK 的隔离 `srcdoc` 模式挂载。组件文件不会
复制进当前选中的宿主壁纸项目，也不会额外生成 WE item；独立模式入口仍使用
组件包内的资源。

本地双组件联调时，启动 Companion 前将 `BAP_WORKSHOP_ROOTS` 指向
`dist/local-calendar-widget/`，同时设置 `BAP_DISCOVER_STEAM_WORKSHOP=1`
以包含已订阅的时间挂件。未指定显式目录时，Companion 默认自动发现已安装的 Workshop 组件。
Wallpaper Engine 壁纸的 Workshop 发布或更新一律通过官方 WE 编辑器。
