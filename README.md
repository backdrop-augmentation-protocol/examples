# BAP Examples

[English](README.md) | [简体中文](README.zh-CN.md)

This repository contains browser-runnable BAP integration examples:

- `host-wallpaper/` is a Wallpaper Engine Web wallpaper using Host SDK,
  looping video, optional BGM, WE callbacks, and independently discovered components.
- `time-widget/` is a real dual-mode component wallpaper using Component SDK.
- `calendar-widget/` is a distinct dual-mode calendar component with a
  landscape-backed Standalone Mode and a transparent Embedded Mode.
- `assets/ASSET-PROVENANCE.md` records the open-license demo media and hashes.
- `companion/client.js` connects the Host example to the separately installed
  Companion application.

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

Open `http://127.0.0.1:4173/host-wallpaper/` for the Host example. It connects
to a separately running Companion application to discover installed components.
The component Standalone Modes are available at `/time-widget/` and
`/calendar-widget/`.
Copy each Workshop project folder to a temporary Wallpaper Engine Web
wallpaper project, or open them in the browser for a precheck. The host uses
the checked-in MDN flower video. An optional `bgm.ogg` can be placed under
`assets/host-wallpaper/`; without it, a tiny Web Audio fallback tone keeps
mute/volume behavior testable.

`npm run build` expects the sibling repositories `../host-sdk` and
`../component-sdk` to be present. The build output is written to `dist/` and
is intentionally ignored by git.

The HTTP smoke check should verify:

```text
GET /host-wallpaper/        -> 200
GET /time-widget/           -> 200
GET /sdk/host-sdk/host.js   -> 200
GET /sdk/component-sdk/runtime.js -> 200
```

## Hidden Workshop test items

`npm run build` creates three separate Wallpaper Engine project folders:
`dist/workshop-host-wallpaper/`, `dist/workshop-time-widget/`, and
`dist/workshop-calendar-widget/`. Each contains
its own `project.json`, required SDK, and media assets. The host package does
not bundle components or the Companion service; it only contains a small client
that connects to the separately running Windows Companion. Without Companion,
the video wallpaper remains available but no widget is mounted. The separate
`dist/local-calendar-widget/` package has a distinct component ID and no
`project.json`; it is only for local multi-component testing. The separate
`dist/workshop-calendar-widget/` package adds canonical WE metadata, a distinct
preview, and the landscape asset for official-editor publication. Building or
copying this package does not publish it online.

Before an official-editor Workshop publication or update, run `npm test`.
It applies both the example-specific metadata policy and the shared BAP WE
Web/Workshop distribution checks to all three generated packages. Local-only
development can use `npm run build` without this extra distribution preflight.

The component package's `embedded.html` is built as a self-contained document.
The Host retrieves it through the Companion's authenticated resource endpoint
and mounts it with the Host SDK's isolated `srcdoc` mode. Component files are
not copied into the selected Host wallpaper project, and no additional WE item
is created. The standalone entrypoint keeps its own package resources.

For a local two-component test, start Companion with `BAP_LOCAL_ROOTS`
pointing to `dist/local-calendar-widget/`; subscribed components are discovered
alongside it. The Host uses the active Companion preset, can add or remove
components without an embedded copy, and auto-arranges them in preset order.
The generated Host package now carries a Host Manifest; an older subscribed
demo without that file remains recognizable through the Companion's legacy
example mapping until it is updated through the editor.
Any Workshop publication or update of Wallpaper Engine wallpapers must use the
official WE editor.
