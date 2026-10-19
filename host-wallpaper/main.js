import { HostRuntime, WallpaperEngineHost } from '../sdk/host-sdk/index.js';
import { connectCompanion } from '../companion/client.js';

const video = document.querySelector('#video');
const frameContainer = document.querySelector('#component');
const fallback = document.querySelector('#fallback');
const volume = document.querySelector('#volume');
const toggle = document.querySelector('#toggle');
const companionStatus = document.querySelector('#companion-status');
const componentOrigin = window.location.protocol === 'file:' ? '*' : window.location.origin;
const VIDEO = '../assets/host-wallpaper/flower.webm';
const optionalBgm = new Audio('../assets/host-wallpaper/bgm.ogg');
optionalBgm.loop = true;
let fallbackAudio;

video.src = VIDEO;
video.preload = 'auto';
video.volume = Number(volume.value);
video.muted = true;
video.load();
video.play().catch(() => {});

const host = new HostRuntime({
  implementationId: 'org.bap.examples.host-wallpaper',
  implementationName: 'BAP Host Wallpaper Demo',
  implementationVersion: '0.1.0',
  capabilities: ['lifecycle', 'size', 'pause-resume', 'config'],
});
const component = host.mount({
  id: 'org.bap.examples.time-widget',
  src: '../time-widget/embedded.html',
  container: frameContainer,
  size: { width: 560, height: 240 },
  allowedOrigin: componentOrigin,
});
component.on('fault', (fault) => { console.warn('BAP component unavailable; host continues', fault); });
// The current SDKs expose the transport primitives independently. This tiny
// demo adapter completes the symmetric request/response side of the iframe
// handshake while the HostRuntime owns mounting, isolation, and lifecycle.
window.addEventListener('message', (event) => {
  if (event.source !== component.iframe.contentWindow || event.origin !== window.location.origin) return;
  const message = event.data;
  if (message?.kind !== 'request' || !message.id) return;
  const result = message.method === 'hello'
    ? { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, sessionId: 'examples-session', capabilities: ['lifecycle', 'config'], permissions: [] }
    : { acknowledged: true, method: message.method };
  const responseOrigin = event.origin === 'null' ? '*' : event.origin;
  event.source.postMessage({ protocol: message.protocol, kind: 'response', id: `res-${message.id}`, correlationId: message.id, timestamp: new Date().toISOString(), ok: true, result, sessionId: 'examples-session' }, responseOrigin);
});

const adapter = {
  onSize(listener) { window.addEventListener('resize', () => listener({ width: innerWidth, height: innerHeight })); },
  onPause(listener) { this.pause = listener; },
  onResume(listener) { this.resume = listener; },
  currentSize() { return { width: innerWidth, height: innerHeight }; },
};
new WallpaperEngineHost(host, adapter);

void connectCompanion().then(async (companion) => {
  const capabilities = companion.hello?.capabilities ?? [];
  companionStatus.textContent = `Companion: connected (${capabilities.join(', ') || 'no advertised capabilities'})`;
  await companion.saveWallpaperConfig('bap-host-wallpaper', { locale: 'en-US', showSeconds: true });
  const config = await companion.loadConfig();
  console.info('BAP Companion configuration round-trip complete', config.wallpapers?.['bap-host-wallpaper']);
}).catch((error) => {
  companionStatus.textContent = 'Companion: offline (host remains available)';
  console.warn('BAP Companion unavailable', error);
});

function setMediaState({ paused } = {}) {
  if (paused) { video.pause(); optionalBgm.pause(); fallbackAudio?.suspend(); adapter.pause?.(); }
  else { video.play().catch(() => {}); if (!video.muted) startAudio(); adapter.resume?.(); }
}
function startAudio() {
  optionalBgm.volume = Number(volume.value);
  optionalBgm.play().catch(() => {
    if (!fallbackAudio) {
      fallbackAudio = new AudioContext();
      const oscillator = fallbackAudio.createOscillator();
      const gain = fallbackAudio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 220; gain.gain.value = 0.025;
      oscillator.connect(gain).connect(fallbackAudio.destination); oscillator.start();
    }
    fallbackAudio.resume();
  });
}
window.wallpaperPropertyListener = {
  applyUserProperties(properties) {
    const next = properties || {};
    if (next.videoVolume?.value !== undefined) volume.value = String(next.videoVolume.value);
    if (next.mute?.value !== undefined) video.muted = Boolean(next.mute.value);
    video.volume = Number(volume.value);
    if (!video.muted) startAudio(); else { optionalBgm.pause(); fallbackAudio?.suspend(); }
    toggle.textContent = video.muted ? 'Unmute' : 'Mute';
  },
};
window.wallpaperRegisterAudioListener = () => {};
window.wallpaperRequestPaused = () => setMediaState({ paused: true });
window.wallpaperRequestResumed = () => setMediaState({ paused: false });

volume.oninput = () => { video.volume = Number(volume.value); optionalBgm.volume = Number(volume.value); };
toggle.onclick = () => { video.muted = !video.muted; toggle.textContent = video.muted ? 'Unmute' : 'Mute'; if (video.muted) { optionalBgm.pause(); fallbackAudio?.suspend(); } else startAudio(); };
