const PROTOCOL = { name: 'bap', version: '0.1.0', profile: 'core' };

export const COMPANION_POLICY = Object.freeze({
  componentRefreshIntervalMs: 1500,
  reconnectInitialDelayMs: 3000,
  reconnectMaximumDelayMs: 30000,
  reconnectMultiplier: 2,
  reconnectJitterRatio: 0.2,
  reconnectResetAfterMs: 30000,
});

export function companionReconnectDelayMs(failedAttempts, random = Math.random) {
  const attempt = Math.max(1, Math.floor(failedAttempts));
  const base = Math.min(
    COMPANION_POLICY.reconnectInitialDelayMs * COMPANION_POLICY.reconnectMultiplier ** (attempt - 1),
    COMPANION_POLICY.reconnectMaximumDelayMs,
  );
  const jitter = (random() * 2 - 1) * COMPANION_POLICY.reconnectJitterRatio;
  return Math.round(base * (1 + jitter));
}

export async function connectCompanion({ baseUrl = 'http://127.0.0.1:4311', clientName = 'BAP Host Wallpaper Demo', clientKind = 'host', diagnosticInstanceId, onDiagnostic } = {}) {
  const httpBase = baseUrl.replace(/\/$/, '');
  let session;
  const report = (event, details = {}) => {
    const entry = { event, at: new Date().toISOString(), pageInstanceId: diagnosticInstanceId, ...details };
    try { onDiagnostic?.(entry); } catch { /* Diagnostics must never interfere with Host behavior. */ }
    if (diagnosticInstanceId && session?.accessToken) {
      void fetch(`${httpBase}/v1/diagnostics`, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(entry),
        keepalive: true,
        cache: 'no-store',
      }).catch(() => {});
    }
  };
  const headers = { 'content-type': 'application/json' };
  if (diagnosticInstanceId) headers['X-BAP-Diagnostic-Instance'] = diagnosticInstanceId;
  const sessionResponse = await fetch(`${httpBase}/v1/session`, { method: 'POST', headers, body: JSON.stringify({ clientName, clientKind, protocol: PROTOCOL }) });
  if (!sessionResponse.ok) throw new Error(`Companion session failed: HTTP ${sessionResponse.status}`);
  session = await sessionResponse.json();
  report('session-created', { sessionId: session.sessionId, diagnosticInstanceId });
  const socket = new WebSocket(`${httpBase.replace(/^http/, 'ws')}/v1/ws?token=${encodeURIComponent(session.accessToken)}`);
  const pending = new Map();
  let disconnected = false;
  const rejectPending = (message) => { disconnected = true; for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error(message)); } pending.clear(); };
  socket.addEventListener('open', () => report('websocket-open', { sessionId: session.sessionId }));
  socket.addEventListener('close', (event) => { report('websocket-close', { sessionId: session.sessionId, code: event.code, reason: event.reason, wasClean: event.wasClean, readyState: socket.readyState }); rejectPending('Companion WebSocket closed'); });
  socket.addEventListener('error', (event) => { report('websocket-error', { sessionId: session.sessionId, message: event.message || 'WebSocket error', readyState: socket.readyState }); rejectPending('Companion WebSocket connection failed'); });
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); }
    catch { rejectPending('Companion sent a malformed WebSocket response'); socket.close(); return; }
    const item = pending.get(message?.correlationId);
    if (!item) return;
    pending.delete(message.correlationId); clearTimeout(item.timer);
    if (message.ok) item.resolve(message.result); else item.reject(new Error(`${message.error?.code ? `${message.error.code}: ` : ''}${message.error?.message || 'Companion request failed'}`));
  });
  let hello;
  try {
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Companion WebSocket connection failed')), { once: true }); socket.addEventListener('close', () => reject(new Error('Companion WebSocket closed before opening')), { once: true }); });
    report('hello-sending', { sessionId: session.sessionId });
    const request = (method, payload = {}) => { const message = { protocol: PROTOCOL, kind: 'request', id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: new Date().toISOString(), method, payload, sessionId: session.sessionId }; return new Promise((resolve, reject) => { if (disconnected) { reject(new Error('Companion WebSocket is disconnected')); return; } const timer = method === 'hello' ? undefined : setTimeout(() => { pending.delete(message.id); reject(new Error(`Companion ${method} timed out`)); }, 300000); pending.set(message.id, { resolve, reject, timer }); try { socket.send(JSON.stringify(message)); } catch (error) { if (timer) clearTimeout(timer); pending.delete(message.id); reject(error); } }); };
    hello = await request('hello', { role: 'host', identity: { id: 'org.bap.examples.host-wallpaper', name: clientName, version: '0.1.0' }, protocolVersions: ['0.1.0'], capabilities: ['component-discovery', 'config'], requestedPermissions: ['component.discovery', 'config.read', 'config.write'] });
    if (hello?.role !== 'companion' || hello.selectedProtocol?.name !== PROTOCOL.name || hello.selectedProtocol.profile !== PROTOCOL.profile || hello.selectedProtocol.version !== PROTOCOL.version) throw new Error('Companion hello acknowledgement is invalid');
    report('hello-accepted', { sessionId: session.sessionId, protocol: hello.selectedProtocol });
  } catch (error) { report('connect-failed', { sessionId: session.sessionId, message: error instanceof Error ? error.message : String(error), readyState: socket.readyState }); socket.close(); throw error; }
  const authFetch = async (path, options = {}) => {
    const response = await fetch(`${httpBase}${path}`, { ...options, headers: { authorization: `Bearer ${session.accessToken}`, ...(options.headers || {}) } });
    // A session can expire while its WebSocket remains open. Closing the socket
    // lets the Host's existing reconnect path obtain a fresh session.
    if (response.status === 401) {
      report('http-unauthorized-closing-socket', { sessionId: session.sessionId, path });
      socket.close();
      throw new Error('Companion session expired: HTTP 401');
    }
    return response;
  };
  async function readJson(path, label) { const response = await authFetch(path); if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`); return response.json(); }
  return {
    session,
    hello,
    socket,
    reportDiagnostic(event, details = {}) { report(event, { sessionId: session.sessionId, ...details }); },
    listComponents() { return readJson('/v1/components', 'Companion component discovery failed'); },
    listEffectiveComponents(hostId) { return readJson(`/v1/hosts/${encodeURIComponent(hostId)}/components`, 'Companion preset read failed'); },
    getComponentManifest(id) { return readJson(`/v1/components/${encodeURIComponent(id)}/manifest`, 'Companion manifest read failed'); },
    async fetchComponentResource(id, path) { const response = await authFetch(`/v1/components/${encodeURIComponent(id)}/resources/${path.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`Companion resource read failed: HTTP ${response.status}`); return response.blob(); },
    async fetchCatalogResource(key, path) { const response = await authFetch(`/v1/catalog/components/${encodeURIComponent(key)}/resources/${path.replace(/^\.\//, '').split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`Companion catalog resource read failed: HTTP ${response.status}`); return response.blob(); },
    async loadConfig() { return readJson('/v1/config', 'Companion config read failed'); },
    async saveWallpaperConfig(id, values) { const response = await authFetch(`/v1/config/wallpapers/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) }); if (!response.ok) throw new Error(`Companion config write failed: HTTP ${response.status}`); },
    close() { socket.close(); }
  };
}
