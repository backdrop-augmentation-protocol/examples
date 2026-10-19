import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_MANIFEST, createFormalContractMessage, createMessage, isMessage } from '../shared/protocol.js';

test('uses the official Host SDK browser transport mapping', () => {
  const message = createMessage('request', 'config.set', { config: { locale: 'en-US' } }, 'hello');
  assert.equal(message.bap, 'message');
  assert.equal(message.protocolVersion, '0.1');
  assert.equal(message.kind, 'request');
  assert.equal(message.name, 'config.set');
  assert.equal(message.correlationId, 'hello');
  assert.equal(isMessage(message), true);
});

test('component manifest is dual-mode and SDK-compatible', () => {
  assert.deepEqual(COMPONENT_MANIFEST.entry, { embedded: '../component/', standalone: '../component/' });
  assert.deepEqual(COMPONENT_MANIFEST.capabilities, ['lifecycle', 'config', 'pause-resume']);
});

test('formal Core Profile envelope remains available for contract checks', () => {
  const message = createFormalContractMessage('request', 'hello', { role: 'host' });
  assert.deepEqual(message.protocol, { name: 'bap', version: '0.1.0', profile: 'core' });
  assert.equal(message.kind, 'request');
  assert.equal(message.method, 'hello');
  assert.equal(typeof message.timestamp, 'string');
});

test('rejects malformed transport messages', () => {
  assert.equal(isMessage(null), false);
  assert.equal(isMessage({ bap: 'message', protocolVersion: '9.9', kind: 'event', name: 'x', id: '1' }), false);
  assert.equal(isMessage({ bap: 'message', protocolVersion: '0.1', kind: 'event' }), false);
});
