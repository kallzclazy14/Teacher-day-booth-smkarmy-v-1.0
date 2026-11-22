'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useCamera({ active, facing }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError('');

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Kamera tidak tersedia. Pakai browser terbaru dan buka lewat HTTPS atau localhost.');
        }
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(
          e.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu muat ulang halaman.'
            : e.name === 'NotFoundError'
            ? 'Kamera tidak ditemukan di perangkat ini.'
            : e.message
        );
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, facing, stop]);

  // Ambil satu frame sebagai JPEG dataURL; mirror=true agar hasil sama dengan preview
  const capture = useCallback((mirror) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  }, []);

  return { videoRef, status, error, capture };
}
