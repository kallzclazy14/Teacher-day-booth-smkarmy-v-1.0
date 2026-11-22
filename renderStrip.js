import { PAPERS } from '@/lib/config';

// Semua ukuran dalam "unit" dengan lebar strip 500; scale mengalikan semuanya.
// Preview: scale 1 (500px). Ekspor: scale 3 => 1500px.
const W0 = 500, MARGIN = 28, GAP = 18, SLOT_H = 290, FOOTER = 150;
const TITLE = 'Photo Booth';
const SUB = 'teacher day SMK ARRAHMAN';

export const loadImage = (url) =>
  url
    ? new Promise((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = url;
      })
    : Promise.resolve(null);

export function stripSize(shots, scale = 1) {
  const h = MARGIN + shots * SLOT_H + (shots - 1) * GAP + FOOTER;
  return { w: Math.round(W0 * scale), h: Math.round(h * scale) };
}

// Klik pada preview (f = posisi vertikal 0..1) -> index slot, atau -1
export function slotAt(shots, f) {
  const y = f * stripSize(shots).h - MARGIN;
  const i = Math.floor(y / (SLOT_H + GAP));
  return i >= 0 && i < shots && y - i * (SLOT_H + GAP) <= SLOT_H ? i : -1;
}

const family = (canvas, name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
};

const text = (ctx, str, x, y, size, font, color, align = 'center') => {
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
};

// Filter lewat piksel (bukan ctx.filter) supaya sama di semua browser, termasuk Safari
function applyFilter(ctx, id, w, h) {
  if (id === 'natural') return;
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (id === 'bw') {
      d[i] = d[i + 1] = d[i + 2] = (0.299 * r + 0.587 * g + 0.114 * b - 128) * 1.1 + 128;
    } else if (id === 'sepia') {
      d[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      d[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      d[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    } else if (id === 'warm') {
      d[i] = r * 1.06 + 10;
      d[i + 1] = g * 1.02 + 3;
      d[i + 2] = b * 0.88;
    } else if (id === 'flash') {
      d[i] = (r * 1.18 - 128) * 1.12 + 128;
      d[i + 1] = (g * 1.18 - 128) * 1.12 + 128;
      d[i + 2] = (b * 1.18 - 128) * 1.12 + 128;
    }
  }
  ctx.putImageData(im, 0, 0);
}

// Cover-fit + zoom + geser (x,y -100..100), selalu menutupi seluruh kotak
function drawPhoto(ctx, img, adj, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * adj.zoom;
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  const ox = (adj.x / 100) * ((dw - w) / 2), oy = (adj.y / 100) * ((dh - h) / 2);
  ctx.drawImage(img, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh);
}

function drawBackdrop(ctx, id, x, y, w, h, s) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (id === 'polkadot') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#000';
    const step = 22 * s;
    for (let r = 0, yy = y + step / 2; yy < y + h; r++, yy += step) {
      for (let xx = x + (r % 2 ? 0 : step / 2); xx < x + w; xx += step) {
        ctx.beginPath();
        ctx.arc(xx, yy, 5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    const [a, b] = id === 'satin' ? ['#F9C6D4', '#F0A0B8'] : ['#3A6BC0', '#1F4584'];
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawSlot(ctx, o) {
  const { img, adj, backdrop, filter, x, y, w, h, s, ink, index, marker } = o;
  const mat = backdrop === 'original' ? 0 : 14 * s; // backdrop tampil sebagai matte di sekeliling foto
  if (mat) drawBackdrop(ctx, backdrop, x, y, w, h, s);
  const px = x + mat, py = y + mat;
  const pw = Math.round(w - mat * 2), ph = Math.round(h - mat * 2);
  if (img) {
    const off = document.createElement('canvas');
    off.width = pw;
    off.height = ph;
    const c2 = off.getContext('2d', { willReadFrequently: true });
    drawPhoto(c2, img, adj, pw, ph);
    applyFilter(c2, filter, pw, ph);
    ctx.drawImage(off, px, py);
  } else {
    ctx.fillStyle = 'rgba(128,128,128,0.18)';
    ctx.fillRect(px, py, pw, ph);
    ctx.globalAlpha = 0.5;
    text(ctx, String(index), x + w / 2, y + h / 2 + 16 * s, 48 * s, marker, ink);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3 * s;
  ctx.strokeRect(x, y, w, h);
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.stroke();
}

export function renderStrip(canvas, { images, adjust, cfg, scale = 1 }) {
  const { shots, frame, filter, backdrop } = cfg;
  const paper = PAPERS.find((p) => p.id === cfg.paper);
  const ink = paper.ink;
  const s = scale;
  const { w: W, h: H } = stripSize(shots, s);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const marker = family(canvas, '--font-marker', 'cursive');
  const mono = family(canvas, '--font-mono', 'monospace');
  const padX = (frame === 'film' ? 54 : MARGIN) * s;
  const slotW = W - padX * 2, slotH = SLOT_H * s, gap = GAP * s, top = MARGIN * s;
  const cx = W / 2;
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  ctx.lineJoin = 'round';
  ctx.fillStyle = paper.color;
  ctx.fillRect(0, 0, W, H);

  // dekorasi di belakang foto
  if (frame === 'polka') {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.18;
    for (let r = 0, y = 13 * s; y < H; r++, y += 26 * s) {
      for (let x = r % 2 ? 0 : 13 * s; x < W; x += 26 * s) {
        ctx.beginPath();
        ctx.arc(x, y, 4 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  if (frame === 'film') {
    const bw = 38 * s;
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, bw, H);
    ctx.fillRect(W - bw, 0, bw, H);
    ctx.fillStyle = paper.color;
    for (let y = 14 * s; y < H - 14 * s; y += 40 * s) {
      ctx.fillRect((bw - 14 * s) / 2, y, 14 * s, 20 * s);
      ctx.fillRect(W - bw + (bw - 14 * s) / 2, y, 14 * s, 20 * s);
    }
  }

  for (let i = 0; i < shots; i++) {
    drawSlot(ctx, {
      img: images[i], adj: adjust[i], backdrop, filter, index: i + 1, marker, ink, s,
      x: padX, y: top + i * (slotH + gap), w: slotW, h: slotH,
    });
  }

  // footer + bingkai
  const fTop = top + shots * slotH + (shots - 1) * gap + gap;
  const fH = H - fTop - top;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 3 * s;

  if (frame === 'classic') {
    ctx.lineWidth = 4 * s;
    ctx.strokeRect(2 * s, 2 * s, W - 4 * s, H - 4 * s);
    ctx.fillRect(padX, fTop, slotW, fH);
    text(ctx, TITLE, cx, fTop + 50 * s, 38 * s, marker, paper.color);
    text(ctx, SUB, cx, fTop + 74 * s, 14 * s, mono, paper.color);
    text(ctx, date, cx, fTop + 94 * s, 12 * s, mono, paper.color);
  } else if (frame === 'doodle') {
    ctx.setLineDash([10 * s, 7 * s]);
    ctx.strokeRect(10 * s, 10 * s, W - 20 * s, H - 20 * s);
    ctx.strokeRect(W - padX - 84 * s, fTop + 8 * s, 84 * s, 84 * s);
    ctx.setLineDash([]);
    star(ctx, W - padX - 42 * s, fTop + 38 * s, 20 * s);
    text(ctx, 'SMK ARRAHMAN', W - padX - 42 * s, fTop + 78 * s, 10 * s, mono, ink);
    text(ctx, TITLE, padX, fTop + 48 * s, 34 * s, marker, ink, 'left');
    text(ctx, SUB, padX, fTop + 72 * s, 13 * s, mono, ink, 'left');
    text(ctx, date, padX, fTop + 92 * s, 12 * s, mono, ink, 'left');
  } else if (frame === 'polka') {
    ctx.fillStyle = paper.color;
    ctx.fillRect(padX, fTop, slotW, fH);
    ctx.strokeRect(padX, fTop, slotW, fH);
    text(ctx, TITLE, cx, fTop + 48 * s, 38 * s, marker, ink);
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 70 * s, fTop + 60 * s);
    for (let k = 0; k < 7; k++) {
      ctx.quadraticCurveTo(cx - 70 * s + k * 20 * s + 10 * s, fTop + (k % 2 ? 66 : 54) * s, cx - 70 * s + (k + 1) * 20 * s, fTop + 60 * s);
    }
    ctx.stroke();
    text(ctx, SUB, cx, fTop + 82 * s, 13 * s, mono, ink);
    text(ctx, date, cx, fTop + 98 * s, 11 * s, mono, ink);
  } else {
    text(ctx, TITLE, cx, fTop + 46 * s, 36 * s, marker, ink);
    text(ctx, SUB, cx, fTop + 74 * s, 14 * s, mono, ink);
    text(ctx, date, cx, fTop + 94 * s, 12 * s, mono, ink);
  }
}
