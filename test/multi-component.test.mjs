import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

test('Host demo offers separate slots for both independently discovered components', async () => {
  const html = await readFile(new URL('../dist/workshop-host-wallpaper/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../dist/workshop-host-wallpaper/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="component-time"/);
  assert.match(html, /id="component-calendar"/);
  assert.match(script, /org\.bap\.examples\.time-widget/);
  assert.match(script, /org\.bap\.examples\.calendar-widget/);
  const hostFiles = await readdir(new URL('../dist/workshop-host-wallpaper/', import.meta.url));
  assert.ok(!hostFiles.includes('time-widget'));
  assert.ok(!hostFiles.includes('calendar-widget'));
  const localFiles = await readdir(new URL('../dist/local-calendar-widget/', import.meta.url));
  assert.ok(localFiles.includes('manifest.json'));
  assert.ok(!localFiles.includes('project.json'));
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
  assert.match(host, /#component-calendar iframe\{pointer-events:auto\}/);
});
