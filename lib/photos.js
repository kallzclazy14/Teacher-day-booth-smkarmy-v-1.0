export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Baca file gambar, kecilkan sisi terpanjang ke max px, kembalikan JPEG dataURL.
// Semuanya di browser; file tidak pernah dikirim ke mana pun.
export function fileToPhoto(file, max = 1600) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`${file.name} bukan file gambar`));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} tidak bisa dibaca`));
    };
    img.src = url;
  });
}
