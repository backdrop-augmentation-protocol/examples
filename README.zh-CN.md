# BAP 示例

[English](README.md) | 中文

本仓库提供 BAP MVP 的浏览器示例和真实 Wallpaper Engine Web Demo：

- `component/`：支持 Standalone/Embedded 的旧版时钟组件示例。
- `host/`：最小 Host 与 Companion mock 浏览器示例。
- `host-wallpaper/`：使用官方 Host SDK 的真实 WE 主壁纸，包含循环视频、可选 BGM、WE 回调、暂停/恢复，以及通过独立 Companion 发现的组件。
- `time-widget/`：使用官方 Component SDK 的双模式时间/日期组件。
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

真实壁纸 Demo 构建后可复制到临时 Wallpaper Engine Web 壁纸项目中。主壁纸使用仓库内的 MDN 花朵视频；如果需要 BGM，可将获得许可的 `bgm.ogg` 放入 `assets/host-wallpaper/`。缺少该文件时，Demo 使用 Web Audio fallback 音调验证静音和音量行为。

`npm run build` 会从相邻的 `host-sdk` 和 `component-sdk` 仓库复制官方 SDK 到 `dist/sdk/`，不会重复实现 SDK 运行时。

## 隐藏 Workshop 测试项目

`npm run build` 会生成两个相互独立的 Wallpaper Engine 项目目录：
`dist/workshop-host-wallpaper/` 和 `dist/workshop-time-widget/`。两者分别包含
`project.json`、所需 SDK 和媒体资源。宿主包不再内置组件或 Companion 服务，
只保留连接独立 Windows Companion 的轻量客户端。Companion 不可用时，视频壁纸仍可运行，
但不会挂载组件。

本地联调时，启动 Companion 前将 `BAP_WORKSHOP_ROOTS` 指向独立的时间组件项目目录。
如需发现已订阅的 Workshop 组件，可设置 `BAP_DISCOVER_STEAM_WORKSHOP=1`；若 Steam 不在默认安装位置，
还需设置 `BAP_STEAM_ROOT`。Wallpaper Engine 壁纸的 Workshop 发布或更新一律通过官方 WE 编辑器。
