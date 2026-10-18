// Eklenti ikonlarını (16/32/48/128 PNG) web/public/kesit.svg ile aynı geometriden üretir.
// Bağımlılık yok: küçük bir rasterleştirici + elle PNG kodlayıcı.
//   node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'extension', 'icons');

const INK = [0x15, 0x14, 0x12];
const PAPER = [0xec, 0xe8, 0xdc];
const LIME = [0xd4, 0xff, 0x2a];

// 128 birimlik tuval üzerinde şekiller (sonraki öncekinin üstüne çizilir)
const roundRect = (x, y, w, h, r) => (px, py) => {
    const cx = Math.min(Math.max(px, x + r), x + w - r);
    const cy = Math.min(Math.max(py, y + r), y + h - r);
    return px >= x && px <= x + w && py >= y && py <= y + h && (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
};
const convex = (pts) => (px, py) => {
    for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((bx - ax) * (py - ay) - (by - ay) * (px - ax) < 0) return false;
    }
    return true;
};

const shapes = [
    [roundRect(0, 0, 128, 128, 28), INK],
    [roundRect(26, 28, 76, 12, 6), PAPER],
    [convex([[20, 60], [110, 53], [108, 83], [16, 90]]), LIME],
    [roundRect(26, 102, 52, 12, 6), PAPER],
];

function render(size) {
    const SS = 6;
    const scale = 128 / size;
    const px = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const ux = (x + (sx + 0.5) / SS) * scale;
                    const uy = (y + (sy + 0.5) / SS) * scale;
                    let color = null;
                    for (const [hit, c] of shapes) if (hit(ux, uy)) color = c;
                    if (color) {
                        r += color[0];
                        g += color[1];
                        b += color[2];
                        a += 1;
                    }
                }
            }
            const i = (y * size + x) * 4;
            if (a) {
                px[i] = Math.round(r / a);
                px[i + 1] = Math.round(g / a);
                px[i + 2] = Math.round(b / a);
                px[i + 3] = Math.round((a / (SS * SS)) * 255);
            }
        }
    }
    return px;
}

const CRC = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
});
const crc32 = (buf) => {
    let c = -1;
    for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
};

function png(size, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit derinliği
    ihdr[9] = 6; // RGBA
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
    writeFileSync(join(outDir, `icon-${size}.png`), png(size, render(size)));
    console.log(`icons/icon-${size}.png`);
}

// Mağaza logosu (Edge Add-ons: 300×300).
const storeDir = join(root, 'store');
mkdirSync(storeDir, { recursive: true });
writeFileSync(join(storeDir, 'logo-300.png'), png(300, render(300)));
console.log('store/logo-300.png');
