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
