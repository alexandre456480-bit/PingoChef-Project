import { cropGeometry } from './image-crop.geometry';

describe('image crop geometry', () => {
  it('covers a square without stretching and reaches either edge', () => {
    const center = cropGeometry(800, 400, 300, 300, 1, 0, 0, 'cover');
    expect(center).toMatchObject({ width: 600, height: 300, left: -150, top: 0 });
    expect(cropGeometry(800, 400, 300, 300, 1, 1, 0, 'cover').left).toBe(0);
    expect(cropGeometry(800, 400, 300, 300, 1, -1, 0, 'cover').left).toBe(-300);
  });
  it('keeps the complete transparent logo when fitting inside the frame', () => {
    expect(cropGeometry(800, 400, 300, 300, 1, 0, 0, 'contain')).toMatchObject({ width: 300, height: 150, left: 0, top: 75 });
  });
  it('clamps panning, preserves aspect ratio and fills wide/portrait frames with zoom', () => {
    for (const [fw, fh] of [[400, 160], [180, 320]]) {
      const result = cropGeometry(600, 900, fw, fh, 2.5, 999, -999, 'cover');
      expect(result.width / result.height).toBeCloseTo(600 / 900);
      expect(result.left).toBeLessThanOrEqual(0);
      expect(result.top).toBeLessThanOrEqual(0);
      expect(result.left + result.width).toBeGreaterThanOrEqual(fw);
      expect(result.top + result.height).toBeGreaterThanOrEqual(fh);
    }
  });
});
