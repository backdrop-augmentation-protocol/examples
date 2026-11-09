import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoalescedReporter } from '../host-wallpaper/runtime-inventory-reporter.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('reports the latest empty inventory after an older snapshot is in flight', async () => {
  let instances = [{ instanceId: 'calendar-1' }];
  const firstRequest = deferred();
  const sent = [];
  const reporter = createCoalescedReporter(
    () => structuredClone(instances),
    snapshot => {
      sent.push(snapshot);
      return sent.length === 1 ? firstRequest.promise : Promise.resolve();
    },
  );

  const initialReport = reporter();
  instances = [];
  await reporter();
  assert.deepEqual(sent, [[{ instanceId: 'calendar-1' }]]);

  firstRequest.resolve();
  await initialReport;
  assert.deepEqual(sent, [[{ instanceId: 'calendar-1' }], []]);
});

test('coalesces multiple in-flight changes into the latest inventory', async () => {
  let instances = [{ instanceId: 'time-1' }];
  const firstRequest = deferred();
  const sent = [];
  const reporter = createCoalescedReporter(
    () => structuredClone(instances),
    snapshot => {
      sent.push(snapshot);
      return sent.length === 1 ? firstRequest.promise : Promise.resolve();
    },
  );

  const initialReport = reporter();
  instances = [{ instanceId: 'time-1' }, { instanceId: 'calendar-1' }];
  await reporter();
  instances = [];
  await reporter();
  firstRequest.resolve();
  await initialReport;

  assert.deepEqual(sent, [[{ instanceId: 'time-1' }], []]);
});
