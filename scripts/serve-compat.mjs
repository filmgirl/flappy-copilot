import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { cabinetRoot, cabinetSha, origin, port, verifyCabinet } from './cabinet.mjs';

verifyCabinet();
const gameRoot = resolve('dist');
await readFile(resolve(gameRoot, 'index.html'));
const catalog = JSON.parse(await readFile(resolve(cabinetRoot, 'games.json'), 'utf8'));
const game = catalog.find((entry) => entry.id === 'flappy-copilot');
if (!game) throw new Error('Pinned cabinet has no flappy-copilot entry.');
game.url = '/flappy-copilot/';
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ cabinetSha }));
      return;
    }
    if (pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    if (pathname === '/arcade/games.json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(catalog));
      return;
    }
    const mount = [['/arcade/', cabinetRoot], ['/flappy-copilot/', gameRoot]]
      .find(([prefix]) => pathname.startsWith(prefix));
    if (!mount) {
      res.writeHead(404).end('Not found');
      return;
    }
    const [prefix, root] = mount;
    const file = resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      res.writeHead(404).end('Not found');
    } else {
      console.error(error);
      res.writeHead(500).end('Compatibility server error');
    }
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Candidate cabinet: ${origin}/arcade/`));
