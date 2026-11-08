import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInlineEmbedded } from './build-inline-embedded.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(dist, 'acceptance');
await rm(output, { recursive: true, force: true });

async function replaceOnce(file, before, after) {
  const text = await readFile(file, 'utf8');
  if (text.split(before).length !== 2) throw new Error(`Expected one replacement point in ${file}`);
  await writeFile(file, text.replace(before, after));
}

const host = resolve(output, 'host-wallpaper');
await mkdir(output, { recursive: true });
await cp(resolve(dist, 'workshop-host-wallpaper'), host, { recursive: true });
await replaceOnce(resolve(host, 'main.js'),
  "{ id: 'org.bap.composition', versions: ['0.1.0'] },",
  "{ id: 'org.bap.composition', versions: ['0.1.0'] },\n    { id: 'org.bap.presentation', versions: ['0.1.0'] },");
await replaceOnce(resolve(host, 'main.js'),
  '  viewport: { width: window.innerWidth, height: window.innerHeight },\n});',
  `  viewport: { width: window.innerWidth, height: window.innerHeight },\n});
let acceptanceScene = 'desktop';
host.setScene(acceptanceScene, 'acceptance-startup');
const sceneButton = document.querySelector('#scene-probe');
const sceneStatus = document.querySelector('#scene-probe-status');
sceneButton.addEventListener('click', () => {
  acceptanceScene = acceptanceScene === 'desktop' ? 'lock-screen' : 'desktop';
  const revision = host.setScene(acceptanceScene, 'acceptance-button');
  sceneStatus.textContent = \`Scene: \${acceptanceScene} · rev \${revision}\`;
  console.info('[BAP-SCENE-ACCEPTANCE]', JSON.stringify({ sceneId: acceptanceScene, revision }));
});`);
await replaceOnce(resolve(host, 'index.html'),
  '<div id="controls"><button id="toggle">Unmute</button>',
  '<div id="scene-probe-status">Scene: desktop · waiting for components</div><div id="controls"><button id="scene-probe" type="button">Toggle test scene</button><button id="toggle">Unmute</button>');
await replaceOnce(resolve(host, 'index.html'),
  '#companion-status{position:fixed;',
  '#scene-probe-status{position:fixed;left:22px;top:56px;z-index:4;color:#d8f2ff;background:#07111dcc;padding:6px 10px;border:1px solid #47718e;border-radius:6px;font:12px system-ui,sans-serif}\n#companion-status{position:fixed;');

async function makeComponent(name, source, htmlTemplate) {
  const destination = resolve(output, name);
  await cp(resolve(dist, source), destination, { recursive: true });
  const main = resolve(destination, 'main.js');
  await replaceOnce(main,
    "{ id: 'org.bap.component-config', versions: ['0.1.0'] }] });",
    "{ id: 'org.bap.component-config', versions: ['0.1.0'] }, { id: 'org.bap.presentation', versions: ['0.1.0'] }] });");
  await replaceOnce(main,
    'void runtime.start().catch((error) => { console.error(',
    `runtime.onPresentationChange(state => {
  const probe = document.querySelector('#scene-probe-component') ?? document.body.appendChild(document.createElement('div'));
  probe.id = 'scene-probe-component';
  probe.textContent = \`Scene: \${state.sceneId ?? 'unset'} · rev \${state.sceneRevision}\`;
  Object.assign(probe.style, { position: 'fixed', top: '4px', left: '4px', zIndex: '2147483647', padding: '3px 6px', borderRadius: '4px', color: 'white', background: '#07111ddd', font: '11px system-ui,sans-serif', pointerEvents: 'none' });
  console.info('[BAP-SCENE-ACCEPTANCE]', JSON.stringify({ instanceId: runtime.instanceId, ...state }));
});
void runtime.start().catch((error) => { console.error(`);
  await writeFile(resolve(destination, 'embedded.html'), await buildInlineEmbedded(
    await readFile(resolve(root, htmlTemplate), 'utf8'), main));
}

await makeComponent('time-widget', 'workshop-time-widget', 'time-widget/embedded.html');
await makeComponent('calendar-widget', 'workshop-calendar-widget', 'calendar-widget/embedded.html');

const hostMetadata = JSON.parse(await readFile(resolve(host, 'project.json'), 'utf8'));
if (hostMetadata.workshopid || hostMetadata.workshopurl) throw new Error('Acceptance host must not contain Workshop identity');
console.log(`Built local-only acceptance packages: ${output}`);
