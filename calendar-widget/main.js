import { ComponentRuntime } from '../sdk/component-sdk/runtime.js';
import { PostMessageClient } from '../sdk/component-sdk/post-message-client.js';

const embedded = window.parent !== window;
const manifest = { protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, id: 'org.bap.examples.calendar-widget', name: 'BAP Calendar Widget Demo', version: '0.1.0', implementationVersion: '0.1.0', role: 'component', capabilities: ['lifecycle', 'config'], permissions: [], modes: ['standalone', 'embedded'], entrypoints: { default: './index.html', standalone: './index.html', embedded: './embedded.html' }, configScopes: ['global', 'wallpaper'], description: 'Open-license demo calendar widget' };
const client = embedded ? new PostMessageClient({ target: window.parent, targetOrigin: '*', receiveWindow: window }) : null;
const runtime = new ComponentRuntime({ manifest, mode: embedded ? 'embedded' : 'standalone', client, config: { locale: 'en-US', weekStartsSunday: false, showAdjacentDays: true, showYear: true, fontScale: 1 },
  extensions: [{ id: 'org.bap.component-config', versions: ['0.1.0'] }] });
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


function render() {
  const channels = String(runtime.getConfig('schemecolor') ?? '').split(/\s+/).map(Number);
  if (channels.length === 3 && channels.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
    document.documentElement.style.setProperty('--bap-scheme-color', `rgb(${channels.map(value => Math.round(value * 255)).join(' ')})`);
  const now = new Date();
  const locale = runtime.getConfig('locale') || 'en-US';
  month.textContent = new Intl.DateTimeFormat(locale, { month: 'long' }).format(now);
  const custom = runtime.getConfig('calendarPreset') !== 'standard';
  year.textContent = custom && runtime.getConfig('showYear') === false ? '' : String(now.getFullYear());
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const sundayFirst = custom && runtime.getConfig('weekStart') === 'sunday';
  const offset = (first.getDay() + (sundayFirst ? 0 : 6)) % 7;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(2024, 0, (sundayFirst ? 7 : 1) + index);
    return `<span class="weekday">${new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}</span>`;
  });
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), index - offset + 1);
    const classes = ['day'];
    const outsideMonth = day.getMonth() !== now.getMonth();
    if (outsideMonth) classes.push('outside');
    if (day.toDateString() === now.toDateString()) classes.push('today');
    return `<span class="${classes.join(' ')}">${custom && outsideMonth && runtime.getConfig('showAdjacentDays') === false ? '' : day.getDate()}</span>`;
  });
  grid.innerHTML = [...weekdays, ...days].join('');
  grid.querySelector('.today')?.style.setProperty('background-color', 'var(--bap-scheme-color)');
  document.querySelector('.eyebrow').textContent = custom && runtime.getConfig('showYear') !== false ? runtime.getConfig('calendarTitle') || 'BAP CALENDAR' : 'BAP CALENDAR';
  document.body.style.zoom = String(runtime.getConfig('fontScale') || 1);
}

runtime.onConfigChange(render);
render();
setInterval(() => { if (runtime.state === 'running') render(); }, 60_000);
window.wallpaperPropertyListener = {
  applyUserProperties(properties) {
    const patch = {};
    for (const key of ['calendarPreset', 'weekStart', 'showAdjacentDays', 'showYear', 'calendarTitle', 'fontScale', 'schemecolor'])
      if (properties[key]?.value !== undefined) patch[key] = properties[key].value;
    void runtime.setConfig(patch);
  },
};
void runtime.start().catch((error) => { console.error('BAP calendar component failed to start', error); });
