import test from 'node:test';
import assert from 'node:assert/strict';
import { HostRuntime } from '../../host-sdk/dist/index.js';
import { ComponentRuntime } from '../../component-sdk/src/runtime.js';
import { PostMessageClient } from '../../component-sdk/src/post-message-client.js';
import { BAP_PROTOCOL } from '../../component-sdk/src/protocol.js';
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

test('two official SDK components complete independent Host-driven sessions', async () => {
  const hostWindow = new FakeWindow();
  const frames = [];
  const document = { baseURI: 'https://host.test/', createElement() {
    const componentWindow = new FakeWindow();
    const iframe = { style: {}, listeners: new Map(), setAttribute() {}, addEventListener(name, listener) { this.listeners.set(name, listener); }, remove() { this.removed = true; } };
    const parent = { postMessage(message) { queueMicrotask(() => hostWindow.dispatch({ source: iframe.contentWindow, origin: 'null', data: message })); } };
    iframe.contentWindow = { postMessage(message) { queueMicrotask(() => componentWindow.dispatch({ source: parent, origin: 'https://host.test', data: message })); } };
    const manifest = { protocol: BAP_PROTOCOL, id: `example.widget-${frames.length}`, name: 'Widget', version: '0.1.0', role: 'component', capabilities: ['lifecycle'], modes: ['standalone', 'embedded'], entrypoints: { default: 'index.html', standalone: 'index.html', embedded: 'embedded.html' } };
    const client = new PostMessageClient({ target: parent, targetOrigin: '*', receiveWindow: componentWindow });
    const runtime = new ComponentRuntime({ manifest, mode: 'embedded', client });
    frames.push({ iframe, runtime, client });
    return iframe;
  } };
  const host = new HostRuntime({ window: hostWindow, document, handshakeTimeoutMs: 1000 });
  const container = { appendChild() {} };
  const handles = ['clock', 'calendar'].map(id => host.mount({ id, srcdoc: '<p>Widget</p>', container }));
  for (const { iframe, runtime } of frames) { await runtime.start(); iframe.listeners.get('load')(); }
  const deadline = Date.now() + 500;
  while (handles.some(handle => handle.state !== 'running') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
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
  host.destroy();
  frames.forEach(frame => frame.client.close());
});
