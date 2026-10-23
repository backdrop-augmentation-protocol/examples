# BAP Examples

[English](README.md) | [简体中文](README.zh-CN.md)

This repository contains a browser-runnable BAP MVP integration example:

- `component/` is a clock/status component with Standalone and Embedded modes.
- `host/` is a minimal host that embeds the component in an iframe.
- `host-wallpaper/` is a Wallpaper Engine Web wallpaper using Host SDK,
  looping video, optional BGM, WE callbacks, and a Companion-discovered component.
- `time-widget/` is a real dual-mode component wallpaper using Component SDK.
- `assets/ASSET-PROVENANCE.md` records the open-license demo media and hashes.
- `companion/` is a local HTTP mock for configuration and component discovery.
- `host/` uses the official `host-sdk` `HostRuntime` to mount the iframe.
- `component/` uses the official `component-sdk` `ComponentRuntime`.
- `shared/protocol.js` is only a transport adapter and Core Profile envelope
  helper; it is not a second protocol definition.

The examples demonstrate iframe + `postMessage`, request/response plus events,
configuration, lifecycle, and pause/resume. The build copies the
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

The real wallpaper demos are available at `/host-wallpaper/` and
`/time-widget/`. Copy each built directory to a temporary Wallpaper Engine Web
wallpaper project, or open them in the browser for a precheck. The host uses
the checked-in MDN flower video. An optional `bgm.ogg` can be placed under
`assets/host-wallpaper/`; without it, a tiny Web Audio fallback tone keeps
mute/volume behavior testable.

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

## Hidden Workshop test items

`npm run build` creates two separate Wallpaper Engine project folders:
`dist/workshop-host-wallpaper/` and `dist/workshop-time-widget/`. Each contains
its own `project.json`, required SDK, and media assets. The host package does
not bundle the component or Companion service; it only contains a small client
that connects to the separately running Windows Companion. Without Companion,
the video wallpaper remains available but no widget is mounted.

For local integration, start Companion with `BAP_WORKSHOP_ROOTS` pointing to
the independent time-widget project directory. For subscribed Workshop
components, use `BAP_DISCOVER_STEAM_WORKSHOP=1` and set `BAP_STEAM_ROOT` when
Steam is installed outside its default location. Any Workshop publication or
update of Wallpaper Engine wallpapers must use the official WE editor.
