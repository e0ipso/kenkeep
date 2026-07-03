#!/usr/bin/env node
// Generates the shipped notification icon PNG from the docs favicon palette.
// Pure Node (zlib only) — no image runtime dependency.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'src/templates-source/kenkeep/assets');
const outFile = join(outDir, 'notification-icon.png');

const SIZE = 128;
const CREAM = [0xf7, 0xf3, 0xec, 0xff];
const INK = [0x19, 0x11, 0x0a, 0xff];
const BORDER = [0x00, 0x00, 0x00, 0x14];

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function drawK(buf, x0, y0, w, h) {
  const stemW = Math.round(w * 0.18);
  const armH = Math.round(h * 0.12);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x0 + x;
      const gy = y0 + y;
      const stem = x < stemW;
      const upperArm =
        y >= Math.round(h * 0.42) &&
        y < Math.round(h * 0.42) + armH &&
        x >= stemW &&
        x < w &&
        x >= w - (w - stemW) * ((y - Math.round(h * 0.42)) / (h * 0.35));
      const lowerArm =
        y >= Math.round(h * 0.52) &&
        y < Math.round(h * 0.52) + armH &&
        x >= stemW &&
        x < w &&
        x <= stemW + (w - stemW) * ((y - Math.round(h * 0.52)) / (h * 0.35));
      if (stem || upperArm || lowerArm) {
        const i = (gy * SIZE + gx) * 4;
        buf[i] = INK[0];
        buf[i + 1] = INK[1];
        buf[i + 2] = INK[2];
        buf[i + 3] = INK[3];
      }
    }
  }
}

function renderRgba() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const edge = x <= 1 || y <= 1 || x >= SIZE - 2 || y >= SIZE - 2;
      const color = edge ? BORDER : CREAM;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 0xff;
    }
  }
  drawK(buf, 34, 24, 60, 80);
  return buf;
}

function encodePng(rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + SIZE * 4;
  const raw = Buffer.alloc(rowSize * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
const png = encodePng(renderRgba());
writeFileSync(outFile, png);
console.log(
  `Wrote ${outFile} (${png.length} bytes, sha256=${createHash('sha256').update(png).digest('hex').slice(0, 12)}…)`
);
