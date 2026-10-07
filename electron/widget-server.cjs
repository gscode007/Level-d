const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

async function serveWidget(directory, port = 5174) {
  const root = path.resolve(directory);
  if (!fs.existsSync(path.join(root, 'widget.html'))) throw new Error('Build the widget first with npm run build.');
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    if (request.headers.host !== `localhost:${server.address().port}` || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(403).end(); return; }
    if (pathname !== '/widget.html' && !pathname.startsWith('/assets/')) { response.writeHead(404).end(); return; }
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      // No website service worker or dashboard navigation fallback in this window.
      const body = path.extname(file) === '.html' ? data.toString('utf8')
        .replace(/<link rel="manifest"[^>]*>/g, '')
        .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '') : data;
      response.end(request.method === 'HEAD' ? undefined : body);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, 'localhost', resolve); });
  return { server, origin: `http://localhost:${server.address().port}` };
}
module.exports = { serveWidget };
