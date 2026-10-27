import assert from 'node:assert/strict';
import test from 'node:test';
import { connectCompanion } from '../companion/client.js';

test('reads embedded resources without using the HTTP cache', async t => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/v1/session')) return { ok: true, json: async () => ({ sessionId: 'test-session', accessToken: 'test-token' }) };
    if (url.includes('/resources/')) return { ok: true, blob: async () => new Blob(['<p>clock</p>']) };
    throw new Error(`Unexpected request: ${url}`);
  };
  globalThis.WebSocket = class {
    listeners = new Map();
    constructor() { queueMicrotask(() => this.listeners.get('open')?.({})); }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    send(value) {
      const message = JSON.parse(value);
      assert.deepEqual(message.payload.protocolVersions, ['0.1.0']);
      queueMicrotask(() => this.listeners.get('message')?.({ data: JSON.stringify({ correlationId: message.id, ok: true, result: { selectedProtocol: message.protocol, role: 'companion', capabilities: [], permissions: [] } }) }));
    }
    close() {}
  };
  const companion = await connectCompanion();
  const resource = await companion.fetchCatalogResource('workshop:123', './embedded.html');
  assert.equal(await resource.text(), '<p>clock</p>');
  const fetchRequest = requests.find(item => item.url.includes('/resources/'));
  assert.equal(fetchRequest.options.cache, 'no-store');
  assert.equal(fetchRequest.options.headers.authorization, 'Bearer test-token');
  assert.match(fetchRequest.url, /workshop%3A123\/resources\/embedded\.html$/);
  companion.close();
});

test('a dropped Companion hello rejects promptly and a fresh session can connect', async t => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  let sessionNumber = 0;
  globalThis.fetch = async (url) => {
    assert.match(url, /\/v1\/session$/);
    sessionNumber += 1;
    return { ok: true, json: async () => ({ sessionId: `session-${sessionNumber}`, accessToken: `token-${sessionNumber}` }) };
  };
  const sockets = [];
  globalThis.WebSocket = class {
    listeners = new Map();
    constructor() { sockets.push(this); queueMicrotask(() => this.emit('open', {})); }
    addEventListener(name, listener) { const set = this.listeners.get(name) || new Set(); set.add(listener); this.listeners.set(name, set); }
    emit(name, event) { for (const listener of this.listeners.get(name) || []) listener(event); }
    send(value) {
      const message = JSON.parse(value);
      if (sockets.length === 1) { queueMicrotask(() => this.close()); return; }
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ correlationId: message.id, ok: true, result: { selectedProtocol: message.protocol, role: 'companion', capabilities: [], permissions: [] } }) }));
    }
    close() { this.emit('close', {}); }
  };
  await assert.rejects(connectCompanion({ handshakeTimeoutMs: 100 }), /WebSocket closed/);
  const restored = await connectCompanion({ handshakeTimeoutMs: 100 });
  assert.equal(restored.session.sessionId, 'session-2');
  assert.equal(restored.hello.role, 'companion');
  restored.close();
});

test('Companion hello timeout does not leave a pending connection', async t => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ sessionId: 'session', accessToken: 'token' }) });
  let closed = false;
  globalThis.WebSocket = class {
    listeners = new Map();
    constructor() { queueMicrotask(() => this.listeners.get('open')?.({})); }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    send() {}
    close() { closed = true; }
  };
  await assert.rejects(connectCompanion({ handshakeTimeoutMs: 10 }), /hello timed out/);
  assert.equal(closed, true);
});
