import test from 'node:test';
import assert from 'node:assert/strict';

async function waitFor(predicate) {
  const deadline = Date.now() + 1000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(predicate(), true, 'Host connection state did not settle');
}

test('the actual Host demo reconnects to Companion after its socket closes', async t => {
  const original = Object.fromEntries(['window', 'document', 'Audio', 'fetch', 'WebSocket', 'setTimeout', 'setInterval'].map(key => [key, globalThis[key]]));
  const { HostRuntime } = await import('../dist/sdk/host-sdk/index.js');
  const originalPauseAll = HostRuntime.prototype.pauseAll;
  const originalResumeAll = HostRuntime.prototype.resumeAll;
  let pauseCalls = 0;
  let resumeCalls = 0;
  HostRuntime.prototype.pauseAll = function () { pauseCalls++; return originalPauseAll.call(this); };
  HostRuntime.prototype.resumeAll = function () { resumeCalls++; return originalResumeAll.call(this); };
  const intervals = new Set();
  const refreshCallbacks = [];
  const retryTimers = new Set();
  const sockets = [];
  t.after(() => {
    for (const timer of intervals) clearInterval(timer);
    for (const timer of retryTimers) clearTimeout(timer);
    HostRuntime.prototype.pauseAll = originalPauseAll;
    HostRuntime.prototype.resumeAll = originalResumeAll;
    for (const [key, value] of Object.entries(original)) globalThis[key] = value;
  });

  const status = { textContent: '' };
  const video = { muted: true, volume: 0, load() {}, play: async () => {}, pause() {} };
  const elements = { '#video': video, '#volume': { value: '0.5' }, '#toggle': { textContent: '' }, '#companion-status': status, '#components': { children: [], appendChild() {} } };
  globalThis.window = { addEventListener() {} };
  globalThis.document = { baseURI: 'https://host.test/', querySelector(selector) { return elements[selector]; } };
  globalThis.window.document = globalThis.document;
  globalThis.Audio = class { loop = false; volume = 0; play = async () => {}; pause() {} };
  globalThis.setTimeout = (fn, ms, ...args) => {
    const retry = ms >= 2400 && ms <= 36000;
    const timer = original.setTimeout(fn, retry ? 10 : ms, ...args);
    if (retry) retryTimers.add(timer);
    return timer;
  };
  globalThis.setInterval = (fn, ms, ...args) => { const timer = original.setInterval(fn, ms, ...args); intervals.add(timer); refreshCallbacks.push(fn); return timer; };
  let sessions = 0;
  let expireSecondSession = false;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/v1/session')) return { ok: true, json: async () => ({ sessionId: `session-${++sessions}`, accessToken: `token-${sessions}` }) };
    if (url.includes('/v1/hosts/')) return expireSecondSession && options.headers.authorization === 'Bearer token-2'
      ? { ok: false, status: 401 }
      : { ok: true, json: async () => [] };
    throw new Error(`Unexpected Host request: ${url}`);
  };
  globalThis.WebSocket = class {
    listeners = new Map();
    closed = false;
    constructor() { sockets.push(this); queueMicrotask(() => this.emit('open', {})); }
    addEventListener(name, listener) { const set = this.listeners.get(name) || new Set(); set.add(listener); this.listeners.set(name, set); }
    emit(name, event) { for (const listener of this.listeners.get(name) || []) listener(event); }
    send(value) { const request = JSON.parse(value); queueMicrotask(() => this.emit('message', { data: JSON.stringify({ correlationId: request.id, ok: true, result: { selectedProtocol: request.protocol, role: 'companion', capabilities: [], permissions: [] } }) })); }
    close() { this.closed = true; this.emit('close', {}); }
  };

  await import(new URL('../dist/host-wallpaper/main.js', import.meta.url));
  await waitFor(() => status.textContent.startsWith('Companion: connected') && sessions === 1);
  assert.equal(typeof window.wallpaperPropertyListener.setPaused, 'function');
  window.wallpaperPropertyListener.setPaused(true);
  assert.equal(pauseCalls, 1);
  window.wallpaperPropertyListener.setPaused(false);
  assert.equal(resumeCalls, 1);
  sockets[0].emit('close', {});
  assert.match(status.textContent, /^Companion: offline; reconnecting/);
  await waitFor(() => status.textContent.startsWith('Companion: connected') && sessions === 2);
  assert.equal(sockets.length, 2);
  expireSecondSession = true;
  await refreshCallbacks.at(-1)();
  await waitFor(() => status.textContent.startsWith('Companion: connected') && sessions === 3);
  assert.equal(sockets[1].closed, true);
  assert.equal(sockets.length, 3);
});
