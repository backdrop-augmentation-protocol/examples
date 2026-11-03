import { ComponentRuntime } from '../sdk/component-sdk/runtime.js';
import { PostMessageClient } from '../sdk/component-sdk/post-message-client.js';

const embedded = window.parent !== window;
if (embedded) document.documentElement.classList.add('embedded');
const manifest = { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, id: 'org.bap.examples.time-widget', name: 'BAP Time Widget Demo', version: '0.1.0', implementationVersion: '0.1.0', role: 'component', capabilities: ['lifecycle', 'config'], permissions: [], modes: ['standalone', 'embedded'], entrypoints: { default: './index.html', standalone: './index.html', embedded: './embedded.html' }, configScopes: ['global', 'wallpaper'], description: 'Open-license demo time widget' };
const targetOrigin = '*';
const client = embedded ? new PostMessageClient({ target: window.parent, targetOrigin, receiveWindow: window }) : null;
const runtime = new ComponentRuntime({ manifest, mode: embedded ? 'embedded' : 'standalone', client, config: { locale: 'en-US', use12HourClock: false, showSeconds: false, showDate: true, fontScale: 1 },
  extensions: [{ id: 'org.bap.component-config', versions: ['0.1.0'] }] });
const time = document.querySelector('#time'); const date = document.querySelector('#date');
const card = document.querySelector('.card');
function applyWidgetTransform() {
  const finite = (key, fallback) => Number.isFinite(Number(runtime.getConfig(key))) ? Number(runtime.getConfig(key)) : fallback;
  const x = Math.max(-50, Math.min(50, finite('widgetOffsetX', 0)));
  const y = Math.max(-50, Math.min(50, finite('widgetOffsetY', 0)));
  const scale = Math.max(0.25, Math.min(2, finite('widgetScale', 1)));
  const rotation = Math.max(-180, Math.min(180, finite('widgetRotation', 0)));
  const opacity = Math.max(0.1, Math.min(1, finite('widgetOpacity', 1)));
  card.style.transform = `translate(${x}vw, ${y}vh) scale(${scale}) rotate(${rotation}deg)`;
  card.style.opacity = String(opacity);
}
function applySchemeColor() {
  const color = runtime.getConfig('appearancePreset') === 'standard' ? '0.55 0.82 1' : runtime.getConfig('schemecolor');
  const channels = String(color ?? '').split(/\s+/).map(Number);
  if (channels.length === 3 && channels.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
    document.documentElement.style.setProperty('--bap-scheme-color', `rgb(${channels.map(value => Math.round(value * 255)).join(' ')})`);
  document.querySelector('.badge').style.color = 'var(--bap-scheme-color)';
}
function render() { applySchemeColor(); applyWidgetTransform(); const now = new Date(); const locale = runtime.getConfig('locale') || 'en-US'; const custom = runtime.getConfig('timePreset') !== 'standard'; const format = custom ? runtime.getConfig('timeFormat') || '24h' : '24h'; const hour12 = format === '12h' ? true : format === '24h' ? false : undefined; const showDate = !custom || runtime.getConfig('showDate') !== false; time.textContent = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: custom && runtime.getConfig('showSeconds') ? '2-digit' : undefined, hour12 }).format(now); const dateOptions = custom && runtime.getConfig('dateStyle') === 'short' ? { year: 'numeric', month: 'numeric', day: 'numeric' } : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; date.textContent = new Intl.DateTimeFormat(locale, dateOptions).format(now); date.hidden = !showDate; document.querySelector('.badge').textContent = custom ? runtime.getConfig('label') || 'BAP TIME WIDGET' : 'BAP TIME WIDGET'; document.body.style.zoom = String(runtime.getConfig('appearancePreset') === 'standard' ? 1 : runtime.getConfig('fontScale') || 1); }
runtime.onConfigChange(render); render(); setInterval(() => { if (runtime.state === 'running') render(); }, 1000);
window.wallpaperPropertyListener = {
  applyUserProperties(properties) {
    const patch = {};
    for (const key of ['timePreset', 'timeFormat', 'showSeconds', 'showDate', 'dateStyle', 'label', 'appearancePreset', 'fontScale', 'schemecolor', 'widgetOffsetX', 'widgetOffsetY', 'widgetScale', 'widgetRotation', 'widgetOpacity'])
      if (properties[key]?.value !== undefined) patch[key] = properties[key].value;
    void runtime.setConfig(patch);
  },
};
void runtime.start().catch((error) => { console.error('BAP component failed to start', error); });
