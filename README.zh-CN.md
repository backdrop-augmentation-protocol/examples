# BAP 示例

[English](README.md) | 中文

本仓库提供一个可在浏览器中运行的 BAP MVP 集成示例：

- `component/` 是支持 Standalone/Embedded 双模式的时钟组件；
- `host/` 使用官方 `host-sdk` 的 `HostRuntime` 挂载 iframe；
- `component/` 使用官方 `component-sdk` 的 `ComponentRuntime`；
- `companion/` 是提供配置读写和健康检查的本地 HTTP mock；
- `shared/protocol.js` 仅是官方 SDK 传输映射和 Core Profile 信封的适配层，不是第二套协议定义。

示例覆盖 iframe + `postMessage`、请求/响应与事件、配置、生命周期、暂停/恢复以及 Companion 配置持久化。构建时会把相邻官方 SDK 仓库的发布文件复制到 `dist/sdk/`，示例不会重新实现 SDK 的运行时行为。

## 运行

```text
npm run build
npm test
npm run serve
```

`npm run build` 要求相邻目录存在 `../host-sdk` 和 `../component-sdk`。打开 `http://127.0.0.1:4173/host/` 查看 Embedded 示例，直接打开 `/component/` 查看 Standalone 模式。

HTTP 冒烟检查应确认：

```text
GET /host/                  -> 200
GET /component/             -> 200
GET /sdk/host-sdk/host.js   -> 200
GET /api/health             -> ready
GET /api/config             -> 配置可读取
```

构建输出位于 `dist/`，并由 Git 忽略。
