import { createMessage, isMessage } from '../shared/protocol.js';

const frame = document.querySelector('#component');
const logNode = document.querySelector('#log');
const log = (text) => { logNode.textContent = `${text}\n${logNode.textContent}`.slice(0, 4000); };
const config = { locale: 'en-US', showSeconds: true };
let componentReady = false;

function send(type, payload = {}) {
  const message = createMessage(type, 'host', payload);
  frame.contentWindow.postMessage(message, '*');
  log(`→ ${type}`);
}
window.addEventListener('message', ({ data }) => {
  if (!isMessage(data)) return;
  log(`← ${data.type}`);
  if (data.type === 'component.hello') { componentReady = true; send('lifecycle.start'); send('config.set', { config }); }
});
frame.addEventListener('load', () => send('host.hello', { role: 'host', capabilities: ['config', 'pause-resume'] }));
document.querySelector('#pause').onclick = () => send('lifecycle.pause');
document.querySelector('#resume').onclick = () => send('lifecycle.resume');
document.querySelector('#apply').onclick = () => { config.locale = document.querySelector('#locale').value; config.showSeconds = document.querySelector('#seconds').checked; send('config.set', { config }); };

async function companion(path, options) {
  const response = await fetch(`/api/${path}`, { headers: { 'content-type': 'application/json' }, ...options });
  if (!response.ok) throw new Error(`Companion HTTP ${response.status}`);
  return response.json();
}
async function updateCompanion() { try { const state = await companion('health'); document.querySelector('#companion').textContent = `${state.name} · ${state.status}`; } catch (error) { document.querySelector('#companion').textContent = error.message; } }
document.querySelector('#load').onclick = async () => { const data = await companion('config'); Object.assign(config, data.config); document.querySelector('#locale').value = config.locale; document.querySelector('#seconds').checked = config.showSeconds; send('config.set', { config }); };
document.querySelector('#save').onclick = async () => { await companion('config', { method: 'PUT', body: JSON.stringify({ config }) }); log('↔ config saved to Companion'); };
updateCompanion();
