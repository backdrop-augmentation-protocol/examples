import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const directory of ['component', 'host', 'shared', 'companion', 'host-wallpaper', 'time-widget', 'assets']) {
  await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
}
await mkdir(resolve(dist, 'sdk', 'host-sdk'), { recursive: true });
await cp(resolve(root, '..', 'host-sdk', 'dist'), resolve(dist, 'sdk', 'host-sdk'), { recursive: true });
await mkdir(resolve(dist, 'sdk', 'component-sdk'), { recursive: true });
await cp(resolve(root, '..', 'component-sdk', 'src'), resolve(dist, 'sdk', 'component-sdk'), { recursive: true });

async function replaceIn(file, replacements) {
  let content = await readFile(file, 'utf8');
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  await writeFile(file, content);
}

const widgetPackage = resolve(dist, 'workshop-time-widget');
await cp(resolve(dist, 'time-widget'), widgetPackage, { recursive: true });
await cp(resolve(dist, 'sdk'), resolve(widgetPackage, 'sdk'), { recursive: true });
await cp(resolve(dist, 'assets'), resolve(widgetPackage, 'assets'), { recursive: true });
await replaceIn(resolve(widgetPackage, 'main.js'), [["'../sdk/", "'./sdk/"]]);
await replaceIn(resolve(widgetPackage, 'index.html'), [["../assets/", "./assets/"]]);

const hostPackage = resolve(dist, 'workshop-host-wallpaper');
await cp(resolve(dist, 'host-wallpaper'), hostPackage, { recursive: true });
await cp(resolve(dist, 'sdk'), resolve(hostPackage, 'sdk'), { recursive: true });
await cp(resolve(dist, 'assets'), resolve(hostPackage, 'assets'), { recursive: true });
await cp(resolve(dist, 'companion'), resolve(hostPackage, 'companion'), { recursive: true });
await cp(resolve(dist, 'time-widget'), resolve(hostPackage, 'time-widget'), { recursive: true });
await replaceIn(resolve(hostPackage, 'main.js'), [
  ["'../sdk/", "'./sdk/"],
  ["'../companion/", "'./companion/"],
  ["'../time-widget/", "'./time-widget/"],
  ["'../assets/", "'./assets/"],
]);
console.log(`Built ${dist}`);
