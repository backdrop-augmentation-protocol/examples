import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg' };
const server = http.createServer(async (req, res) => {
  try {
    let path = normalize(join(root, decodeURIComponent(req.url === '/' ? '/host-wallpaper/' : req.url)));
    if (!path.startsWith(root)) return send(res, { error: 'forbidden' }, 403);
    if (!extname(path)) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }); res.end(await readFile(path));
  } catch (error) { if (!res.headersSent) send(res, { error: error.message }, error.code === 'ENOENT' ? 404 : 500); else res.destroy(); }
});
function send(res, data, status = 200) { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(data)); }
const port = Number(process.env.PORT ?? 4173);
server.listen(port, '127.0.0.1', () => console.log(`BAP examples: http://127.0.0.1:${port}/host-wallpaper/`));
