export type CropFit = 'cover' | 'contain';

export function cropGeometry(iw: number, ih: number, fw: number, fh: number, zoom: number, x: number, y: number, fit: CropFit) {
  const scale = (fit === 'cover' ? Math.max(fw / iw, fh / ih) : Math.min(fw / iw, fh / ih)) * zoom;
  const width = iw * scale, height = ih * scale;
  const travelX = Math.max(0, (width - fw) / 2), travelY = Math.max(0, (height - fh) / 2);
  return { width, height, travelX, travelY, left: (fw - width) / 2 + Math.max(-1, Math.min(1, x)) * travelX, top: (fh - height) / 2 + Math.max(-1, Math.min(1, y)) * travelY };
}
