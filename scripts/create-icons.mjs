// Generates PWA PNG icons using only built-in Node.js modules.
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";

function u32(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n);
  return b;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
}

function makeIcon(size) {
  const cx = size / 2, cy = size / 2;
  // Background: #0B1220  Accent: #3B82F6
  const BG  = [0x0b, 0x12, 0x20];
  const ACC = [0x3b, 0x82, 0xf6];
  const MID = [0x17, 0x28, 0x44]; // slightly lighter navy for inner diamond

  const outerR = size * 0.36;
  const innerR = size * 0.13;

  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // row filter = None
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - cx) + Math.abs(y - cy); // Manhattan → diamond
      if (dist < innerR) {
        raw.push(...MID);
      } else if (dist < outerR) {
        raw.push(...ACC);
      } else {
        raw.push(...BG);
      }
    }
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.from(raw))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });

for (const size of [192, 512]) {
  writeFileSync(`public/pwa-${size}x${size}.png`, makeIcon(size));
  console.log(`✓ pwa-${size}x${size}.png`);
}
writeFileSync("public/apple-touch-icon.png", makeIcon(180));
console.log("✓ apple-touch-icon.png (180x180)");
