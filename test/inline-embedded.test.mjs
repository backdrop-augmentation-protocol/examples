import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildInlineEmbedded } from '../scripts/build-inline-embedded.mjs';

const template = '<!doctype html><main id="clock"></main><script type="module" src="./main.js"></script>';

test('bundles a component module graph into one inline script', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bap-inline-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'clock.js'), "export const clock = 'running';");
  await writeFile(join(root, 'main.js'), "import { clock } from './clock.js'; document.querySelector('#clock').textContent = clock;");
  const html = await buildInlineEmbedded(template, join(root, 'main.js'));
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.match(html, /running/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script));
  await assert.rejects(buildInlineEmbedded(template + template, join(root, 'main.js')), /exactly one/);
});

test('built Workshop widget has a self-contained embedded entrypoint', async () => {
  const root = new URL('../dist/workshop-time-widget/embedded.html', import.meta.url);
  const html = await readFile(root, 'utf8');
  assert.match(html, /BAP TIME WIDGET/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.match(html, /ComponentRuntime/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script));
});
