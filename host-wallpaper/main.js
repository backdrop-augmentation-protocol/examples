import { HostRuntime, WallpaperEngineHost } from '../sdk/host-sdk/index.js';
import { connectCompanion } from '../companion/client.js';

const video = document.querySelector('#video');
const volume = document.querySelector('#volume');
const toggle = document.querySelector('#toggle');
const companionStatus = document.querySelector('#companion-status');
const componentDefinitions = [
  { id: 'org.bap.examples.time-widget', label: 'Time', container: document.querySelector('#component-time') },
  { id: 'org.bap.examples.calendar-widget', label: 'Calendar', container: document.querySelector('#component-calendar') },
];
const componentStates = new Map(componentDefinitions.map(({ id }) => [id, 'waiting']));
let companionState = 'connecting';
function showStatus() {
  const states = componentDefinitions.map(({ id, label }) => `${label}: ${componentStates.get(id)}`).join('; ');
  companionStatus.textContent = `Companion: ${companionState}; ${states}`;
}
function setComponentState(id, state) { componentStates.set(id, state); showStatus(); }
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
const mountedComponents = new Map();
function mountComponent(definition, srcdoc) {
  const { id, container } = definition;
  const component = host.mount({
    id,
    srcdoc,
    container,
    size: { width: container.clientWidth, height: container.clientHeight },
  });
  mountedComponents.set(id, component);
  component.on('ready', () => setComponentState(id, 'running'));
  component.on('fault', (fault) => { setComponentState(id, 'unavailable'); console.warn(`BAP component ${id} unavailable; host continues`, JSON.stringify(fault)); });
  component.on('stopped', () => { if (mountedComponents.get(id) === component) mountedComponents.delete(id); });
}
// The current SDKs expose the transport primitives independently. This tiny
// demo adapter completes the symmetric request/response side of the iframe
// handshake while the HostRuntime owns mounting, isolation, and lifecycle.
window.addEventListener('message', (event) => {
  const component = [...mountedComponents.values()].find((handle) => event.source === handle.iframe.contentWindow && handle.acceptsOrigin(event.origin));
  if (!component) return;
  const message = event.data;
  if (message?.kind !== 'request' || !message.id) return;
  const result = message.method === 'hello'
    ? { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, sessionId: 'examples-session', capabilities: ['lifecycle', 'config'], permissions: [] }
    : { acknowledged: true, method: message.method };
  const responseOrigin = '*';
  event.source.postMessage({ protocol: message.protocol, kind: 'response', id: `res-${message.id}`, correlationId: message.id, timestamp: new Date().toISOString(), ok: true, result, sessionId: 'examples-session' }, responseOrigin);
});

const adapter = {
  // The two slots have different dimensions; resize each handle below.
  onSize() {},
  onPause(listener) { this.pause = listener; },
  onResume(listener) { this.resume = listener; },
};
new WallpaperEngineHost(host, adapter);
window.addEventListener('resize', () => {
  for (const definition of componentDefinitions) {
    const handle = mountedComponents.get(definition.id);
    if (handle) handle.setSize({ width: definition.container.clientWidth, height: definition.container.clientHeight });
  }
});

async function connectToCompanion() {
  let companion;
  let reconnectScheduled = false;
  function reconnect() {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    for (const component of mountedComponents.values()) component.stop();
    companionState = 'offline; reconnecting';
    for (const definition of componentDefinitions) componentStates.set(definition.id, 'waiting');
    showStatus();
    setTimeout(connectToCompanion, 3000);
  }
  try {
    companion = await connectCompanion();
    companion.socket.addEventListener('close', reconnect, { once: true });
    const components = await companion.listComponents();
    if (reconnectScheduled) return;
    companionState = 'connected';
    showStatus();
    await Promise.all(componentDefinitions.map(async (definition) => {
      if (!components.some((item) => item.id === definition.id)) { setComponentState(definition.id, 'not installed'); return; }
      try {
        const embedded = await companion.fetchComponentResource(definition.id, 'embedded.html');
        if (embedded.size > 1024 * 1024) throw new Error('Embedded component exceeds the 1 MiB demo limit');
        const srcdoc = await embedded.text();
        if (reconnectScheduled) return;
        mountComponent(definition, srcdoc);
      } catch (error) {
        if (reconnectScheduled) return;
        setComponentState(definition.id, 'unavailable');
        console.warn(`BAP component ${definition.id} unavailable; host continues`, error);
      }
    }));
  } catch (error) {
    companion?.close();
    reconnect();
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
