import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateWorkshopPackage } from '../scripts/validate-workshop-package.mjs';

const base = {
  type: 'web', version: 2, file: 'index.html', preview: 'preview.jpg',
  title: 'Example', description: 'Local test', contentrating: 'Everyone',
  ratingsex: 'none', ratingviolence: 'none', visibility: 'private', tags: ['web'],
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

test('accepts editor-style version 2 metadata with existing resources', async t => {
  const root = await fixture(t);
  assert.equal((await validateWorkshopPackage(root)).files, 4);
});

test('rejects missing preview', async t => {
  const root = await fixture(t, { ...base, preview: 'missing.jpg' });
  await assert.rejects(validateWorkshopPackage(root), /preview is missing/);
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

test('rejects paths escaping the package', async t => {
  const root = await fixture(t, { ...base, file: '../elsewhere.html' });
  await assert.rejects(validateWorkshopPackage(root), /file escapes the package/);
});

test('rejects inherited Workshop identity', async t => {
  const root = await fixture(t, { ...base, workshopid: '123' });
  await assert.rejects(validateWorkshopPackage(root), /published Workshop identity/);
});
