export const SHOT_OPTIONS = [
  { id: 3, label: '3 Shots' },
  { id: 4, label: '4 Shots' },
];

export const FRAMES = [
  { id: 'classic', label: 'Classic Bar' },
  { id: 'doodle', label: 'Doodle & QR' },
  { id: 'polka', label: 'Polka Script' },
  { id: 'film', label: 'Film Reel' },
];

export const PAPERS = [
  { id: 'white', label: 'Paper White', color: '#FFFFFF', ink: '#000000' },
  { id: 'cream', label: 'Warm Cream', color: '#F3EAD3', ink: '#000000' },
  { id: 'chalk', label: 'Chalk Ink', color: '#1C1C1C', ink: '#F5F5F5' },
];

// css = nilai CSS filter; dipakai lagi di Langkah 3 untuk canvas
export const FILTERS = [
  { id: 'natural', label: 'Natural', css: 'none' },
  { id: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.2) hue-rotate(-10deg)' },
  { id: 'flash', label: 'Flash', css: 'brightness(1.2) contrast(1.15)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(1)' },
];

export const BACKDROPS = [
  { id: 'original', label: 'Original', css: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 10px 10px' },
  { id: 'yearbook', label: 'Yearbook Blue', css: '#2F5FA8' },
  { id: 'polkadot', label: 'Polkadot', css: 'radial-gradient(#000 20%, transparent 22%) 0 0 / 8px 8px, #fff' },
  { id: 'satin', label: 'Satin Pink', css: 'linear-gradient(135deg, #F9C6D4, #F4A5BB)' },
];

export const DEFAULT_ADJUST = { zoom: 1, x: 0, y: 0 };
