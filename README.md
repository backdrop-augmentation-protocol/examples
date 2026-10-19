# BAP Examples

This repository contains a dependency-free, browser-runnable BAP MVP example:

- `component/` is a clock/status component with Standalone and Embedded modes.
- `host/` is a minimal host that embeds the component in an iframe.
- `companion/` is a local HTTP mock for configuration and component discovery.
- `shared/protocol.js` is the small message-envelope helper used by both sides.

The example demonstrates the MVP choices from `internal-docs`: iframe +
`postMessage`, request/response plus events, configuration, lifecycle, and
pause/resume. It deliberately uses platform APIs only so it can be inspected
and adapted before the official SDKs are published.

## Run

```text
npm test
npm run build
npm run serve
```

Open `http://127.0.0.1:4173/host/` for the embedded example. The host starts
with a Companion mock at `http://127.0.0.1:4173/api/`; the Companion panel can
load and save the component configuration. Open `/component/` directly to see
Standalone Mode.

The build output is written to `dist/` and is intentionally ignored by git.
