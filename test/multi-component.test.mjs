import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { synchronizeComponentOrder } from '../host-wallpaper/layout.js';

test('Host demo auto-layout mounts preset components without bundling them', async () => {
  const html = await readFile(new URL('../dist/workshop-host-wallpaper/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../dist/workshop-host-wallpaper/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="components"/);
  assert.match(html, /\.components\{/);
  assert.match(html, /data-component-id="org\.bap\.examples\.time-widget"[^}]*bottom:6vh/);
  assert.match(html, /data-component-id="org\.bap\.examples\.calendar-widget"[^}]*right:4vw/);
  assert.match(script, /listEffectiveComponents\(hostId\)/);
  assert.match(script, /synchronizeComponentOrder\(componentContainer, orderedContainers\)/);
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

test('unchanged preset order never reparents mounted component iframes', () => {
  const time = { id: 'time' };
  const calendar = { id: 'calendar' };
  const container = {
    children: [time, calendar],
    appendCount: 0,
    appendChild(node) {
      this.children = this.children.filter(child => child !== node);
      this.children.push(node);
      this.appendCount++;
    },
  };
  assert.equal(synchronizeComponentOrder(container, [time, calendar]), false);
  assert.equal(container.appendCount, 0);
  assert.equal(synchronizeComponentOrder(container, [calendar, time]), true);
  assert.deepEqual(container.children, [calendar, time]);
  const changedCount = container.appendCount;
  assert.equal(synchronizeComponentOrder(container, [calendar, time]), false);
  assert.equal(container.appendCount, changedCount);
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
