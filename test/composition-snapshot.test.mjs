import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { effectiveRuntimeLayout, nextEffectiveConfigRevision, validateCompositionSnapshot } from '../dist/host-wallpaper/composition.js';

const viewport = { width: 1920, height: 1080 };
const base = {
  presetId: 'demo', revision: 4, updatedAt: '2026-11-07T00:00:00Z', layoutMode: 'grid',
  grid: { columns: 2, gapX: 0.02, gapY: 0.02, paddingX: 0.04, paddingY: 0.04 },
  instances: [{
    instanceId: 'clock-1', componentId: 'org.example.clock', sourceKey: 'local:clock',
    name: 'Clock', status: 'available', embeddedPath: 'embedded.html', enabled: true,
    userVisible: true, layout: { mode: 'automatic', order: 0, scale: 1, rotation: 0, opacity: 1, zIndex: 0, locked: false },
    config: {}, configRevision: 4,
  }],
};

test('validates the full effective snapshot before application', () => {
  assert.equal(validateCompositionSnapshot(base, viewport), true);
  const duplicate = structuredClone(base);
  duplicate.instances.push(structuredClone(duplicate.instances[0]));
  assert.throws(() => validateCompositionSnapshot(duplicate, viewport), /Invalid BAP composition instance/);
  const unavailable = structuredClone(base);
  unavailable.instances[0].status = 'unknown';
  assert.throws(() => validateCompositionSnapshot(unavailable, viewport), /Invalid BAP composition instance/);
  const invalidLayout = structuredClone(base);
  invalidLayout.instances[0].layout.order = -1;
  assert.throws(() => validateCompositionSnapshot(invalidLayout, viewport), /Invalid automatic component layout/);
  const noGrid = structuredClone(base);
  noGrid.grid = null;
  assert.throws(() => validateCompositionSnapshot(noGrid, viewport), /requires grid settings/);
});

test('manual snapshot accepts omitted null fields for missing components', () => {
  const snapshot = structuredClone(base);
  snapshot.layoutMode = 'manual';
  delete snapshot.grid;
  Object.assign(snapshot.instances[0], {
    name: 'org.example.clock', status: 'missing',
    layout: { mode: 'manual', anchor: 'top-left', x: 0, y: 0, width: 0.2, height: 0.1, scale: 1, rotation: 0, opacity: 1, zIndex: 0, locked: false },
  });
  delete snapshot.instances[0].sourceKey;
  delete snapshot.instances[0].embeddedPath;
  assert.equal(validateCompositionSnapshot(snapshot, viewport), true);
});

test('derived configuration changes receive a strictly increasing effective revision', () => {
  assert.equal(nextEffectiveConfigRevision(8, 8), 9);
  assert.equal(nextEffectiveConfigRevision(12, 8), 12);
  assert.throws(() => nextEffectiveConfigRevision(-1, 0), /non-negative safe integers/);
});

test('runtime layout overrides survive subsequent preset composition refreshes', () => {
  const presetLayout = { mode: 'manual', anchor: 'top-left', x: 0.1, y: 0.1, width: 0.2, height: 0.2, scale: 1, rotation: 0, opacity: 1, zIndex: 0, locked: false };
  const runtimeLayout = { ...presetLayout, x: 0.75, y: 0.6 };
  const overrides = new Map([['clock-1', runtimeLayout]]);

  assert.equal(effectiveRuntimeLayout('clock-1', presetLayout, overrides), runtimeLayout);
  assert.equal(effectiveRuntimeLayout('new-instance', presetLayout, overrides), presetLayout);
});

test('Host demo validates before applying and rejects stale revisions only within the same preset', async () => {
  const source = await readFile(new URL('../host-wallpaper/main.js', import.meta.url), 'utf8');
  assert.match(source, /validateCompositionSnapshot\(composition/);
  assert.match(source, /composition\.presetId === appliedPresetId && composition\.revision < appliedPresetRevision/);
  assert.match(source, /nextEffectiveConfigRevision\(item\.configRevision, record\.configRevision\)/);
  assert.match(source, /effectiveRuntimeLayout\(instanceId, item\?\.layout, runtimeLayoutOverrides\)/);
  assert.match(source, /runtimeLayoutOverrides\.set\(command\.instanceId, command\.layout\)/);
});
