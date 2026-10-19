import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessage, isMessage, PROTOCOL_VERSION } from '../shared/protocol.js';

test('creates a versioned BAP message envelope', () => {
  const message = createMessage('config.set', 'host', { config: { locale: 'en-US' } }, 'test-id');
  assert.deepEqual(message, { bap: PROTOCOL_VERSION, id: 'test-id', type: 'config.set', source: 'host', payload: { config: { locale: 'en-US' } } });
  assert.equal(isMessage(message), true);
});

test('rejects malformed or incompatible messages', () => {
  assert.equal(isMessage(null), false);
  assert.equal(isMessage({ bap: '9.9', type: 'x', source: 'host', payload: {} }), false);
  assert.equal(isMessage({ bap: PROTOCOL_VERSION, type: 'x', source: 'host' }), false);
});
