# BAP 示例

[English](README.md) | 中文

本仓库提供 BAP MVP 的浏览器示例和真实 Wallpaper Engine Web Demo：

- `component/`：支持 Standalone/Embedded 的旧版时钟组件示例。
- `host/`：最小 Host 与 Companion mock 浏览器示例。
- `host-wallpaper/`：使用官方 Host SDK 的真实 WE 主壁纸，包含循环视频、可选 BGM、WE 回调、暂停/恢复和 iframe 组件故障隔离。
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
