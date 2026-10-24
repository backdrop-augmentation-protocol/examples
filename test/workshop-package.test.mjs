import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateWorkshopPackage } from '../scripts/validate-workshop-package.mjs';

const base = {
  type: 'web', version: 2, file: 'index.html', preview: 'preview.jpg',
  title: 'BAP Time Widget Demo', description: 'Local test', contentrating: 'Everyone',
  ratingsex: 'none', ratingviolence: 'none', visibility: 'private', tags: ['Nature', 'Clock'],
  general: { properties: { mute: { type: 'bool', text: 'Mute', order: 100, value: false } } },
};

async function fixture(t, project = base) {
  const root = await mkdtemp(join(tmpdir(), 'bap-workshop-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'project.json'), JSON.stringify(project));
  await writeFile(join(root, 'index.html'), '<script type="module" src="./main.js"></script>');
  await writeFile(join(root, 'main.js'), 'export const ready = true;');
  await writeFile(join(root, 'preview.jpg'), 'preview');
  return root;
}

test('accepts canonical version 2 metadata with existing resources', async t => {
  const root = await fixture(t);
  assert.equal((await validateWorkshopPackage(root)).files, 4);
});

test('rejects a preview name outside the project policy', async t => {
  const root = await fixture(t, { ...base, preview: 'missing.jpg' });
  await assert.rejects(validateWorkshopPackage(root), /preview must be preview.jpg/);
});

test('rejects nested project.json', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'widget'));
  await writeFile(join(root, 'widget', 'project.json'), '{}');
  await assert.rejects(validateWorkshopPackage(root), /nested project.json/);
});

test('rejects wrong property value type', async t => {
  const root = await fixture(t, { ...base, general: { properties: { mute: { type: 'bool', text: 'Mute', order: 1, value: 'false' } } } });
  await assert.rejects(validateWorkshopPackage(root), /mute.value must be boolean/);
});

test('rejects missing relative resource', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'main.js'), "import './missing.js';");
  await assert.rejects(validateWorkshopPackage(root), /reference in main.js is missing/);
});

test('rejects an entry path outside the project policy', async t => {
  const root = await fixture(t, { ...base, file: '../elsewhere.html' });
  await assert.rejects(validateWorkshopPackage(root), /file must be index.html/);
});

test('rejects inherited Workshop identity', async t => {
  const root = await fixture(t, { ...base, workshopid: '123' });
  await assert.rejects(validateWorkshopPackage(root), /published Workshop identity/);
});

test('rejects Web as a genre tag', async t => {
  const root = await fixture(t, { ...base, tags: ['web'] });
  await assert.rejects(validateWorkshopPackage(root), /unsupported genre/);
});

test('rejects a missing project-specific genre', async t => {
  const root = await fixture(t, { ...base, tags: ['Nature'] });
  await assert.rejects(validateWorkshopPackage(root), /required genre/);
});

test('rejects extra editor snapshot metadata', async t => {
  const root = await fixture(t, { ...base, snapshotformat: -1 });
  await assert.rejects(validateWorkshopPackage(root), /canonical Web wallpaper template/);
});

test('rejects a different metadata version', async t => {
  const root = await fixture(t, { ...base, version: 3 });
  await assert.rejects(validateWorkshopPackage(root), /version must be 2/);
});

test('rejects a host package that bundles the time widget', async t => {
  const root = await fixture(t, { ...base, title: 'BAP Host Wallpaper Demo', preview: 'preview.gif', tags: ['Nature'] });
  await writeFile(join(root, 'preview.gif'), 'preview');
  await mkdir(join(root, 'time-widget'));
  await writeFile(join(root, 'time-widget', 'embedded.html'), 'bundled widget');
  await assert.rejects(validateWorkshopPackage(root), /must not bundle components/);
});

test('rejects a host package that bundles the local calendar component', async t => {
  const root = await fixture(t, { ...base, title: 'BAP Host Wallpaper Demo', preview: 'preview.gif', tags: ['Nature'] });
  await writeFile(join(root, 'preview.gif'), 'preview');
  await mkdir(join(root, 'calendar-widget'));
  await writeFile(join(root, 'calendar-widget', 'embedded.html'), 'bundled widget');
  await assert.rejects(validateWorkshopPackage(root), /must not bundle components/);
});

test('rejects an embedded entrypoint that still loads a separate script', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ modes: ['embedded'], entrypoints: { embedded: './embedded.html' } }));
  await writeFile(join(root, 'embedded.html'), '<script src="./main.js"></script>');
  await assert.rejects(validateWorkshopPackage(root), /inline script/);
});
