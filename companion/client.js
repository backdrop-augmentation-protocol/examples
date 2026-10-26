const PROTOCOL = { name: 'bap', version: '0.1.0', profile: 'core' };

export async function connectCompanion({ baseUrl = 'http://127.0.0.1:4311', clientName = 'BAP Host Wallpaper Demo', clientKind = 'host' } = {}) {
  const httpBase = baseUrl.replace(/\/$/, '');
  const sessionResponse = await fetch(`${httpBase}/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientName, clientKind, protocol: PROTOCOL }) });
  if (!sessionResponse.ok) throw new Error(`Companion session failed: HTTP ${sessionResponse.status}`);
  const session = await sessionResponse.json();
  const socket = new WebSocket(`${httpBase.replace(/^http/, 'ws')}/v1/ws?token=${encodeURIComponent(session.accessToken)}`);
  const pending = new Map();
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); const request = pending.get(message.correlationId); if (!request) return; pending.delete(message.correlationId); if (message.ok) request.resolve(message.result); else request.reject(new Error(message.error?.message || 'Companion request failed')); });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Companion WebSocket connection failed')), { once: true }); });
  const request = (method, payload = {}) => { const message = { protocol: PROTOCOL, kind: 'request', id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: new Date().toISOString(), method, payload, sessionId: session.sessionId }; return new Promise((resolve, reject) => { pending.set(message.id, { resolve, reject }); socket.send(JSON.stringify(message)); }); };
  const hello = await request('hello', { role: 'host', identity: { id: 'org.bap.examples.host-wallpaper', name: clientName, version: '0.1.0' }, protocolVersions: ['0.1.0'], capabilities: ['component-discovery', 'config'], requestedPermissions: ['component.discovery', 'config.read', 'config.write'] });
  if (hello?.role !== 'companion' || hello.selectedProtocol?.version !== PROTOCOL.version) throw new Error('Companion hello acknowledgement is invalid');
  const authFetch = (path, options = {}) => fetch(`${httpBase}${path}`, { ...options, headers: { authorization: `Bearer ${session.accessToken}`, ...(options.headers || {}) } });
  async function readJson(path, label) { const response = await authFetch(path); if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`); return response.json(); }
  return {
    session,
    hello,
    socket,
    listComponents() { return readJson('/v1/components', 'Companion component discovery failed'); },
    listEffectiveComponents(hostId) { return readJson(`/v1/hosts/${encodeURIComponent(hostId)}/components`, 'Companion preset read failed'); },
    getComponentManifest(id) { return readJson(`/v1/components/${encodeURIComponent(id)}/manifest`, 'Companion manifest read failed'); },
    async getComponentLaunchUrl(id) {
      const response = await authFetch(`/v1/components/${encodeURIComponent(id)}/launch`, { method: 'POST' });
      if (!response.ok) throw new Error(`Companion component launch failed: HTTP ${response.status}`);
      return (await response.json()).url;
    },
    async fetchComponentResource(id, path) { const response = await authFetch(`/v1/components/${encodeURIComponent(id)}/resources/${path.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`Companion resource read failed: HTTP ${response.status}`); return response.blob(); },
    async fetchCatalogResource(key, path) { const response = await authFetch(`/v1/catalog/components/${encodeURIComponent(key)}/resources/${path.replace(/^\.\//, '').split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`Companion catalog resource read failed: HTTP ${response.status}`); return response.blob(); },
    async loadConfig() { return readJson('/v1/config', 'Companion config read failed'); },
    async saveWallpaperConfig(id, values) { const response = await authFetch(`/v1/config/wallpapers/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) }); if (!response.ok) throw new Error(`Companion config write failed: HTTP ${response.status}`); },
    close() { socket.close(); }
  };
}
