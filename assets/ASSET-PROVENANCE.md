# Demo asset provenance

The demo uses small, replaceable assets. No BAP, Blue Archive, or other
official game assets are included.

| File | Source | License / use | Verification |
|---|---|---|---|
| `host-wallpaper/flower.mp4` | [MDN shared asset](https://mdn.github.io/shared-assets/videos/flower.mp4) | Public demo asset documented by MDN; used only as a generic looping video. | SHA-256 `0CD83D944A6CA7822B4A8306CECC60A36E859B041F6702C6A1AD9EAD78924451` |
| `time-widget/river-sunset.jpg` | [Wikimedia Commons: River Sunset Landscape](https://commons.wikimedia.org/wiki/File:River_Sunset_Landscape.jpg) | CC0 1.0; author/source information is retained on the Commons page. | SHA-256 `D4D7FDA47C81D2D9EFDA75B28281D478D3A2555B863949C0FA8686A03B4471F8` |
| `calendar-widget/lake-mountain.jpg` | [Wikimedia Commons: Lake Mountain Landscape](https://commons.wikimedia.org/wiki/File:Lake_Mountain_Landscape.jpg), 1280px derivative; photo by Bonnie Moreland. | CC0 1.0 on the Commons file page. | SHA-256 `DBE83E658703E8EEB9D16367AD4676D11F3E038B1FF6D42D1E4552F17C5CAF3C` |
| `calendar-widget/preview.png` | Generated from the calendar landscape and project-owned calendar artwork by `scripts/generate-calendar-preview.ps1`. | Landscape is CC0 1.0; calendar artwork is created in this repository. | Rebuild with the script before changing the preview. |
| BGM | none bundled | Optional local `assets/host-wallpaper/bgm.ogg`; if absent, the demo uses a Web Audio fallback tone. | Keep local BGM out of Git unless its redistribution license is documented here. |

The build intentionally does not fetch remote assets. The checked-in files are
small (about 1.1 MB video and 0.3 MB image). To reproduce them, download the
two files from the URLs above into the paths shown and compare the hashes.
