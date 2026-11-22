'use client';

import { useEffect, useRef, useState } from 'react';
import { SHOT_OPTIONS, FRAMES, PAPERS, FILTERS, BACKDROPS, DEFAULT_ADJUST } from '@/lib/config';
import { useCamera } from '@/lib/useCamera';
import { fileToPhoto, sleep } from '@/lib/photos';
import { renderStrip, loadImage, slotAt } from '@/lib/renderStrip';
import { renderPngBlob, downloadBlob, exportGif, exportVideo } from '@/lib/exporters';

/* ---------- komponen kecil ---------- */

const Section = ({ n, title, children }) => (
  <section className="border-t-2 border-ink pt-3 first:border-0 first:pt-0">
    <h3 className="mb-2 font-display text-lg">
      {n}. {title}
    </h3>
    {children}
  </section>
);

const Choice = ({ active, onClick, label, children }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex flex-col items-center gap-1 border-2 border-ink p-1.5 text-xs font-semibold ${
      active ? 'bg-ink text-paper' : 'bg-paper shadow-hard-sm'
    }`}
  >
    {children}
    <span>{label}</span>
  </button>
);

const Swatch = ({ css }) => (
  <span className="border-2 border-ink bg-paper p-0.5">
    <i className="block h-8 w-8" style={{ background: css }} />
  </span>
);

function MiniStrip({ shots, frame }) {
  const foot = {
    classic: <i className="h-1.5 bg-current" />,
    doodle: <i className="h-2.5 w-2.5 self-end border border-current" />,
    polka: <i className="h-1.5 border-t-2 border-dotted border-current" />,
    film: <i className="h-1" />,
  }[frame];
  return (
    <span
      className={`flex h-16 w-9 flex-col gap-0.5 border-2 p-0.5 ${
        frame === 'film' ? 'border-dashed border-current' : 'border-current'
      }`}
    >
      {Array.from({ length: shots }).map((_, i) => (
        <i key={i} className="flex-1 border border-current" />
      ))}
      {foot}
    </span>
  );
}

const Slider = ({ label, value, min, max, step, onChange }) => (
  <label className="block">
    <span className="label">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full accent-black"
    />
  </label>
);

/* ---------- halaman ---------- */

export default function Home() {
  const [mode, setMode] = useState('camera'); // 'camera' | 'upload'
  const [timer, setTimer] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [facing, setFacing] = useState('user'); // 'user' | 'environment'
  const [photos, setPhotos] = useState([null, null, null, null]); // dataURL
  const [adjust, setAdjust] = useState(() => Array.from({ length: 4 }, () => ({ ...DEFAULT_ADJUST })));
  const [selected, setSelected] = useState(null);
  const [cfg, setCfg] = useState({ shots: 4, frame: 'classic', paper: 'white', filter: 'natural', backdrop: 'original' });

  const canvasRef = useRef(null);

  // ----- Langkah 2: kamera & upload -----
  const { videoRef, status, error, capture } = useCamera({ active: mode === 'camera', facing });
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (mode !== 'camera') cancelRef.current = true;
  }, [mode]);
  useEffect(() => () => { cancelRef.current = true; }, []);

  const resetAdjust = () => setAdjust(Array.from({ length: 4 }, () => ({ ...DEFAULT_ADJUST })));

  // Timer on: hitung mundur 3 detik sebelum tiap foto. Timer off: jeda 1 detik antar foto.
  const snapStrip = async () => {
    if (busy) return;
    cancelRef.current = false;
    setBusy(true);
    setSelected(null);
    setNotice('');
    setPhotos([null, null, null, null]);
    resetAdjust();
    for (let i = 0; i < cfg.shots; i++) {
      if (timer) {
        for (let s = 3; s > 0 && !cancelRef.current; s--) {
          setCountdown(s);
          await sleep(1000);
        }
        setCountdown(null);
      } else if (i > 0) {
        await sleep(1000);
      }
      if (cancelRef.current) break;
      const url = capture(mirror);
      if (!url) break;
      setPhotos((p) => p.map((x, j) => (j === i ? url : x)));
      setFlash(true);
      setTimeout(() => setFlash(false), 120);
    }
    setCountdown(null);
    setBusy(false);
  };

  // Isi slot kosong dulu; jika tidak cukup, timpa mulai dari slot 1
  const addFiles = async (fileList) => {
    const all = Array.from(fileList || []);
    if (!all.length) return;
    const files = all.slice(0, cfg.shots);
    setNotice(all.length > files.length ? `Hanya ${files.length} foto pertama yang dipakai.` : '');
    const results = await Promise.allSettled(files.map((f) => fileToPhoto(f)));
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) setNotice(failed[0].reason.message + (failed.length > 1 ? ` (+${failed.length - 1} file lain)` : ''));
    if (!ok.length) return;
    const slots = [...Array(cfg.shots).keys()];
    const empty = slots.filter((i) => !photos[i]);
    const targets = (empty.length >= ok.length ? empty : slots).slice(0, ok.length);
    setPhotos((p) => p.map((x, i) => (targets.includes(i) ? ok[targets.indexOf(i)] : x)));
    setAdjust((a) => a.map((x, i) => (targets.includes(i) ? { ...DEFAULT_ADJUST } : x)));
  };

  const clearAll = () => {
    setPhotos([null, null, null, null]);
    resetAdjust();
    setSelected(null);
    setNotice('');
  };
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const upd = (k, v) => setAdjust((a) => a.map((x, i) => (i === selected ? { ...x, [k]: +v } : x)));

  // ----- Langkah 3: render canvas (foto + filter + backdrop + frame + kertas) -----
  const [imgs, setImgs] = useState([null, null, null, null]);
  useEffect(() => {
    let off = false;
    Promise.all(photos.map((u) => loadImage(u))).then((r) => {
      if (!off) setImgs(r);
    });
    return () => { off = true; };
  }, [photos]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let off = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!off) renderStrip(c, { images: imgs, adjust, cfg });
    });
    return () => { off = true; };
  }, [imgs, adjust, cfg]);

  // ----- Langkah 4: ekspor -----
  const [job, setJob] = useState(null); // { kind, progress }
  const [exportError, setExportError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const hasPhotos = photos.some(Boolean);
  const exportState = () => ({ images: imgs, adjust, cfg });

  const run = async (kind, fn) => {
    if (job) return;
    setExportError('');
    setJob({ kind, progress: 0 });
    try {
      await fn((p) => setJob({ kind, progress: p }));
    } catch (e) {
      setExportError(e.message || 'Ekspor gagal. Coba lagi.');
    } finally {
      setJob(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };
  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e) => e.key === 'Escape' && closePreview();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewUrl]);

  const a = selected !== null ? adjust[selected] : null;

  return (
    <main className="mx-auto max-w-[1280px] p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="inline-block -rotate-1 font-display">
          <span className="block text-5xl sm:text-6xl">Photo Booth</span>
          <span className="block text-xl sm:text-2xl">teacher day SMK ARRAHMAN</span>
        </h1>
        <svg viewBox="0 0 220 12" className="-mt-1 h-3 w-56" aria-hidden="true">
          <path d="M2 7 Q 14 1 26 7 T 50 7 T 74 7 T 98 7 T 122 7 T 146 7 T 170 7 T 194 7 T 218 7" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="mt-2 max-w-md text-sm">Photobooth di browser. Fotomu diproses di perangkatmu dan tidak pernah diunggah.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)_350px]">
        {/* ===== Kolom kiri: kamera & upload ===== */}
        <div className="panel space-y-4">
          <div className="grid grid-cols-2">
            {['camera', 'upload'].map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`btn ${m === 'camera' ? '' : '-ml-[2px]'} ${mode === m ? 'btn-on' : ''}`}>
                {m === 'camera' ? 'Camera' : 'Upload'}
              </button>
            ))}
          </div>

          {mode === 'camera' ? (
            <>
              <div className="relative aspect-[4/3] overflow-hidden border-[3px] border-ink bg-ink text-paper">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
                />
                {status !== 'ready' && (
                  <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm">
                    {status === 'error' ? error : 'Menyalakan kamera…'}
                  </div>
                )}
                {countdown !== null && (
                  <div className="absolute inset-0 grid place-items-center bg-ink/40 font-display text-8xl">{countdown}</div>
                )}
                <div
                  className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${flash ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className={`btn ${timer ? 'btn-on' : ''}`} onClick={() => setTimer(!timer)} aria-pressed={timer}>
                  Timer 3s
                </button>
                <button className="btn" disabled={busy} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
                  Flip Cam
                </button>
                <button className={`btn ${mirror ? 'btn-on' : ''}`} onClick={() => setMirror(!mirror)} aria-pressed={mirror}>
                  Mirror {mirror ? 'On' : 'Off'}
                </button>
              </div>
              <button
                className="btn btn-on w-full py-3 text-base"
                disabled={!busy && status !== 'ready'}
                onClick={busy ? () => { cancelRef.current = true; } : snapStrip}
              >
                {busy ? 'Batal' : `Snap ${cfg.shots}-Shot Strip`}
              </button>
            </>
          ) : (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              className={`grid aspect-[4/3] cursor-pointer place-items-center border-[3px] border-dashed border-ink p-4 text-center text-sm focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 ${
                dragging ? 'bg-cream' : ''
              }`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  e.target.value = '';
                  addFiles(files);
                }}
              />
              <span>
                Seret 1–{cfg.shots} foto ke sini
                <br />
                atau ketuk untuk pilih dari galeri
              </span>
            </label>
          )}

          {/* Thumbnail slots */}
          <div>
            <p className="label mb-2">Photo slots</p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => {
                const off = i >= cfg.shots;
                return (
                  <button
                    key={i}
                    disabled={off}
                    onClick={() => setSelected(selected === i ? null : i)}
                    aria-label={`Slot foto ${i + 1}`}
                    className={`relative grid aspect-square place-items-center overflow-hidden border-2 border-ink bg-cream font-display text-xl disabled:opacity-30 ${
                      selected === i ? 'outline outline-[3px] outline-offset-2 outline-ink' : ''
                    }`}
                  >
                    {p ? (
                      <img
                        src={p}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      i + 1
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {notice && (
            <p role="status" className="border-2 border-ink bg-cream p-2 text-xs">
              {notice}
            </p>
          )}
          <button className="btn w-full" disabled={busy || !photos.some(Boolean)} onClick={clearAll}>
            Hapus semua foto
          </button>

          {/* Kontrol edit posisi foto */}
          {a && (
            <div className="space-y-2 border-2 border-ink bg-cream p-3">
              <p className="font-display">Atur foto slot {selected + 1}</p>
              {photos[selected] ? null : <p className="text-xs">Slot ini masih kosong. Ambil atau unggah foto dulu.</p>}
              <Slider label="Zoom" value={a.zoom} min={1} max={3} step={0.05} onChange={(v) => upd('zoom', v)} />
              <Slider label="Geser Kiri/Kanan" value={a.x} min={-100} max={100} step={1} onChange={(v) => upd('x', v)} />
              <Slider label="Geser Atas/Bawah" value={a.y} min={-100} max={100} step={1} onChange={(v) => upd('y', v)} />
              <button className="btn w-full" onClick={() => setAdjust((x) => x.map((o, i) => (i === selected ? { ...DEFAULT_ADJUST } : o)))}>
                Reset posisi
              </button>
            </div>
          )}
        </div>

        {/* ===== Kolom tengah: live preview ===== */}
        <div className="panel flex flex-col items-center">
          <p className="label mb-3 text-center">Live print preview - Click a photo slot to edit</p>
          <div className="border-2 border-ink bg-cream p-3">
            <canvas
              ref={canvasRef}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const i = slotAt(cfg.shots, (e.clientY - r.top) / r.height);
                if (i >= 0) setSelected(i);
              }}
              className="mx-auto block h-auto max-h-[78vh] w-auto max-w-full cursor-pointer shadow-hard-sm"
            />
          </div>
        </div>

        {/* ===== Kolom kanan: settings ===== */}
        <div className="panel space-y-4">
          <Section n={1} title="Strip Template">
            <div className="mb-3 grid grid-cols-2 gap-2">
              {SHOT_OPTIONS.map((o) => (
                <button key={o.id} className={`btn ${cfg.shots === o.id ? 'btn-on' : ''}`} aria-pressed={cfg.shots === o.id} onClick={() => set('shots', o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {FRAMES.map((f) => (
                <Choice key={f.id} label={f.label} active={cfg.frame === f.id} onClick={() => set('frame', f.id)}>
                  <MiniStrip shots={cfg.shots} frame={f.id} />
                </Choice>
              ))}
            </div>
          </Section>

          <Section n={2} title="Paper Tone">
            <div className="grid grid-cols-3 gap-2">
              {PAPERS.map((p) => (
                <Choice key={p.id} label={p.label} active={cfg.paper === p.id} onClick={() => set('paper', p.id)}>
                  <Swatch css={p.color} />
                </Choice>
              ))}
            </div>
          </Section>

          <Section n={3} title="Film Filter">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button key={f.id} className={`btn ${cfg.filter === f.id ? 'btn-on' : ''}`} aria-pressed={cfg.filter === f.id} onClick={() => set('filter', f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </Section>

          <Section n={4} title="Studio Backdrop">
            <div className="grid grid-cols-4 gap-2">
              {BACKDROPS.map((b) => (
                <Choice key={b.id} label={b.label} active={cfg.backdrop === b.id} onClick={() => set('backdrop', b.id)}>
                  <Swatch css={b.css} />
                </Choice>
              ))}
            </div>
          </Section>

          <Section n={5} title="Aksi">
            <div className="grid gap-2">
              <button
                className="btn btn-on"
                disabled={!hasPhotos || !!job}
                onClick={() => run('png', async () => downloadBlob(await renderPngBlob(exportState()), `photo-booth-${Date.now()}.png`))}
              >
                Download Strip (PNG)
              </button>
              <button className="btn" disabled={!hasPhotos || !!job} onClick={() => run('gif', (p) => exportGif(exportState(), p))}>
                Download GIF (Frame)
              </button>
              <button className="btn" disabled={!hasPhotos || !!job} onClick={() => run('video', (p) => exportVideo(exportState(), p))}>
                Download Video 5s
              </button>
              <button
                className="btn"
                disabled={!hasPhotos || !!job}
                onClick={() => run('preview', async () => setPreviewUrl(URL.createObjectURL(await renderPngBlob(exportState()))))}
              >
                Open Full-Size Preview
              </button>
            </div>
            {!hasPhotos && <p className="label mt-2">Ambil atau unggah foto dulu untuk membuka tombol download.</p>}
            {job && (
              <div role="status" className="mt-3">
                <p className="label mb-1">
                  Membuat {{ png: 'PNG', gif: 'GIF', video: 'video', preview: 'preview' }[job.kind]}…{' '}
                  {job.progress > 0 && `${Math.round(job.progress * 100)}%`}
                  {job.kind === 'video' && ' (tetap di tab ini)'}
                </p>
                <div className="h-3 border-2 border-ink bg-paper">
                  <i
                    className={`block h-full bg-ink ${job.progress === 0 ? 'w-1/3 animate-pulse' : ''}`}
                    style={job.progress > 0 ? { width: `${job.progress * 100}%` } : undefined}
                  />
                </div>
              </div>
            )}
            {exportError && (
              <p role="alert" className="mt-3 border-2 border-ink bg-cream p-2 text-xs">
                {exportError}
              </p>
            )}
          </Section>
        </div>
      </div>
    {previewUrl && (
        <div role="dialog" aria-modal="true" aria-label="Preview ukuran penuh" className="fixed inset-0 z-50 overflow-auto bg-ink/80 p-4" onClick={closePreview}>
          <div className="mx-auto w-fit max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex gap-2">
              <button className="btn btn-on" onClick={closePreview}>Tutup</button>
              <a className="btn inline-block" href={previewUrl} download={`photo-booth-${Date.now()}.png`}>Download PNG</a>
            </div>
            <img src={previewUrl} alt="Hasil strip foto ukuran penuh" className="block h-auto max-w-full border-[3px] border-ink bg-paper" />
          </div>
        </div>
      )}
    </main>
  );
}
