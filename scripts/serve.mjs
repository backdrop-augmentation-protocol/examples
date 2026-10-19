import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const configPath = join(root, 'companion', 'mock-state.json');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') return send(res, { name: 'BAP Companion Mock', status: 'ready' });
    if (req.url === '/api/config') {
      if (req.method === 'PUT') { const body = await bodyOf(req); await writeFile(configPath, JSON.stringify(body.config ?? body)); return send(res, { ok: true }); }
      return send(res, { config: JSON.parse(await readFile(configPath, 'utf8')) });
    }
    let path = normalize(join(root, decodeURIComponent(req.url === '/' ? '/host/' : req.url)));
    if (!path.startsWith(root)) return send(res, { error: 'forbidden' }, 403);
    if (!extname(path)) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }); res.end(await readFile(path));
  } catch (error) { send(res, { error: error.message }, error.code === 'ENOENT' ? 404 : 500); }
});
function bodyOf(req) { return new Promise((resolveBody, reject) => { let data = ''; req.on('data', chunk => data += chunk); req.on('end', () => resolveBody(JSON.parse(data || '{}'))); req.on('error', reject); }); }
function send(res, data, status = 200) { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(data)); }
const port = Number(process.env.PORT ?? 4173);
server.listen(port, '127.0.0.1', () => console.log(`BAP examples: http://127.0.0.1:${port}/host/`));
