export interface TourRect { left: number; top: number; width: number; height: number }
export function fitDialogWidth(view: { width: number; height: number }, height: number, target?: TourRect, preferred = 'bottom'): number {
  const width = view.width <= 768 ? view.width - 24 : Math.min(420, view.width - 24);
  if (!target || view.width <= 768) return width;
  const p = placeDialog(view, { width, height }, target, preferred);
  const overlaps = p.left < target.left + target.width && p.left + width > target.left &&
    p.top < target.top + target.height && p.top + height > target.top;
  const sideSpace = Math.floor(Math.max(target.left - 30, view.width - target.left - target.width - 30));
  return overlaps && sideSpace >= 300 ? Math.min(width, sideSpace) : width;
}
export function placeDialog(view: { width: number; height: number }, size: { width: number; height: number },
  target?: TourRect, preferred = 'bottom'): { left: number; top: number } {
  const margin = 12, gap = 18;
  const clamp = (value: number, max: number) => Math.max(margin, Math.min(value, max - margin));
  if (view.width <= 768) return { left: margin, top: Math.max(margin, view.height - size.height - margin) };
  const center = { left: (view.width - size.width) / 2, top: (view.height - size.height) / 2 };
  if (!target) return { left: clamp(center.left, view.width - size.width), top: clamp(center.top, view.height - size.height) };
  const positions: Record<string, { left: number; top: number }> = {
    bottom: { left: target.left + (target.width - size.width) / 2, top: target.top + target.height + gap },
    top: { left: target.left + (target.width - size.width) / 2, top: target.top - size.height - gap },
    right: { left: target.left + target.width + gap, top: target.top + (target.height - size.height) / 2 },
    left: { left: target.left - size.width - gap, top: target.top + (target.height - size.height) / 2 },
  };
  const candidates = [...new Set([preferred, 'bottom', 'top', 'right', 'left'])].map(key => {
    const p = positions[key];
    return { left: clamp(p.left, view.width - size.width), top: clamp(p.top, view.height - size.height) };
  });
  const overlap = (p: { left: number; top: number }) =>
    Math.max(0, Math.min(p.left + size.width, target.left + target.width) - Math.max(p.left, target.left)) *
    Math.max(0, Math.min(p.top + size.height, target.top + target.height) - Math.max(p.top, target.top));
  return candidates.reduce((best, p) => overlap(p) < overlap(best) ? p : best);
}
