import { renderStrip, stripSize } from '@/lib/renderStrip';

const EXPORT_SCALE = 3; // 500 x 3 = 1500px lebar
const VIDEO_W = 1080, VIDEO_H = 1920, VIDEO_MS = 5000;

const fileName = (ext) => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `photo-booth-arrahman-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
};

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

const fontsReady = () => (document.fonts?.ready ?? Promise.resolve());

// state = { images, adjust, cfg }
export async function renderPngBlob(state) {
  await fontsReady();
  const c = document.createElement('canvas');
  renderStrip(c, { ...state, scale: EXPORT_SCALE });
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat PNG. Coba kurangi jumlah foto atau muat ulang.'))), 'image/png')
  );
}

export async function exportPng(state) {
  downloadBlob(await renderPngBlob(state), fileName('png'));
}

// Frame ke-k: strip dengan k foto pertama sudah muncul
function stripWithShots(state, k, scale) {
  const c = document.createElement('canvas');
  renderStrip(c, { ...state, images: state.images.map((im, i) => (i < k ? im : null)), scale });
  return c;
}

export async function exportGif(state, onProgress) {
  await fontsReady();
  const mod = await import('gifshot');
  const gifshot = mod.default || mod;
  const { shots } = state.cfg;
  const { w, h } = stripSize(shots, 1);
  const frames = [];
  for (let k = 1; k <= shots; k++) frames.push(stripWithShots(state, k, 1).toDataURL('image/jpeg', 0.95));
  for (let i = 0; i < 3; i++) frames.push(frames[frames.length - 1]); // tahan frame akhir

  const image = await new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        images: frames,
        gifWidth: w,
        gifHeight: h,
        interval: 0.7,
        numWorkers: 2,
        sampleInterval: 10,
        progressCallback: (p) => onProgress?.(p),
      },
      (r) => (r.error ? reject(new Error(r.errorMsg || 'Gagal membuat GIF')) : resolve(r.image))
    );
  });
  downloadBlob(await (await fetch(image)).blob(), fileName('gif'));
}

export async function exportVideo(state, onProgress) {
  if (typeof MediaRecorder === 'undefined') throw new Error('Browser ini belum mendukung perekaman video.');
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
  if (!type) throw new Error('Format video tidak didukung browser ini.');
  await fontsReady();

  const { shots } = state.cfg;
  // Pra-render strip untuk tiap tahap (0..shots foto muncul) supaya animasi ringan
  const scale = (VIDEO_H * 0.9) / stripSize(shots, 1).h;
  const steps = Array.from({ length: shots + 1 }, (_, k) => stripWithShots(state, k, scale));
  const sw = steps[0].width, sh = steps[0].height;
  const sx = Math.round((VIDEO_W - sw) / 2), sy = Math.round((VIDEO_H - sh) / 2);

  const out = document.createElement('canvas');
  out.width = VIDEO_W;
  out.height = VIDEO_H;
  const ctx = out.getContext('2d');
  const stream = out.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));

  const draw = (t) => {
    const k = Math.min(shots, Math.max(0, Math.floor((t - 500) / 850) + 1));
    const sinceReveal = k > 0 ? t - (500 + (k - 1) * 850) : 9999;
    ctx.fillStyle = '#EFE6D0';
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
    ctx.globalAlpha = Math.min(1, t / 400);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 12, sy + 12, sw, sh); // bayangan keras ala retro
    ctx.drawImage(steps[k], sx, sy);
    ctx.globalAlpha = 1;
    const f = Math.max(0, 1 - sinceReveal / 250); // kilatan saat foto baru muncul
    if (f > 0) {
      ctx.fillStyle = `rgba(255,255,255,${f * 0.55})`;
      ctx.fillRect(sx, sy, sw, sh);
    }
  };

  const t0 = performance.now();
  rec.start();
  await new Promise((resolve) => {
    const tick = () => {
      const t = performance.now() - t0;
      draw(Math.min(t, VIDEO_MS));
      onProgress?.(Math.min(1, t / VIDEO_MS));
      t >= VIDEO_MS ? resolve() : requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  downloadBlob(new Blob(chunks, { type }), fileName(type.includes('mp4') ? 'mp4' : 'webm'));
}
