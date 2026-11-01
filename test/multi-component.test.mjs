import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { resolveLayouts } from '@backdrop-augmentation-protocol/host-sdk';

test('Host demo auto-layout mounts preset components without bundling them', async () => {
  const html = await readFile(new URL('../dist/workshop-host-wallpaper/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../dist/workshop-host-wallpaper/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="components"/);
  assert.match(html, /\.components\{/);
  assert.match(html, /\.components>\.component\{pointer-events:auto\}/);
  assert.match(script, /getComposition\(hostId\)/);
  assert.match(script, /host\.setLayoutMode\(composition\.layoutMode, composition\.grid/);
  assert.match(script, /layout: definition\.layout/);
  assert.match(script, /host\.setLayout\(instanceId, item\.layout\)/);
  assert.match(script, /org\.bap\.composition/);
  assert.match(script, /host\.unmount\(id\)/);
  const hostFiles = await readdir(new URL('../dist/workshop-host-wallpaper/', import.meta.url));
  assert.ok(!hostFiles.includes('time-widget'));
  assert.ok(!hostFiles.includes('calendar-widget'));
  const localFiles = await readdir(new URL('../dist/local-calendar-widget/', import.meta.url));
  assert.ok(localFiles.includes('manifest.json'));
  assert.ok(!localFiles.includes('project.json'));
  const weFiles = await readdir(new URL('../dist/workshop-calendar-widget/', import.meta.url));
  assert.ok(weFiles.includes('project.json'));
  assert.ok(weFiles.includes('preview.png'));
  const weProject = JSON.parse(await readFile(new URL('../dist/workshop-calendar-widget/project.json', import.meta.url), 'utf8'));
  assert.equal(weProject.title, 'BAP Calendar Widget Demo');
  assert.ok(!Object.hasOwn(weProject, 'workshopid'));
});

test('demo widgets publish useful editable properties and react to per-instance config', async () => {
  const timeProject = JSON.parse(await readFile(new URL('../dist/workshop-time-widget/project.json', import.meta.url), 'utf8'));
  const calendarProject = JSON.parse(await readFile(new URL('../dist/workshop-calendar-widget/project.json', import.meta.url), 'utf8'));
  const timeProperties = timeProject.general.properties;
  const calendarProperties = calendarProject.general.properties;
  assert.equal(timeProperties.timePreset.type, 'combo');
  assert.equal(timeProperties.timePreset.text, 'Clock & Date');
  assert.equal(timeProperties.appearancePreset.type, 'combo');
  assert.equal(timeProperties.appearancePreset.text, 'Appearance');
  assert.equal(timeProperties.schemecolor.order, 11);
  assert.equal(timeProperties.fontScale.condition, "appearancePreset.value == 'custom'");
  assert.equal(calendarProperties.calendarPreset.type, 'combo');
  assert.equal(calendarProperties.appearancePreset.type, 'combo');
  assert.equal(calendarProperties.schemecolor.order, 11);
  assert.equal(calendarProperties.fontScale.condition, "appearancePreset.value == 'custom'");
  assert.equal(timeProperties.timeFormat.type, 'combo');
  assert.deepEqual(timeProperties.timeFormat.options.map(option => option.value), ['24h', '12h', 'locale']);
  assert.equal(timeProperties.label.type, 'textinput');
  assert.equal(timeProperties.dateStyle.condition, "timePreset.value == 'custom' && showDate.value == true");
  assert.equal(timeProperties.showSeconds.type, 'bool');
  assert.equal(timeProperties.showDate.type, 'bool');
  assert.equal(timeProperties.fontScale.type, 'slider');
  assert.equal(calendarProperties.weekStart.type, 'combo');
  assert.deepEqual(calendarProperties.weekStart.options.map(option => option.value), ['monday', 'sunday']);
  assert.equal(calendarProperties.calendarTitle.type, 'textinput');
  assert.equal(calendarProperties.calendarTitle.condition, "calendarPreset.value == 'custom' && showYear.value == true");
  assert.equal(calendarProperties.showAdjacentDays.type, 'bool');
  assert.equal(calendarProperties.showYear.type, 'bool');
  assert.equal(calendarProperties.fontScale.type, 'slider');
  const timeScript = await readFile(new URL('../dist/workshop-time-widget/main.js', import.meta.url), 'utf8');
  const calendarScript = await readFile(new URL('../dist/workshop-calendar-widget/main.js', import.meta.url), 'utf8');
  assert.match(timeScript, /runtime\.onConfigChange\(render\)/);
  assert.match(timeScript, /wallpaperPropertyListener/);
  assert.match(timeScript, /runtime\.getConfig\('timeFormat'\)/);
  assert.match(timeScript, /runtime\.getConfig\('label'\)/);
  assert.match(timeScript, /runtime\.getConfig\('timePreset'\)/);
  assert.match(timeScript, /runtime\.getConfig\('appearancePreset'\)/);
  assert.match(calendarScript, /runtime\.getConfig\('weekStart'\)/);
  assert.match(calendarScript, /runtime\.getConfig\('calendarTitle'\)/);
  assert.match(calendarScript, /runtime\.getConfig\('calendarPreset'\)/);
  assert.match(calendarScript, /runtime\.getConfig\('appearancePreset'\)/);
  assert.match(calendarScript, /runtime\.getConfig\('showAdjacentDays'\)/);
  assert.match(calendarScript, /wallpaperPropertyListener/);
});

test('grid auto-layout gives repeated instances of one component independent slots', () => {
  const layout = order => ({ mode: 'automatic', order, scale: 1, rotation: 0, opacity: 1, zIndex: order, locked: false });
  const resolved = resolveLayouts(new Map([
    ['clock-a', layout(0)],
    ['clock-b', layout(1)],
    ['calendar', layout(2)],
  ]), 'grid', { columns: 2, gapX: 0.04, gapY: 0.04, paddingX: 0.04, paddingY: 0.04 }, { width: 1920, height: 1080 });
  assert.equal(resolved.size, 3);
  assert.notDeepEqual(resolved.get('clock-a'), resolved.get('clock-b'));
  assert.notEqual(resolved.get('clock-a').x, resolved.get('clock-b').x);
  assert.notEqual(resolved.get('clock-b').y, resolved.get('calendar').y);
});

test('diagnostic instrumentation is opt-in and excluded from Workshop host package', async () => {
  const workshopMain = await readFile(new URL('../dist/workshop-host-wallpaper/main.js', import.meta.url), 'utf8');
  const diagnosticMain = await readFile(new URL('../dist/diagnostic-host-wallpaper/main.js', import.meta.url), 'utf8');
  const diagnosticClient = await readFile(new URL('../dist/diagnostic-host-wallpaper/companion/client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(workshopMain, /__BAP_ENABLE_DIAGNOSTICS__\s*=\s*true/);
  assert.match(diagnosticMain, /^globalThis\.__BAP_ENABLE_DIAGNOSTICS__ = true;/);
  assert.match(diagnosticClient, /\/v1\/diagnostics/);
});

test('local calendar exposes the same collapsible grid in both modes', async () => {
  const standalone = await readFile(new URL('../dist/local-calendar-widget/index.html', import.meta.url), 'utf8');
  const embedded = await readFile(new URL('../dist/local-calendar-widget/embedded.html', import.meta.url), 'utf8');
  for (const html of [standalone, embedded]) {
    assert.match(html, /id="toggle-calendar"/);
    assert.match(html, /aria-controls="grid" aria-expanded="true"/);
    assert.match(html, /\.grid\[hidden\]\{display:none\}/);
  }
  assert.match(embedded, /Expand calendar/);
  assert.match(embedded, /grid\.hidden\s*=/);
  const host = await readFile(new URL('../dist/workshop-host-wallpaper/index.html', import.meta.url), 'utf8');
  assert.match(host, /\.component\{[^}]*pointer-events:auto/);
  assert.match(standalone, /\.\/assets\/calendar-widget\/lake-mountain\.jpg/);
  const workshopStandalone = await readFile(new URL('../dist/workshop-calendar-widget/index.html', import.meta.url), 'utf8');
  assert.match(workshopStandalone, /\.\/assets\/calendar-widget\/lake-mountain\.jpg/);
});
