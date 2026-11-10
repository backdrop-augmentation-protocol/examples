import { resolveLayouts } from '../sdk/host-sdk/index.js';

const statuses = new Set(['available', 'unavailable', 'missing', 'disabled']);

export function validateCompositionSnapshot(snapshot, viewport) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      typeof snapshot.presetId !== 'string' || !snapshot.presetId ||
      !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
      typeof snapshot.updatedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.updatedAt)) ||
      !['manual', 'grid'].includes(snapshot.layoutMode) ||
      !Array.isArray(snapshot.instances)) throw new TypeError('Invalid BAP composition snapshot');

  if (snapshot.layoutMode === 'manual' && snapshot.grid != null) throw new TypeError('Manual composition cannot have grid settings');
  if (snapshot.layoutMode === 'grid' && (!snapshot.grid || typeof snapshot.grid !== 'object' || Array.isArray(snapshot.grid)))
    throw new TypeError('Grid composition requires grid settings');

  const instanceIds = new Set();
  const layouts = new Map();
  for (const item of snapshot.instances) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.instanceId !== 'string' || !item.instanceId || instanceIds.has(item.instanceId) ||
        typeof item.componentId !== 'string' || !item.componentId ||
        (item.sourceKey != null && (typeof item.sourceKey !== 'string' || !item.sourceKey)) ||
        typeof item.name !== 'string' || !item.name || !statuses.has(item.status) ||
        (item.embeddedPath != null && (typeof item.embeddedPath !== 'string' || !item.embeddedPath)) ||
        typeof item.enabled !== 'boolean' || typeof item.userVisible !== 'boolean' ||
        !item.layout || typeof item.layout !== 'object' ||
        !item.config || typeof item.config !== 'object' || Array.isArray(item.config) ||
        !Number.isSafeInteger(item.configRevision) || item.configRevision < 0)
      throw new TypeError('Invalid BAP composition instance');
    if (item.status === 'available' && (typeof item.sourceKey !== 'string' || !item.sourceKey || typeof item.embeddedPath !== 'string' || !item.embeddedPath))
      throw new TypeError('Available BAP components require a source and embedded entry point');
    instanceIds.add(item.instanceId);
    layouts.set(item.instanceId, item.layout);
  }

  resolveLayouts(layouts, snapshot.layoutMode, snapshot.grid ?? undefined, viewport);
  return true;
}

export function nextEffectiveConfigRevision(incomingRevision, currentRevision) {
  if (!Number.isSafeInteger(incomingRevision) || incomingRevision < 0 ||
      !Number.isSafeInteger(currentRevision) || currentRevision < 0)
    throw new TypeError('Configuration revisions must be non-negative safe integers');
  return Math.max(incomingRevision, currentRevision + 1);
}

export function effectiveRuntimeLayout(instanceId, presetLayout, runtimeLayouts) {
  return runtimeLayouts.has(instanceId) ? runtimeLayouts.get(instanceId) : presetLayout;
}
