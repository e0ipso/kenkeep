#!/usr/bin/env node
// Generates the shipped notification icon PNG from docs/assets/favicon.svg.
// Prefers rsvg-convert when available; otherwise falls back to a pure-Node
// renderer using the favicon palette (no image runtime dependency).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const svgSource = join(root, 'docs/assets/favicon.svg');
const outDir = join(root, 'src/templates-source/kenkeep/assets');
const outFile = join(outDir, 'notification-icon.png');

const SIZE = 128;
const CREAM = [0xf7, 0xf3, 0xec, 0xff];
const INK = [0x19, 0x11, 0x0a, 0xff];
const BORDER = [0x00, 0x00, 0x00, 0x14];

function tryRsvgConvert() {
  if (!existsSync(svgSource)) return false;
  try {
    execFileSync(
      'rsvg-convert',
      ['-w', String(SIZE), '-h', String(SIZE), '-o', outFile, svgSource],
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

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

function insideRoundedRect(x, y, radius) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  const corners = [
    [radius, radius],
    [SIZE - radius - 1, radius],
    [radius, SIZE - radius - 1],
    [SIZE - radius - 1, SIZE - radius - 1],
  ];
  for (const [cx, cy] of corners) {
    const dx = x < cx ? cx - x : x > cx ? x - cx : 0;
    const dy = y < cy ? cy - y : y > cy ? y - cy : 0;
    if (dx * dx + dy * dy > radius * radius) return false;
  }
  return true;
}

function setPixel(buf, x, y, color) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}

function drawLowercaseK(buf) {
  const stemX0 = 42;
  const stemX1 = 54;
  const midY = 64;
  for (let y = 30; y < 98; y++) {
    for (let x = stemX0; x < stemX1; x++) setPixel(buf, x, y, INK);
  }
  for (let y = 30; y < midY; y++) {
    const t = (midY - y) / (midY - 30);
    const x1 = stemX1 + Math.round(34 * t);
    for (let x = stemX1; x <= x1; x++) setPixel(buf, x, y, INK);
  }
  for (let y = midY; y < 98; y++) {
    const t = (y - midY) / (98 - midY);
    const x1 = stemX1 + Math.round(34 * t);
    for (let x = stemX1; x <= x1; x++) setPixel(buf, x, y, INK);
  }
}

function renderFallbackRgba() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const radius = 28;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (!insideRoundedRect(x, y, radius)) {
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
        continue;
      }
      const edge =
        !insideRoundedRect(x - 1, y, radius) ||
        !insideRoundedRect(x + 1, y, radius) ||
        !insideRoundedRect(x, y - 1, radius) ||
        !insideRoundedRect(x, y + 1, radius);
      const color = edge ? BORDER : CREAM;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 0xff;
    }
  }
  drawLowercaseK(buf);
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

const mode = tryRsvgConvert() ? 'rsvg-convert' : 'fallback';
if (mode === 'fallback') {
  writeFileSync(outFile, encodePng(renderFallbackRgba()));
}

const png = readFileSync(outFile);
console.log(
  `Wrote ${outFile} via ${mode} (${png.length} bytes, sha256=${createHash('sha256').update(png).digest('hex').slice(0, 12)}…)`
);
