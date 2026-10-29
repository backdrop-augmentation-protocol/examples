import test from 'node:test';
import assert from 'node:assert/strict';
import { HostRuntime } from '@backdrop-augmentation-protocol/host-sdk';
import { BAP_PROTOCOL, ComponentRuntime, PostMessageClient } from '@backdrop-augmentation-protocol/component-sdk';
import { readFile } from 'node:fs/promises';

test('browser interop harness stays out of Workshop packages', async () => {
  const page = await readFile(new URL('../dist/host-wallpaper/local-interop.html', import.meta.url), 'utf8');
  assert.match(page, /Local SDK interop check/);
  await assert.rejects(readFile(new URL('../dist/workshop-host-wallpaper/local-interop.html', import.meta.url)));
});

class FakeWindow {
  listeners = new Map();
  addEventListener(name, listener) { const listeners = this.listeners.get(name) || new Set(); listeners.add(listener); this.listeners.set(name, listeners); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  dispatch(event) { for (const listener of this.listeners.get('message') || []) listener(event); }
}

function createInterop(behaviors = [], handshakeTimeoutMs = 1000) {
  const hostWindow = new FakeWindow();
  const frames = [];
  const document = { baseURI: 'https://host.test/', createElement() {
    const behavior = behaviors[frames.length] || {};
    const componentWindow = new FakeWindow();
    const iframe = { style: {}, listeners: new Map(), setAttribute() {}, addEventListener(name, listener) { this.listeners.set(name, listener); }, remove() { this.removed = true; } };
    const parent = { postMessage(message) { queueMicrotask(() => hostWindow.dispatch({ source: iframe.contentWindow, origin: 'null', data: message })); } };
    iframe.contentWindow = { postMessage(message) {
      if (behavior.drop?.(message)) return;
      const delivered = behavior.transform?.(message) ?? message;
      queueMicrotask(() => componentWindow.dispatch({ source: parent, origin: 'https://host.test', data: delivered }));
    } };
    const manifest = { protocol: BAP_PROTOCOL, id: `example.widget-${frames.length}`, name: 'Widget', version: '0.1.0', role: 'component', capabilities: ['lifecycle'], modes: ['standalone', 'embedded'], entrypoints: { default: 'index.html', standalone: 'index.html', embedded: 'embedded.html' } };
    const client = new PostMessageClient({ target: parent, targetOrigin: '*', receiveWindow: componentWindow });
    const runtime = new ComponentRuntime({ manifest, mode: 'embedded', client });
    frames.push({ iframe, runtime, client });
    return iframe;
  } };
  const host = new HostRuntime({ window: hostWindow, document, handshakeTimeoutMs });
  const container = { appendChild() {} };
  const mount = (id) => host.mount({ id, srcdoc: '<p>Widget</p>', container });
  const startFrames = async () => { for (const { iframe, runtime } of frames) { await runtime.start(); iframe.listeners.get('load')(); } };
  const close = () => { host.destroy(); frames.forEach(frame => frame.client.close()); };
  return { host, frames, mount, startFrames, close };
}

async function waitFor(predicate) {
  const deadline = Date.now() + 600;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(predicate(), true, 'interop state did not settle');
}

test('two official SDK components complete independent Host-driven sessions', async () => {
  const { host, frames, mount, startFrames, close } = createInterop();
  const handles = ['clock', 'calendar'].map(mount);
  await startFrames();
  await waitFor(() => handles.every(handle => handle.state === 'running'));
  assert.deepEqual(handles.map(handle => handle.state), ['running', 'running']);
  assert.deepEqual(frames.map(frame => frame.runtime.state), ['running', 'running']);
  assert.notEqual(handles[0].sessionId, handles[1].sessionId);
  host.pauseAll();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(handles.map(handle => handle.state), ['paused', 'paused']);
  assert.deepEqual(frames.map(frame => frame.runtime.state), ['paused', 'paused']);
  host.resumeAll();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(handles.map(handle => handle.state), ['running', 'running']);
  host.unmount('clock');
  assert.equal(handles[0].state, 'stopped');
  assert.equal(handles[1].state, 'running');
  close();
});

for (const [name, transform, expectedCode] of [
  ['malformed hello', (message) => message.method === 'hello' ? { ...message, payload: { ...message.payload, role: 'component' } } : message, 'INVALID_MESSAGE'],
  ['unsupported version', (message) => message.method === 'hello' ? { ...message, payload: { ...message.payload, protocolVersions: ['9.9.9'] } } : message, 'UNSUPPORTED_VERSION'],
]) {
  test(`${name} fails only its own cross-SDK component session`, async () => {
    const { host, frames, mount, startFrames, close } = createInterop([{ transform }]);
    const handles = ['bad', 'healthy'].map(mount);
    const faults = [];
    host.on('componentFault', fault => faults.push(fault));
    await startFrames();
    await waitFor(() => handles[0].state === 'failed' && handles[1].state === 'running');
    assert.equal(faults.length, 1);
    assert.equal(faults[0].error.code, expectedCode);
    assert.equal(frames[1].runtime.state, 'running');
    close();
  });
}

test('one cross-SDK handshake timeout does not stop the other component', async () => {
  const { host, frames, mount, startFrames, close } = createInterop([{ drop: message => message.method === 'hello' }], 25);
  const handles = ['silent', 'healthy'].map(mount);
  const faults = [];
  host.on('componentFault', fault => faults.push(fault));
  await startFrames();
  await waitFor(() => handles[0].state === 'failed' && handles[1].state === 'running');
  assert.equal(faults[0].error.code, 'TIMEOUT');
  assert.equal(frames[1].runtime.state, 'running');
  close();
});

test('a fault reported by one official Component SDK leaves its sibling usable', async () => {
  const { host, frames, mount, startFrames, close } = createInterop();
  const handles = ['faulty', 'healthy'].map(mount);
  const faults = [];
  host.on('componentFault', fault => faults.push(fault));
  await startFrames();
  await waitFor(() => handles.every(handle => handle.state === 'running'));
  frames[0].client.notify('component.fault', { message: 'test fault' });
  await waitFor(() => handles[0].state === 'failed');
  assert.equal(faults.length, 1);
  assert.equal(faults[0].error.code, 'INTERNAL_ERROR');
  host.pauseAll();
  await waitFor(() => handles[1].state === 'paused');
  host.resumeAll();
  await waitFor(() => handles[1].state === 'running');
  assert.equal(frames[1].runtime.state, 'running');
  close();
});
