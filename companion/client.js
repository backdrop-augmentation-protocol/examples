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
  const helloResponse = await request('hello', { role: 'host', identity: { id: 'org.bap.examples.host-wallpaper', name: clientName, version: '0.1.0' }, supportedVersions: ['0.1.0'], capabilities: ['component-discovery', 'config'], requestedPermissions: ['component.discovery', 'config.read', 'config.write'] });
  const hello = helloResponse?.result ?? helloResponse;
  const authFetch = (path, options = {}) => fetch(`${httpBase}${path}`, { ...options, headers: { authorization: `Bearer ${session.accessToken}`, ...(options.headers || {}) } });
  return { session, hello, socket, async loadConfig() { const response = await authFetch('/v1/config'); if (!response.ok) throw new Error(`Companion config read failed: HTTP ${response.status}`); return response.json(); }, async saveWallpaperConfig(id, values) { const response = await authFetch(`/v1/config/wallpapers/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) }); if (!response.ok) throw new Error(`Companion config write failed: HTTP ${response.status}`); }, close() { socket.close(); } };
}
