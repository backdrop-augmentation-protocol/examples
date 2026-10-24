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
      queueMicrotask(() => this.listeners.get('message')?.({ data: JSON.stringify({ correlationId: message.id, ok: true, result: {} }) }));
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
