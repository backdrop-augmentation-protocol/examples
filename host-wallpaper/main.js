import { HostRuntime, WallpaperEngineHost } from '../sdk/host-sdk/index.js';
import { COMPANION_POLICY, companionReconnectDelayMs, connectCompanion } from '../companion/client.js';
import { synchronizeComponentOrder } from './layout.js';

const video = document.querySelector('#video');
const volume = document.querySelector('#volume');
const toggle = document.querySelector('#toggle');
const companionStatus = document.querySelector('#companion-status');
const componentContainer = document.querySelector('#components');
const hostId = 'org.bap.examples.host-wallpaper';
const diagnosticsEnabled = globalThis.__BAP_ENABLE_DIAGNOSTICS__ === true;
const hostPageInstanceId = diagnosticsEnabled
  ? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replaceAll('-', '')
  : null;
function diagnostic(event, details = {}) {
  if (!diagnosticsEnabled) return;
  console.info('[BAP-DIAG]', JSON.stringify({ event, at: new Date().toISOString(), pageInstanceId: hostPageInstanceId, href: globalThis.location?.href ?? null, ...details }));
}
let activeDiagnosticReporter = null;
if (diagnosticsEnabled) {
  diagnostic('page-start', { visibility: document.visibilityState, referrer: document.referrer });
  window.addEventListener('pagehide', event => { diagnostic('pagehide', { persisted: event.persisted }); activeDiagnosticReporter?.('pagehide', { persisted: event.persisted }); });
  window.addEventListener('pageshow', event => { diagnostic('pageshow', { persisted: event.persisted }); activeDiagnosticReporter?.('pageshow', { persisted: event.persisted }); });
  document.addEventListener?.('visibilitychange', () => { diagnostic('visibility-change', { visibility: document.visibilityState }); activeDiagnosticReporter?.('visibility-change', { visibility: document.visibilityState }); });
}
const componentStates = new Map();
let companionState = 'connecting';
let reconnectAttempts = 0;
let lastConnectedAt = 0;
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
  extensions: [{ id: 'org.bap.component-config', versions: ['0.1.0'] }],
});
const mountedComponents = new Map();
function mountComponent(definition, srcdoc) {
  const { instanceId, componentId, sourceKey } = definition;
  const container = document.createElement('div');
  container.className = 'component';
  container.dataset.componentId = componentId;
  container.dataset.instanceId = instanceId;
  componentContainer.appendChild(container);
  const component = host.mount({
    instanceId,
    componentId,
    sourceKey,
    srcdoc,
    container,
    size: { width: container.clientWidth, height: container.clientHeight },
    config: definition.config ?? {},
    configRevision: definition.configRevision ?? 0,
  });
  mountedComponents.set(instanceId, { component, container, sourceKey, config: JSON.stringify(definition.config ?? {}), configRevision: definition.configRevision ?? 0 });
  component.on('ready', () => setComponentState(instanceId, 'running'));
  component.on('fault', (fault) => { setComponentState(instanceId, 'unavailable'); console.warn(`BAP component ${componentId} (${instanceId}) unavailable; host continues`, JSON.stringify(fault)); });
  component.on('stopped', () => { if (mountedComponents.get(instanceId)?.component === component) mountedComponents.delete(instanceId); container.remove(); });
}
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
  diagnostic('connect-attempt', { attempt: reconnectAttempts + 1 });
  let companion;
  let reconnectScheduled = false;
  let refreshTimer;
  let refreshing = false;
  function reconnect(reason) {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    if (lastConnectedAt && Date.now() - lastConnectedAt >= COMPANION_POLICY.reconnectResetAfterMs) reconnectAttempts = 0;
    const delay = companionReconnectDelayMs(++reconnectAttempts);
    diagnostic('reconnect-scheduled', { reason, attempt: reconnectAttempts, delayMs: delay, lastConnectedAt: lastConnectedAt ? new Date(lastConnectedAt).toISOString() : null });
    if (diagnosticsEnabled) companion?.reportDiagnostic('reconnect-scheduled', { reason, attempt: reconnectAttempts, delayMs: delay, lastConnectedAt: lastConnectedAt ? new Date(lastConnectedAt).toISOString() : null });
    clearInterval(refreshTimer);
    for (const id of mountedComponents.keys()) host.unmount(id);
    mountedComponents.clear();
    companionState = 'offline; reconnecting';
    componentStates.clear();
    showStatus();
    setTimeout(connectToCompanion, delay);
  }
  async function refresh() {
    if (refreshing || reconnectScheduled) return;
    refreshing = true;
    try {
      const selected = await companion.listEffectiveComponents(hostId);
      if (reconnectScheduled) return;
      const desired = new Set(selected.filter(item => item.status === 'available').map(item => item.instanceId));
      for (const instanceId of mountedComponents.keys()) {
        const record = mountedComponents.get(instanceId);
        const next = selected.find(item => item.instanceId === instanceId);
        if (!desired.has(instanceId) || next?.sourceKey !== record.sourceKey) host.unmount(instanceId);
      }
      const orderedContainers = [];
      for (const item of selected) {
        const instanceId = item.instanceId;
        if (item.status !== 'available') { setComponentState(instanceId, item.status); continue; }
        if (!mountedComponents.has(instanceId)) {
          try {
            const embedded = await companion.fetchCatalogResource(item.sourceKey, item.embeddedPath);
            if (embedded.size > 1024 * 1024) throw new Error('Embedded component exceeds the 1 MiB demo limit');
            const srcdoc = await embedded.text();
            if (reconnectScheduled) return;
            mountComponent(item, srcdoc);
            setComponentState(instanceId, 'loading');
          } catch (error) {
            setComponentState(instanceId, 'unavailable');
            console.warn(`BAP component ${item.componentId} (${instanceId}) unavailable; host continues`, error);
          }
        }
        const record = mountedComponents.get(instanceId);
        const nextConfig = JSON.stringify(item.config ?? {});
        if (record && record.config !== nextConfig && host.updateConfig(instanceId, item.config ?? {}, item.configRevision ?? 0)) {
          record.config = nextConfig;
          record.configRevision = item.configRevision ?? record.configRevision;
        }
        if (record) orderedContainers.push(record.container);
      }
      orderedContainers.forEach((container, index) => { container.dataset.slot = String(index % 4); });
      synchronizeComponentOrder(componentContainer, orderedContainers);
      for (const id of componentStates.keys()) if (!selected.some(item => item.instanceId === id)) componentStates.delete(id);
      showStatus();
    } catch (error) { console.warn('BAP preset refresh failed', error); }
    finally { refreshing = false; }
  }
  try {
    companion = await connectCompanion(diagnosticsEnabled ? {
      diagnosticInstanceId: hostPageInstanceId,
      onDiagnostic: entry => diagnostic(entry.event, entry),
    } : undefined);
    if (diagnosticsEnabled) activeDiagnosticReporter = (event, details) => companion.reportDiagnostic(event, details);
    companion.socket.addEventListener('close', event => reconnect(`websocket-close:${event.code}:${event.reason || 'no-reason'}`), { once: true });
    if (reconnectScheduled) return;
    lastConnectedAt = Date.now();
    companionState = 'connected';
    showStatus();
    await refresh();
    refreshTimer = setInterval(refresh, COMPANION_POLICY.componentRefreshIntervalMs);
  } catch (error) {
    companion?.close();
    reconnect(`connect-error:${error instanceof Error ? error.message : String(error)}`);
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
  setPaused(isPaused) { setMediaState({ paused: isPaused }); },
};
window.wallpaperRegisterAudioListener = () => {};

volume.oninput = () => { video.volume = Number(volume.value); optionalBgm.volume = Number(volume.value); };
toggle.onclick = () => { video.muted = !video.muted; toggle.textContent = video.muted ? 'Unmute' : 'Mute'; if (video.muted) { optionalBgm.pause(); fallbackAudio?.suspend(); } else startAudio(); };
