// PWA 아이콘을 manifest 선언 크기(192/512 정사각)로 리사이즈하는 유틸.
// 사용: node scripts/resize-pwa-icons.mjs  (저장소 루트에서 실행)
// 의존성 없이 동작: 8비트 RGB(non-interlaced) PNG만 지원.
import fs from "node:fs";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function decode(buffer) {
  const w = buffer.readUInt32BE(16);
  const h = buffer.readUInt32BE(20);
  if (buffer[24] !== 8 || buffer[25] !== 2 || buffer[28] !== 0) {
    throw new Error("unsupported png (need 8-bit RGB non-interlaced)");
  }
  let off = 8;
  const idat = [];
  while (off < buffer.length) {
    const len = buffer.readUInt32BE(off);
    const type = buffer.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(buffer.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 3;
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bpp && prev ? prev[x - bpp] : 0;
      let v = line[x];
      switch (f) {
        case 0:
          break;
        case 1:
          v = (v + a) & 0xff;
          break;
        case 2:
          v = (v + b) & 0xff;
          break;
        case 3:
          v = (v + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 0xff;
          break;
        }
        default:
          throw new Error("bad filter " + f);
      }
      out[x] = v;
    }
  }
  return { w, h, px };
}

// 영역 평균(box) 다운샘플 — 640 → 192/512 축소에 적합.
function resize(src, dw, dh) {
  const { w, h, px } = src;
  const out = Buffer.alloc(dw * dh * 3);
  const sx = w / dw;
  const sy = h / dh;
  for (let dy = 0; dy < dh; dy++) {
    const y0 = dy * sy;
    const y1 = y0 + sy;
    for (let dx = 0; dx < dw; dx++) {
      const x0 = dx * sx;
      const x1 = x0 + sx;
      let r = 0;
      let g = 0;
      let b = 0;
      let area = 0;
      for (let y = Math.floor(y0); y < y1; y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < x1; x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0);
          const wgt = wx * wy;
          const i = (y * w + x) * 3;
          r += px[i] * wgt;
          g += px[i + 1] * wgt;
          b += px[i + 2] * wgt;
          area += wgt;
        }
      }
      const o = (dy * dw + dx) * 3;
      out[o] = Math.round(r / area);
      out[o + 1] = Math.round(g / area);
      out[o + 2] = Math.round(b / area);
    }
  }
  return { w: dw, h: dh, px: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encode({ w, h, px }) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = `public/icon-${size}.png`;
  const img = decode(fs.readFileSync(file));
  if (img.w === size && img.h === size) {
    console.log(`skip ${file} (already ${size}x${size})`);
    continue;
  }
  fs.writeFileSync(file, encode(resize(img, size, size)));
  console.log(`resized ${file} ${img.w}x${img.h} -> ${size}x${size}`);
}
