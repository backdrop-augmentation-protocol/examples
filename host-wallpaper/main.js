import { HostRuntime, WallpaperEngineHost } from '../sdk/host-sdk/index.js';
import { connectCompanion } from '../companion/client.js';

const video = document.querySelector('#video');
const volume = document.querySelector('#volume');
const toggle = document.querySelector('#toggle');
const companionStatus = document.querySelector('#companion-status');
const componentContainer = document.querySelector('#components');
const hostId = 'org.bap.examples.host-wallpaper';
const componentStates = new Map();
let companionState = 'connecting';
function showStatus() {
  const states = [...componentStates].map(([id, state]) => `${id}: ${state}`).join('; ');
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
  implementationId: hostId,
  implementationName: 'BAP Host Wallpaper Demo',
  implementationVersion: '0.1.0',
  capabilities: ['lifecycle', 'size', 'pause-resume', 'config'],
});
const mountedComponents = new Map();
function mountComponent(definition, srcdoc) {
  const { componentId: id, sourceKey } = definition;
  const container = document.createElement('div');
  container.className = 'component';
  componentContainer.appendChild(container);
  const component = host.mount({
    id,
    srcdoc,
    container,
    size: { width: container.clientWidth, height: container.clientHeight },
  });
  mountedComponents.set(id, { component, container, sourceKey });
  component.on('ready', () => setComponentState(id, 'running'));
  component.on('fault', (fault) => { setComponentState(id, 'unavailable'); console.warn(`BAP component ${id} unavailable; host continues`, JSON.stringify(fault)); });
  component.on('stopped', () => { if (mountedComponents.get(id)?.component === component) mountedComponents.delete(id); container.remove(); });
}
// The current SDKs expose the transport primitives independently. This tiny
// demo adapter completes the symmetric request/response side of the iframe
// handshake while the HostRuntime owns mounting, isolation, and lifecycle.
window.addEventListener('message', (event) => {
  const component = [...mountedComponents.values()].map(record => record.component).find((handle) => event.source === handle.iframe.contentWindow && handle.acceptsOrigin(event.origin));
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
  // Auto-layout containers are measured per component below.
  onSize() {},
  onPause(listener) { this.pause = listener; },
  onResume(listener) { this.resume = listener; },
};
new WallpaperEngineHost(host, adapter);
window.addEventListener('resize', () => {
  for (const { component, container } of mountedComponents.values())
    component.setSize({ width: container.clientWidth, height: container.clientHeight });
});

async function connectToCompanion() {
  let companion;
  let reconnectScheduled = false;
  let refreshTimer;
  let refreshing = false;
  function reconnect() {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    clearInterval(refreshTimer);
    for (const id of mountedComponents.keys()) host.unmount(id);
    mountedComponents.clear();
    companionState = 'offline; reconnecting';
    componentStates.clear();
    showStatus();
    setTimeout(connectToCompanion, 3000);
  }
  async function refresh() {
    if (refreshing || reconnectScheduled) return;
    refreshing = true;
    try {
      const selected = await companion.listEffectiveComponents(hostId);
      if (reconnectScheduled) return;
      const desired = new Set(selected.filter(item => item.status === 'available').map(item => item.componentId));
      for (const id of mountedComponents.keys()) {
        const record = mountedComponents.get(id);
        const next = selected.find(item => item.componentId === id);
        if (!desired.has(id) || next?.sourceKey !== record.sourceKey) host.unmount(id);
      }
      for (const item of selected) {
        if (item.status !== 'available') { setComponentState(item.componentId, item.status); continue; }
        if (!mountedComponents.has(item.componentId)) {
          try {
            const embedded = await companion.fetchCatalogResource(item.sourceKey, item.embeddedPath);
            if (embedded.size > 1024 * 1024) throw new Error('Embedded component exceeds the 1 MiB demo limit');
            const srcdoc = await embedded.text();
            if (reconnectScheduled) return;
            mountComponent(item, srcdoc);
            setComponentState(item.componentId, 'loading');
          } catch (error) {
            setComponentState(item.componentId, 'unavailable');
            console.warn(`BAP component ${item.componentId} unavailable; host continues`, error);
          }
        }
        const record = mountedComponents.get(item.componentId);
        if (record) componentContainer.appendChild(record.container);
      }
      for (const id of componentStates.keys()) if (!selected.some(item => item.componentId === id)) componentStates.delete(id);
      showStatus();
    } catch (error) { console.warn('BAP preset refresh failed', error); }
    finally { refreshing = false; }
  }
  try {
    companion = await connectCompanion();
    companion.socket.addEventListener('close', reconnect, { once: true });
    if (reconnectScheduled) return;
    companionState = 'connected';
    showStatus();
    await refresh();
    refreshTimer = setInterval(refresh, 1500);
  } catch (error) {
    companion?.close();
    reconnect();
    console.warn('BAP Companion unavailable', error);
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
