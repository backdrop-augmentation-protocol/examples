import { ComponentRuntime } from '../sdk/component-sdk/runtime.js';
import { PostMessageClient } from '../sdk/component-sdk/post-message-client.js';

const embedded = window.parent !== window;
if (embedded) document.documentElement.classList.add('embedded');
const manifest = { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, id: 'org.bap.examples.time-widget', name: 'BAP Time Widget Demo', version: '0.1.0', implementationVersion: '0.1.0', role: 'component', capabilities: ['lifecycle', 'config'], permissions: [], modes: ['standalone', 'embedded'], entrypoints: { default: './index.html', standalone: './index.html', embedded: './embedded.html' }, configScopes: ['global', 'wallpaper'], description: 'Open-license demo time widget' };
const targetOrigin = '*';
const client = embedded ? new PostMessageClient({ target: window.parent, targetOrigin, receiveWindow: window }) : null;
const runtime = new ComponentRuntime({ manifest, mode: embedded ? 'embedded' : 'standalone', client, config: { locale: 'en-US', showSeconds: false },
  extensions: [{ id: 'org.bap.component-config', versions: ['0.1.0'] }] });
const time = document.querySelector('#time'); const date = document.querySelector('#date');
function applySchemeColor() {
  const channels = String(runtime.getConfig('schemecolor') ?? '').split(/\s+/).map(Number);
  if (channels.length === 3 && channels.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
    document.documentElement.style.setProperty('--bap-scheme-color', `rgb(${channels.map(value => Math.round(value * 255)).join(' ')})`);
}
function render() { applySchemeColor(); const now = new Date(); const locale = runtime.getConfig('locale') || 'en-US'; time.textContent = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: runtime.getConfig('showSeconds') ? '2-digit' : undefined, hour12: false }).format(now); date.textContent = new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now); }
runtime.onConfigChange(render); render(); setInterval(() => { if (runtime.state === 'running') render(); }, 1000);
void runtime.start().catch((error) => { console.error('BAP component failed to start', error); });
