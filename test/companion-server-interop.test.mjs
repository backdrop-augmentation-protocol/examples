import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { connectCompanion } from '../companion/client.js';

const serverDll = process.env.BAP_COMPANION_SERVER;

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolveClose) => socket.close(resolveClose));
  return port;
}

async function startServer(port) {
  const child = spawn('dotnet', [resolve(serverDll), '--urls', `http://127.0.0.1:${port}`], {
    env: { ...process.env, BAP_DISCOVER_STEAM_WORKSHOP: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && child.exitCode === null) {
    try { if ((await fetch(`${baseUrl}/healthz`)).ok) return { child, baseUrl }; } catch { /* starting */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  child.kill('SIGKILL');
  throw new Error(`Companion test server did not start: ${output.slice(-1200)}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}

function socketEvent(socket, name) {
  return new Promise((resolveEvent, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for WebSocket ${name}`)), 3000);
    socket.addEventListener(name, event => { clearTimeout(timer); resolveEvent(event); }, { once: true });
  });
}

test('official Host client rejects bad Companion versions and reconnects after a real server restart', { skip: !serverDll }, async () => {
  const port = await freePort();
  let server = await startServer(port);
  let client;
  try {
    const incompatible = await fetch(`${server.baseUrl}/v1/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientName: 'interop', clientKind: 'host', protocol: { name: 'bap', version: '9.9.9', profile: 'core' } }),
    });
    assert.equal(incompatible.status, 400);
    assert.equal((await incompatible.json()).code, 'UNSUPPORTED_VERSION');

    client = await connectCompanion({ baseUrl: server.baseUrl });
    assert.equal(client.hello.role, 'companion');
    assert.equal(client.hello.selectedProtocol.version, '0.1.0');
    const malformed = new WebSocket(`ws://127.0.0.1:${port}/v1/ws?token=${encodeURIComponent(client.session.accessToken)}`);
    await socketEvent(malformed, 'open');
    const rejected = socketEvent(malformed, 'message');
    malformed.send(JSON.stringify({
      protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, kind: 'request', id: 'bad-hello',
      timestamp: new Date().toISOString(), method: 'hello',
      payload: { role: 'component', identity: { id: 'wrong.role', name: 'Wrong', version: '0.1.0' }, protocolVersions: ['0.1.0'] },
    }));
    const badReply = JSON.parse((await rejected).data);
    assert.equal(badReply.correlationId, 'bad-hello');
    assert.equal(badReply.ok, false);
    assert.equal(badReply.error.code, 'UNSUPPORTED_VERSION');
    malformed.close();
    const closed = socketEvent(client.socket, 'close');
    await Promise.all([stopServer(server.child), closed]);

    server = await startServer(port);
    const restored = await connectCompanion({ baseUrl: server.baseUrl });
    try {
      assert.notEqual(restored.session.sessionId, client.session.sessionId);
      assert.equal(restored.hello.role, 'companion');
      assert.ok(Array.isArray(await restored.listComponents()));
    } finally { restored.close(); }
  } finally {
    client?.close();
    await stopServer(server.child);
  }
});

test('real Companion HTTP permissions require a live negotiated Host session', { skip: !serverDll }, async () => {
  const port = await freePort();
  const server = await startServer(port);
  let socket;
  try {
    const created = await fetch(`${server.baseUrl}/v1/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientName: 'permission test', clientKind: 'host', protocol: { name: 'bap', version: '0.1.0', profile: 'core' } }),
    });
    assert.equal(created.status, 200);
    const session = await created.json();
    const headers = { authorization: `Bearer ${session.accessToken}` };
    assert.equal((await fetch(`${server.baseUrl}/v1/config`, { headers })).status, 403);
    assert.equal((await fetch(`${server.baseUrl}/v1/config?token=${encodeURIComponent(session.accessToken)}`)).status, 401);

    socket = new WebSocket(`ws://127.0.0.1:${port}/v1/ws?token=${encodeURIComponent(session.accessToken)}`);
    await socketEvent(socket, 'open');
    const reply = socketEvent(socket, 'message');
    socket.send(JSON.stringify({
      protocol: { name: 'bap', version: '0.1.0', profile: 'core' }, kind: 'request', id: 'permission-hello',
      timestamp: new Date().toISOString(), method: 'hello',
      payload: { role: 'host', identity: { id: 'org.bap.examples.host-wallpaper', name: 'Host', version: '0.1.0' },
        protocolVersions: ['0.1.0'], capabilities: ['config'], requestedPermissions: ['config.read', 'component.discovery'] },
    }));
    const hello = JSON.parse((await reply).data);
    assert.equal(hello.ok, true);
    assert.deepEqual(hello.result.permissions, ['config.read']);
    assert.equal((await fetch(`${server.baseUrl}/v1/config`, { headers })).status, 200);
    assert.equal((await fetch(`${server.baseUrl}/v1/components`, { headers })).status, 403);
    assert.equal((await fetch(`${server.baseUrl}/v1/config/global`, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${server.baseUrl}/v1/components/example.clock/launch`, { method: 'POST', headers })).status, 404);
    assert.equal((await fetch(`${server.baseUrl}/v1/content/legacy/example.clock/index.html`)).status, 404);

    const closed = socketEvent(socket, 'close');
    socket.close();
    await closed;
    const deadline = Date.now() + 1000;
    let status;
    do {
      status = (await fetch(`${server.baseUrl}/v1/config`, { headers })).status;
      if (status === 403) break;
      await new Promise(resolveWait => setTimeout(resolveWait, 10));
    } while (Date.now() < deadline);
    assert.equal(status, 403);
  } finally {
    socket?.close();
    await stopServer(server.child);
  }
});
