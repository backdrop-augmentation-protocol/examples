/**
 * BAP example transport adapter.
 *
 * The normative contract lives in the `spec` repository. The official Host
 * SDK currently exposes the browser transport as a compact `bap: message`
 * mapping, so this file only adapts that public SDK mapping for the example
 * component. It is not an alternative protocol definition.
 */
export const PROTOCOL_VERSION = '0.1';

export function isMessage(value) {
  return Boolean(value && value.bap === 'message' && value.protocolVersion === PROTOCOL_VERSION &&
    typeof value.id === 'string' && typeof value.kind === 'string' && typeof value.name === 'string');
}

export const COMPONENT_MANIFEST = Object.freeze({
  manifestVersion: PROTOCOL_VERSION,
  id: 'org.bap.examples.clock',
  name: 'BAP Example Clock',
  version: '0.1.0',
  entry: { embedded: '../component/', standalone: '../component/' },
  capabilities: ['lifecycle', 'config', 'pause-resume'],
  permissions: []
});

export function createMessage(kind, name, payload = {}, correlationId) {
  return {
    bap: 'message',
    id: globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}`,
    protocolVersion: PROTOCOL_VERSION,
    kind,
    name,
    ...(correlationId ? { correlationId } : {}),
    payload
  };
}

export function postMessage(target, message) {
  target.postMessage(message, '*');
}

export function createFormalContractMessage(kind, name, payload = {}) {
  return {
    protocol: { name: 'bap', version: '0.1.0', profile: 'core' },
    kind,
    id: globalThis.crypto?.randomUUID?.() ?? `contract-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...(kind === 'request' ? { method: name } : { event: name }),
    payload
  };
}

export class ComponentTransportAdapter {
  constructor({ target = globalThis.window?.parent, receiveWindow = globalThis.window } = {}) {
    this.target = target;
    this.receiveWindow = receiveWindow;
    this.listeners = new Map();
    this.onRequestListeners = new Set();
    this.handleMessage = (event) => {
      if (event.source && event.source !== this.target) return;
      if (!isMessage(event.data)) return;
      const message = event.data;
      if (message.kind === 'request') {
        for (const listener of this.onRequestListeners) listener(message);
      } else {
        for (const listener of this.listeners.get(message.name) ?? []) listener(message.payload, message);
      }
    };
    receiveWindow?.addEventListener('message', this.handleMessage);
  }

  on(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
    return () => this.listeners.get(name)?.delete(listener);
  }

  onRequest(listener) {
    this.onRequestListeners.add(listener);
    return () => this.onRequestListeners.delete(listener);
  }

  respond(request, payload = {}) {
    postMessage(this.target, createMessage('response', request.name === 'host.hello' ? 'component.hello' : request.name, payload, request.id));
  }

  notify(name, payload = {}) {
    postMessage(this.target, createMessage('event', name, payload));
  }

  close() {
    this.receiveWindow?.removeEventListener('message', this.handleMessage);
    this.listeners.clear();
    this.onRequestListeners.clear();
  }
}
