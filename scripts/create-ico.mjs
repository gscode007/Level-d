// Creates build-assets/icon.ico from the existing 512x512 PNG icon
// Uses a modern ICO format that embeds the PNG directly (Windows Vista+)
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

mkdirSync(join(root, 'build-assets'), { recursive: true });

const png  = readFileSync(join(root, 'public', 'pwa-512x512.png'));
const size = png.length;

// ICO format: 6-byte ICONDIR + 16-byte ICONDIRENTRY + PNG data
const buf = Buffer.alloc(6 + 16 + size);

// ICONDIR
buf.writeUInt16LE(0, 0);   // reserved
buf.writeUInt16LE(1, 2);   // type = 1 (icon)
buf.writeUInt16LE(1, 4);   // count = 1

// ICONDIRENTRY  (0 in width/height = 256, acceptable for modern Windows)
buf.writeUInt8(0,   6);    // width  (0 = 256)
buf.writeUInt8(0,   7);    // height (0 = 256)
buf.writeUInt8(0,   8);    // color count
buf.writeUInt8(0,   9);    // reserved
buf.writeUInt16LE(1, 10);  // planes
buf.writeUInt16LE(32, 12); // bit count
buf.writeUInt32LE(size, 14);  // bytes in image
buf.writeUInt32LE(22, 18);    // offset to image data (6 + 16)

png.copy(buf, 22);

writeFileSync(join(root, 'build-assets', 'icon.ico'), buf);
console.log('✓ build-assets/icon.ico created');
