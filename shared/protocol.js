export const PROTOCOL_VERSION = '0.1';

export function createMessage(type, source, payload = {}, id = crypto.randomUUID()) {
  return { bap: PROTOCOL_VERSION, id, type, source, payload };
}

export function isMessage(value) {
  return Boolean(value && value.bap === PROTOCOL_VERSION && typeof value.type === 'string' &&
    typeof value.source === 'string' && value.payload && typeof value.payload === 'object');
}

export function send(target, type, source, payload = {}) {
  target.postMessage(createMessage(type, source, payload), '*');
}
