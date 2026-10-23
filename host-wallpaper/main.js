import { HostRuntime, WallpaperEngineHost } from '../sdk/host-sdk/index.js';
import { connectCompanion } from '../companion/client.js';

const video = document.querySelector('#video');
const frameContainer = document.querySelector('#component');
const volume = document.querySelector('#volume');
const toggle = document.querySelector('#toggle');
const companionStatus = document.querySelector('#companion-status');
const componentId = 'org.bap.examples.time-widget';
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
let component;
function mountComponent(srcdoc) {
  component = host.mount({
    id: componentId,
    srcdoc,
    container: frameContainer,
    size: { width: frameContainer.clientWidth, height: frameContainer.clientHeight },
  });
  component.on('ready', () => { companionStatus.textContent = 'Companion: connected; widget: running'; });
  component.on('fault', (fault) => { companionStatus.textContent = 'Companion: connected; widget: unavailable'; console.warn('BAP component unavailable; host continues', JSON.stringify(fault)); });
}
// The current SDKs expose the transport primitives independently. This tiny
// demo adapter completes the symmetric request/response side of the iframe
// handshake while the HostRuntime owns mounting, isolation, and lifecycle.
window.addEventListener('message', (event) => {
  if (!component || event.source !== component.iframe.contentWindow || !component.acceptsOrigin(event.origin)) return;
  const message = event.data;
  if (message?.kind !== 'request' || !message.id) return;
  const result = message.method === 'hello'
    ? { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, sessionId: 'examples-session', capabilities: ['lifecycle', 'config'], permissions: [] }
    : { acknowledged: true, method: message.method };
  const responseOrigin = '*';
  event.source.postMessage({ protocol: message.protocol, kind: 'response', id: `res-${message.id}`, correlationId: message.id, timestamp: new Date().toISOString(), ok: true, result, sessionId: 'examples-session' }, responseOrigin);
});

const adapter = {
  onSize(listener) { window.addEventListener('resize', () => listener({ width: frameContainer.clientWidth, height: frameContainer.clientHeight })); },
  onPause(listener) { this.pause = listener; },
  onResume(listener) { this.resume = listener; },
  currentSize() { return { width: frameContainer.clientWidth, height: frameContainer.clientHeight }; },
};
new WallpaperEngineHost(host, adapter);

async function connectToCompanion() {
  let companion;
  try {
    companion = await connectCompanion();
    const components = await companion.listComponents();
    companionStatus.textContent = `Companion: connected; discovered: ${components.length}`;
    if (components.some((item) => item.id === componentId)) {
      const embedded = await companion.fetchComponentResource(componentId, 'embedded.html');
      if (embedded.size > 1024 * 1024) throw new Error('Embedded component exceeds the 1 MiB demo limit');
      mountComponent(await embedded.text());
    } else {
      companionStatus.textContent = 'Companion: connected; time widget not discovered';
    }
    companion.socket.addEventListener('close', () => {
      component?.stop();
      component = undefined;
      companionStatus.textContent = 'Companion: offline; reconnecting...';
      setTimeout(connectToCompanion, 3000);
    }, { once: true });
  } catch (error) {
    companion?.close();
    companionStatus.textContent = 'Companion: offline; reconnecting...';
    console.warn('BAP Companion unavailable', error);
    setTimeout(connectToCompanion, 3000);
  }
}
void connectToCompanion();

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
