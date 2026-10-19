# BAP 示例

[English](README.md) | 简体中文

本仓库提供一个无需额外依赖、可在浏览器中运行的 BAP MVP 示例：

- `component/`：同时支持 Standalone 和 Embedded 模式的时钟/状态组件；
- `host/`：通过 iframe 嵌入组件的最小 Host；
- `companion/`：用于配置和组件发现的本地 HTTP mock；
- `shared/protocol.js`：两端共用的消息信封辅助模块。

示例体现了 `internal-docs` 中确定的 MVP 方案：iframe + `postMessage`、
请求/响应与事件、配置、生命周期和暂停/恢复。示例故意只使用平台 API，
方便在官方 SDK 发布前检查和改造。

## 运行

```text
npm test
npm run build
npm run serve
```

打开 `http://127.0.0.1:4173/host/` 查看 Embedded 示例。Host 会在
`http://127.0.0.1:4173/api/` 启动 Companion mock；Companion 面板可以读取
和保存组件配置。直接打开 `/component/` 可以查看 Standalone Mode。

构建输出写入 `dist/`，该目录被 git 忽略。
