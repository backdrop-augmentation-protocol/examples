import { HostRuntime } from '../sdk/host-sdk/index.js';

const host = new HostRuntime();
const status = document.querySelector('#status');
const handles = [];
function report() { status.textContent = handles.map(handle => `${handle.id}: ${handle.state}`).join('; '); }

for (const [id, path] of [
  ['time-widget', '../workshop-time-widget/embedded.html'],
  ['calendar-widget', '../workshop-calendar-widget/embedded.html'],
]) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Cannot load ${id}: HTTP ${response.status}`);
  const container = document.createElement('div');
  container.className = 'component';
  document.querySelector('#components').appendChild(container);
  const handle = host.mount({ id, srcdoc: await response.text(), container, size: { width: 280, height: 300 } });
  handles.push(handle);
  for (const name of ['ready', 'paused', 'resumed', 'stopped', 'fault']) handle.on(name, report);
  report();
}

document.querySelector('#pause').onclick = () => host.pauseAll();
document.querySelector('#resume').onclick = () => host.resumeAll();
