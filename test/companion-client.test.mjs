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
  const diagnostics = [];
  t.after(() => { globalThis.fetch = originalFetch; globalThis.WebSocket = originalSocket; });
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/v1/session')) return { ok: true, json: async () => ({ sessionId: 'test-session', accessToken: 'test-token' }) };
    if (url.endsWith('/v1/diagnostics')) return { ok: true };
    if (url.endsWith('/v1/runtime/snapshot')) return { ok: true };
    if (url.endsWith('/v1/runtime/commands')) return { ok: true, json: async () => [{ instanceId: 'clock-1', config: { format: '24h' }, configRevision: 3 }] };
  if (url.includes('/v1/hosts/')) return { ok: true, json: async () => url.includes('/composition') ? { presetId: 'demo', revision: 1, updatedAt: '2026-11-07T00:00:00Z', layoutMode: 'grid', grid: { columns: 2 }, instances: [] } : [] };
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
  const companion = await connectCompanion({ diagnosticInstanceId: 'a'.repeat(32), onDiagnostic: entry => diagnostics.push(entry), projectUrl: 'file:///D:/wallpapers/local-host/index.html' });
  await companion.listEffectiveComponents('org.example.host');
  const composition = await companion.getComposition('org.example.host');
  assert.equal(composition.layoutMode, 'grid');
  await companion.reportRuntimeSnapshot('org.example.host', 'Demo host', []);
  assert.deepEqual(await companion.getRuntimeCommands(), [{ instanceId: 'clock-1', config: { format: '24h' }, configRevision: 3 }]);
  const resource = await companion.fetchCatalogResource('workshop:123', './embedded.html');
  assert.equal(await resource.text(), '<p>clock</p>');
  const fetchRequest = requests.find(item => item.url.includes('/resources/'));
  const sessionRequest = requests.find(item => item.url.endsWith('/v1/session'));
  assert.equal(sessionRequest.options.headers['X-BAP-Diagnostic-Instance'], 'a'.repeat(32));
  const diagnosticRequest = requests.find(item => item.url.endsWith('/v1/diagnostics'));
  assert.equal(diagnosticRequest.options.headers.authorization, 'Bearer test-token');
  assert.equal(JSON.parse(diagnosticRequest.options.body).pageInstanceId, 'a'.repeat(32));
  assert.deepEqual(diagnostics.map(entry => entry.event), ['session-created', 'hello-sending', 'hello-accepted']);
  assert.equal(fetchRequest.options.cache, 'no-store');
  assert.equal(fetchRequest.options.headers.authorization, 'Bearer test-token');
  assert.match(fetchRequest.url, /workshop%3A123\/resources\/embedded\.html$/);
  const effectiveRequest = requests.find(item => item.url.includes('/v1/hosts/'));
  assert.match(effectiveRequest.url, /projectUrl=file%3A%2F%2F%2FD%3A%2Fwallpapers%2Flocal-host%2Findex\.html$/);
  const compositionRequest = requests.find(item => item.url.includes('/composition'));
  assert.match(compositionRequest.url, /\/v1\/hosts\/org\.example\.host\/composition\?projectUrl=/);
  assert.equal(compositionRequest.options.cache, 'no-store');
  const runtimeReport = requests.find(item => item.url.endsWith('/v1/runtime/snapshot'));
  assert.equal(JSON.parse(runtimeReport.options.body).hostId, 'org.example.host');
  assert.equal(runtimeReport.options.headers.authorization, 'Bearer test-token');
  assert.equal(requests.find(item => item.url.endsWith('/v1/runtime/commands')).options.cache, 'no-store');
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
