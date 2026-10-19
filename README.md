# BAP Examples

[English](README.md) | [简体中文](README.zh-CN.md)

This repository contains a browser-runnable BAP MVP integration example:

- `component/` is a clock/status component with Standalone and Embedded modes.
- `host/` is a minimal host that embeds the component in an iframe.
- `companion/` is a local HTTP mock for configuration and component discovery.
- `host/` uses the official `host-sdk` `HostRuntime` to mount the iframe.
- `component/` uses the official `component-sdk` `ComponentRuntime`.
- `shared/protocol.js` is only a transport adapter and Core Profile envelope
  helper; it is not a second protocol definition.

The example demonstrates the MVP choices from `internal-docs`: iframe +
`postMessage`, request/response plus events, configuration, lifecycle,
pause/resume, and Companion configuration persistence. The build copies the
published files from the sibling official SDK repositories into `dist/sdk/`;
the example does not reimplement their runtime behavior.

## Run

```text
npm run build
npm test
npm run serve
```

Open `http://127.0.0.1:4173/host/` for the embedded example. The host starts
with a Companion mock at `http://127.0.0.1:4173/api/`; the Companion panel can
load and save the component configuration. Open `/component/` directly to see
Standalone Mode.

`npm run build` expects the sibling repositories `../host-sdk` and
`../component-sdk` to be present. The build output is written to `dist/` and
is intentionally ignored by git.

The HTTP smoke check should verify:

```text
GET /host/                  -> 200
GET /component/             -> 200
GET /sdk/host-sdk/host.js   -> 200
GET /api/health             -> ready
GET /api/config             -> persisted configuration
```
