import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProjectMetadata, validateWorkshopPackage } from './validate-workshop-package.mjs';
import { buildInlineEmbedded } from './build-inline-embedded.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const directory of ['host-wallpaper', 'time-widget', 'calendar-widget']) {
  validateProjectMetadata(JSON.parse(await readFile(resolve(root, directory, 'project.json'), 'utf8')));
}
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const directory of ['component', 'host', 'shared', 'companion', 'host-wallpaper', 'time-widget', 'calendar-widget', 'assets']) {
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

async function copyFile(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

async function copyCalendarLandscape(destination) {
  await copyFile(resolve(root, 'assets', 'calendar-widget', 'lake-mountain.jpg'), destination);
}

const widgetPackage = resolve(dist, 'workshop-time-widget');
await mkdir(widgetPackage, { recursive: true });
for (const file of ['index.html', 'embedded.html', 'main.js', 'manifest.json', 'project.json', 'preview.jpg']) {
  await copyFile(resolve(root, 'time-widget', file), resolve(widgetPackage, file));
}
await cp(resolve(root, '..', 'component-sdk', 'src'), resolve(widgetPackage, 'sdk', 'component-sdk'), { recursive: true });
await copyFile(resolve(root, 'assets', 'time-widget', 'river-sunset.jpg'), resolve(widgetPackage, 'assets', 'time-widget', 'river-sunset.jpg'));
await replaceIn(resolve(widgetPackage, 'main.js'), [["'../sdk/", "'./sdk/"]]);
await replaceIn(resolve(widgetPackage, 'index.html'), [["../assets/", "./assets/"]]);
await writeFile(resolve(widgetPackage, 'embedded.html'), await buildInlineEmbedded(
  await readFile(resolve(root, 'time-widget', 'embedded.html'), 'utf8'),
  resolve(widgetPackage, 'main.js'),
));

// A local-only second component for multi-component Host testing. It is not a
// Workshop upload package and deliberately has no project.json or preview.
const calendarPackage = resolve(dist, 'local-calendar-widget');
await mkdir(calendarPackage, { recursive: true });
for (const file of ['index.html', 'embedded.html', 'main.js', 'manifest.json']) {
  await copyFile(resolve(root, 'calendar-widget', file), resolve(calendarPackage, file));
}
await cp(resolve(root, '..', 'component-sdk', 'src'), resolve(calendarPackage, 'sdk', 'component-sdk'), { recursive: true });
await copyCalendarLandscape(resolve(calendarPackage, 'assets', 'calendar-widget', 'lake-mountain.jpg'));
await replaceIn(resolve(calendarPackage, 'main.js'), [["'../sdk/", "'./sdk/"]]);
await replaceIn(resolve(calendarPackage, 'index.html'), [["../assets/", "./assets/"]]);
await writeFile(resolve(calendarPackage, 'embedded.html'), await buildInlineEmbedded(
  await readFile(resolve(root, 'calendar-widget', 'embedded.html'), 'utf8'),
  resolve(calendarPackage, 'main.js'),
));

// Companion can read the metadata-free package; the independent WE/Workshop
// project uses the same component content plus canonical editor metadata.
const workshopCalendar = resolve(dist, 'workshop-calendar-widget');
await cp(calendarPackage, workshopCalendar, { recursive: true });
for (const file of ['project.json', 'preview.png']) {
  await copyFile(resolve(root, 'calendar-widget', file), resolve(workshopCalendar, file));
}

const hostPackage = resolve(dist, 'workshop-host-wallpaper');
await mkdir(hostPackage, { recursive: true });
for (const file of ['index.html', 'main.js', 'layout.js', 'manifest.json', 'project.json', 'preview.gif']) {
  await copyFile(resolve(root, 'host-wallpaper', file), resolve(hostPackage, file));
}
await cp(resolve(root, '..', 'host-sdk', 'dist'), resolve(hostPackage, 'sdk', 'host-sdk'), { recursive: true });
await copyFile(resolve(root, 'companion', 'client.js'), resolve(hostPackage, 'companion', 'client.js'));
await copyFile(resolve(root, 'assets', 'host-wallpaper', 'flower.webm'), resolve(hostPackage, 'assets', 'host-wallpaper', 'flower.webm'));
try {
  await stat(resolve(root, 'assets', 'host-wallpaper', 'bgm.ogg'));
  await copyFile(resolve(root, 'assets', 'host-wallpaper', 'bgm.ogg'), resolve(hostPackage, 'assets', 'host-wallpaper', 'bgm.ogg'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await replaceIn(resolve(hostPackage, 'main.js'), [
  ["'../sdk/", "'./sdk/"],
  ["'../companion/", "'./companion/"],
  ["'../assets/", "'./assets/"],
]);
await validateWorkshopPackage(widgetPackage);
await validateWorkshopPackage(hostPackage);
await validateWorkshopPackage(workshopCalendar);
console.log(`Built ${dist}`);
