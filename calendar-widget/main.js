import { ComponentRuntime } from '../sdk/component-sdk/runtime.js';
import { PostMessageClient } from '../sdk/component-sdk/post-message-client.js';
import { createResponse } from '../sdk/component-sdk/protocol.js';

const embedded = window.parent !== window;
const manifest = { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, id: 'org.bap.examples.calendar-widget', name: 'BAP Calendar Widget Demo', version: '0.1.0', implementationVersion: '0.1.0', role: 'component', capabilities: ['lifecycle', 'config'], permissions: [], modes: ['standalone', 'embedded'], entrypoints: { default: './index.html', standalone: './index.html', embedded: './embedded.html' }, configScopes: ['global', 'wallpaper'], description: 'Open-license demo calendar widget' };
const client = embedded ? new PostMessageClient({ target: window.parent, targetOrigin: '*', receiveWindow: window }) : null;
const runtime = new ComponentRuntime({ manifest, mode: embedded ? 'embedded' : 'standalone', client, config: { locale: 'en-US' } });
const month = document.querySelector('#month');
const year = document.querySelector('#year');
const grid = document.querySelector('#grid');
const toggle = document.querySelector('#toggle-calendar');

toggle.addEventListener('click', () => {
  const expanded = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', expanded ? 'Collapse calendar' : 'Expand calendar');
  toggle.textContent = expanded ? 'Collapse' : 'Expand';
  grid.hidden = !expanded;
});

if (embedded) window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (message?.kind !== 'request' || !message.id) return;
  const result = message.method === 'hello'
    ? { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, sessionId: 'examples-session', capabilities: manifest.capabilities, permissions: [] }
    : { acknowledged: true, method: message.method };
  const responseOrigin = window.location.protocol === 'file:' || window.location.protocol === 'about:' ? '*' : event.origin;
  event.source.postMessage(createResponse(message, result, { sessionId: 'examples-session' }), responseOrigin);
});

function render() {
  const now = new Date();
  const locale = runtime.getConfig('locale') || 'en-US';
  month.textContent = new Intl.DateTimeFormat(locale, { month: 'long' }).format(now);
  year.textContent = String(now.getFullYear());
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(2024, 0, 1 + index);
    return `<span class="weekday">${new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}</span>`;
  });
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), index - offset + 1);
    const classes = ['day'];
    if (day.getMonth() !== now.getMonth()) classes.push('outside');
    if (day.toDateString() === now.toDateString()) classes.push('today');
    return `<span class="${classes.join(' ')}">${day.getDate()}</span>`;
  });
  grid.innerHTML = [...weekdays, ...days].join('');
}

runtime.onConfigChange(render);
render();
setInterval(() => { if (runtime.state === 'running') render(); }, 60_000);
void runtime.start().catch((error) => { console.error('BAP calendar component failed to start', error); });
