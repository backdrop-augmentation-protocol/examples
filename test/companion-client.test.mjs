import assert from 'node:assert/strict';
import test from 'node:test';
import { companionReconnectDelayMs, connectCompanion } from '../companion/client.js';

test('Companion reconnect backoff is exponential, capped, and jittered', () => {
  assert.equal(companionReconnectDelayMs(1, () => 0.5), 3000);
  assert.equal(companionReconnectDelayMs(2, () => 0.5), 6000);
  assert.equal(companionReconnectDelayMs(20, () => 0.5), 30000);
  assert.equal(companionReconnectDelayMs(1, () => 0), 2400);
  assert.equal(companionReconnectDelayMs(1, () => 1), 3600);
});

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
  await assert.rejects(connectCompanion(), /WebSocket closed/);
  const restored = await connectCompanion();
  assert.equal(restored.session.sessionId, 'session-2');
  assert.equal(restored.hello.role, 'companion');
  restored.close();
});

test('an expired HTTP session closes its still-open socket and permits a fresh connection', async t => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  let sessions = 0;
  const sockets = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/v1/session')) return { ok: true, json: async () => ({ sessionId: `session-${++sessions}`, accessToken: `token-${sessions}` }) };
    assert.match(url, /\/v1\/components$/);
    assert.equal(options.headers.authorization, `Bearer token-${sessions}`);
    return sessions === 1 ? { ok: false, status: 401 } : { ok: true, status: 200, json: async () => [] };
  };
  globalThis.WebSocket = class {
    listeners = new Map();
    closed = false;
    constructor() { sockets.push(this); queueMicrotask(() => this.emit('open', {})); }
    addEventListener(name, listener) { const set = this.listeners.get(name) || new Set(); set.add(listener); this.listeners.set(name, set); }
    emit(name, event) { for (const listener of this.listeners.get(name) || []) listener(event); }
    send(value) {
      const message = JSON.parse(value);
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ correlationId: message.id, ok: true, result: { selectedProtocol: message.protocol, role: 'companion', capabilities: [], permissions: [] } }) }));
    }
    close() { this.closed = true; this.emit('close', {}); }
  };
  const expired = await connectCompanion();
  await assert.rejects(expired.listComponents(), /session expired: HTTP 401/);
  assert.equal(sockets[0].closed, true);
  const restored = await connectCompanion();
  assert.equal(restored.session.sessionId, 'session-2');
  assert.deepEqual(await restored.listComponents(), []);
  restored.close();
});

test('Companion hello remains pending until the server responds or closes the session', async t => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ sessionId: 'session', accessToken: 'token' }) });
  let socket;
  globalThis.WebSocket = class {
    listeners = new Map();
    constructor() { socket = this; queueMicrotask(() => this.emit('open', {})); }
    addEventListener(name, listener) { const set = this.listeners.get(name) || new Set(); set.add(listener); this.listeners.set(name, set); }
    emit(name, event) { for (const listener of this.listeners.get(name) || []) listener(event); }
    send(value) { this.request = JSON.parse(value); }
    close() { this.emit('close', {}); }
  };
  let settled = false;
  const connecting = connectCompanion().finally(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(settled, false, 'the Host must not time out authorization locally');
  socket.emit('message', { data: JSON.stringify({ correlationId: socket.request.id, ok: true, result: { selectedProtocol: socket.request.protocol, role: 'companion', capabilities: [], permissions: [] } }) });
  const companion = await connecting;
  assert.equal(companion.hello.role, 'companion');
  companion.close();
});

test('malformed Companion hello response rejects instead of throwing from an event listener', async t => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ sessionId: 'session', accessToken: 'token' }) });
  let closed = false;
  globalThis.WebSocket = class {
    listeners = new Map();
    constructor() { queueMicrotask(() => this.listeners.get('open')?.({})); }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    send() { queueMicrotask(() => this.listeners.get('message')?.({ data: '{' })); }
    close() { closed = true; }
  };
  await assert.rejects(connectCompanion(), /malformed WebSocket response/);
  assert.equal(closed, true);
});
