import { HostRuntime } from '../sdk/host-sdk/host.js';
import { createFormalContractMessage, createMessage, postMessage } from '../shared/protocol.js';

const frameContainer = document.querySelector('#component-container');
const logNode = document.querySelector('#log');
const log = (text) => { logNode.textContent = `${text}\n${logNode.textContent}`.slice(0, 4000); };
const config = { locale: 'en-US', showSeconds: true };
const host = new HostRuntime({ implementation: 'bap-examples-host', version: '0.1.0', capabilities: ['lifecycle', 'size', 'pause-resume', 'config'] });
const component = host.mount({ id: 'org.bap.examples.clock', src: '../component/', container: frameContainer, size: { width: 640, height: 480 }, allowedOrigin: window.location.origin });

function sendRequest(name, payload = {}) {
  const message = createMessage('request', name, payload);
  postMessage(component.iframe.contentWindow, message);
  log(`→ ${name}`);
}

component.on('ready', (hello) => { log(`← component.hello (${hello.implementation})`); sendRequest('config.set', { config }); });
component.on('component.configChanged', (next) => log(`← component.configChanged ${JSON.stringify(next)}`));
component.on('fault', ({ code, message }) => log(`component fault: ${code} ${message}`));
component.on('stopped', () => log('← component stopped'));

document.querySelector('#pause').onclick = () => { component.pause(); log('→ host.paused'); };
document.querySelector('#resume').onclick = () => { component.resume(); log('→ host.resumed'); };
document.querySelector('#apply').onclick = () => {
  config.locale = document.querySelector('#locale').value;
  config.showSeconds = document.querySelector('#seconds').checked;
  sendRequest('config.set', { config });
};

async function companion(path, options) {
  const response = await fetch(`/api/${path}`, { headers: { 'content-type': 'application/json' }, ...options });
  if (!response.ok) throw new Error(`Companion HTTP ${response.status}`);
  return response.json();
}
async function updateCompanion() {
  try { const state = await companion('health'); document.querySelector('#companion').textContent = `${state.name} · ${state.status}`; }
  catch (error) { document.querySelector('#companion').textContent = error.message; }
}
document.querySelector('#load').onclick = async () => {
  const data = await companion('config');
  Object.assign(config, data.config);
  document.querySelector('#locale').value = config.locale;
  document.querySelector('#seconds').checked = config.showSeconds;
  sendRequest('config.set', { config });
};
document.querySelector('#save').onclick = async () => { await companion('config', { method: 'PUT', body: JSON.stringify({ config }) }); log('→ config saved to Companion'); };
document.querySelector('#contract-check').onclick = () => {
  const message = createFormalContractMessage('request', 'hello', { role: 'host' });
  log(`formal Core Profile fixture: ${message.protocol.name}/${message.protocol.version}`);
};
updateCompanion();
