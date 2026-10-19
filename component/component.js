import { createMessage, isMessage, send } from '../shared/protocol.js';

const embedded = window.parent !== window;
const mode = document.querySelector('#mode');
const status = document.querySelector('#status');
const clock = document.querySelector('#clock');
const config = { locale: 'en-US', showSeconds: true };
let paused = false;
let timer;

mode.textContent = embedded ? '· Embedded' : '· Standalone';

function render() {
  const value = new Intl.DateTimeFormat(config.locale, {
    hour: '2-digit', minute: '2-digit', second: config.showSeconds ? '2-digit' : undefined,
    hour12: false
  }).format(new Date());
  clock.textContent = value;
  status.textContent = paused ? 'Paused by Host' : `Running · ${config.locale}`;
}

function reply(message, type, payload) {
  if (embedded) window.parent.postMessage(createMessage(type, 'component', payload, message.id), '*');
}

window.addEventListener('message', ({ data }) => {
  if (!embedded || !isMessage(data)) return;
  if (data.type === 'host.hello') {
    reply(data, 'component.hello', { name: 'bap-clock', modes: ['standalone', 'embedded'], capabilities: ['config', 'pause-resume'] });
  } else if (data.type === 'lifecycle.start') {
    reply(data, 'lifecycle.ready', { state: 'running' }); render();
  } else if (data.type === 'config.set') {
    Object.assign(config, data.payload.config); render(); reply(data, 'config.updated', { config });
  } else if (data.type === 'lifecycle.pause' || data.type === 'lifecycle.resume') {
    paused = data.type.endsWith('pause'); render(); reply(data, 'lifecycle.ack', { state: paused ? 'paused' : 'running' });
  }
});

timer = window.setInterval(() => { if (!paused) render(); }, 1000);
render();
if (embedded) window.parent.postMessage(createMessage('component.loaded', 'component', { mode: 'embedded' }), '*');
