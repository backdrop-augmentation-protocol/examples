import assert from 'node:assert/strict';
import test from 'node:test';
import { HostRuntime } from '@backdrop-augmentation-protocol/host-sdk';

const protocol = { name: 'bap', version: '0.1.0', profile: 'core' };
const componentConfigExtension = { id: 'org.bap.component-config', version: '0.1.0' };

class FakeWindow {
  listeners = new Set();
  addEventListener(name, listener) { if (name === 'message') this.listeners.add(listener); }
  removeEventListener(name, listener) { if (name === 'message') this.listeners.delete(listener); }
  dispatch(event) { for (const listener of this.listeners) listener(event); }
}

function createRawComponentHost() {
  const hostWindow = new FakeWindow();
  const componentWindow = new FakeWindow();
  const calls = [];
  const receivedConfig = [];
  let iframe;
  let sessionId;
  const parent = {
    postMessage(message) {
      queueMicrotask(() => hostWindow.dispatch({ source: iframe.contentWindow, origin: 'null', data: message }));
    },
  };
  componentWindow.addEventListener('message', ({ data }) => {
    if (data?.kind === 'event' && data.event === 'component.config.changed') {
      receivedConfig.push(data.payload);
      return;
    }
    if (data?.kind !== 'request') return;
    calls.push(data.method);
    const result = data.method === 'hello' ? {
      selectedProtocol: protocol,
      role: 'component',
      capabilities: ['lifecycle'],
      permissions: [],
      selectedExtensions: [componentConfigExtension],
    } : {};
    sessionId ??= 'third-party-session';
    parent.postMessage({ protocol, kind: 'response', id: `raw-${data.id}`, correlationId: data.id,
      sessionId, timestamp: new Date().toISOString(), ok: true, result });
  });

  const document = {
    documentElement: { clientWidth: 1280, clientHeight: 720 },
    createElement(name) {
      if (name === 'div') return { style: {}, appendChild(child) { this.child = child; }, remove() { this.removed = true; } };
      iframe = { style: {}, listeners: new Map(), setAttribute() {}, addEventListener(event, listener) { this.listeners.set(event, listener); },
        remove() { this.removed = true; }, contentWindow: { postMessage(message) {
          queueMicrotask(() => componentWindow.dispatch({ source: parent, origin: 'null', data: message }));
        } } };
      return iframe;
    },
  };
  const host = new HostRuntime({ window: hostWindow, document,
    extensions: [{ id: componentConfigExtension.id, versions: [componentConfigExtension.version] }] });
  const handle = host.mount({ instanceId: 'raw-widget-instance', componentId: 'org.example.raw-widget',
    srcdoc: '<main>Independent BAP implementation</main>', container: { appendChild() {} },
    config: { label: 'Delivered by Host' }, configRevision: 1 });
  iframe.listeners.get('load')();
  return { host, handle, calls, receivedConfig, close: () => host.destroy() };
}

async function waitFor(predicate) {
  const deadline = Date.now() + 500;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(predicate(), true, 'raw Component did not reach the expected interop state');
}

test('an independent raw postMessage Component interoperates without the official Component SDK', async () => {
  const { handle, calls, receivedConfig, close } = createRawComponentHost();
  try {
    await waitFor(() => handle.state === 'running' && receivedConfig.length > 0);
    assert.deepEqual(calls, ['hello', 'initialize', 'start']);
    assert.equal(handle.componentId, 'org.example.raw-widget');
    assert.equal(handle.instanceId, 'raw-widget-instance');
    assert.deepEqual(receivedConfig, [{ instanceId: 'raw-widget-instance', revision: 1, config: { label: 'Delivered by Host' } }]);
    assert.equal(handle.state, 'running');
  } finally {
    close();
  }
});
