import { createServer } from 'http';
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3010;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
};

const RANGEABLE = new Set(['.mp4', '.webm', '.mov']);

const server = createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  filePath = join(__dirname, filePath);
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;
    const range = req.headers.range;

    // Range support — required for video seeking
    if (RANGEABLE.has(ext) && range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end   = match && match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    // Non-range request — for videos, advertise Range support
    const headers = { 'Content-Type': contentType, 'Content-Length': fileSize };
    if (RANGEABLE.has(ext)) headers['Accept-Ranges'] = 'bytes';
    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => console.log(`Omni Cargo site running at http://localhost:${PORT}`));
