import { ComponentRuntime } from '../sdk/component-sdk/runtime.js';
import { ComponentTransportAdapter, COMPONENT_MANIFEST } from '../shared/protocol.js';

const embedded = window.parent !== window;
const mode = document.querySelector('#mode');
const status = document.querySelector('#status');
const clock = document.querySelector('#clock');
const config = { locale: 'en-US', showSeconds: true };
const transport = embedded ? new ComponentTransportAdapter() : null;
const runtime = new ComponentRuntime({
  manifest: COMPONENT_MANIFEST,
  mode: embedded ? 'embedded' : 'standalone',
  client: transport,
  config,
  root: document.body
});
let timer;

mode.textContent = embedded ? 'Embedded' : 'Standalone';

function render() {
  const value = new Intl.DateTimeFormat(runtime.getConfig('locale'), {
    hour: '2-digit', minute: '2-digit',
    second: runtime.getConfig('showSeconds') ? '2-digit' : undefined,
    hour12: false
  }).format(new Date());
  clock.textContent = value;
  status.textContent = runtime.state === 'paused'
    ? 'Paused by Host'
    : `Running · ${runtime.getConfig('locale')}`;
}

async function applyHostRequest(message) {
  if (message.name === 'host.hello') {
    transport.respond(message, {
      role: 'component',
      implementation: 'bap-component-sdk',
      version: '0.1.0',
      capabilities: COMPONENT_MANIFEST.capabilities
    });
    await runtime.start();
  } else if (message.name === 'config.set') {
    const next = await runtime.setConfig(message.payload?.config ?? {});
    transport.respond(message, { config: next });
  }
}

if (transport) {
  transport.onRequest((message) => { void applyHostRequest(message); });
  transport.on('host.sizeChanged', render);
  transport.on('host.paused', () => { void runtime.pause(); });
  transport.on('host.resumed', () => { void runtime.resume(); });
} else {
  void runtime.start();
}

runtime.onConfigChange(render);
runtime.onLifecycle('paused', render);
runtime.onLifecycle('running', render);
timer = window.setInterval(() => { if (runtime.state === 'running') render(); }, 1000);
render();
