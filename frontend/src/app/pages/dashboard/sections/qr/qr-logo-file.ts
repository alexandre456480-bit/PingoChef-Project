import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';

export const QR_LOGO_MAX_BYTES = 4 * 1024 * 1024;
export const QR_LOGO_SIZE = 128;
const PREVIEW_SIZE = 2048;

export interface QrLogoSource {
  pageCount: number;
  render(page: number): Promise<HTMLCanvasElement>;
  close(): void;
}

export function validateQrLogoFile(file: File): void {
  if (file.size > QR_LOGO_MAX_BYTES) throw new Error('O arquivo deve ter até 4 MB.');
  if (!file.size) throw new Error('O arquivo está vazio. Escolha uma imagem ou um PDF.');
}

function canvasFor(width: number, height: number): HTMLCanvasElement {
  if (!Number.isFinite(width + height) || width <= 0 || height <= 0) throw new Error('Imagem inválida.');
  const scale = Math.min(1, PREVIEW_SIZE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}

export async function openQrLogo(file: File, signal: AbortSignal): Promise<QrLogoSource> {
  validateQrLogoFile(file);
  signal.throwIfAborted();
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) === '%PDF-') {
    const pdf = await import('pdfjs-dist');
    signal.throwIfAborted();
    const base = new URL('assets/pdfjs/', document.baseURI).href;
    pdf.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.mjs?v=${pdf.version}`;
    const task: PDFDocumentLoadingTask = pdf.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: `${base}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`,
      // Keep the existing CSP: rasterize only, with no PDF scripts, forms or WASM evaluation.
      useWasm: false, disableFontFace: true, enableXfa: false,
      canvasMaxAreaInBytes: 16 * 1024 * 1024, stopAtErrors: true, verbosity: 0,
    });
    let renderTask: RenderTask | undefined;
    const close = () => { renderTask?.cancel(); void task.destroy(); };
    signal.addEventListener('abort', close, { once: true });
    if (signal.aborted) close();
    try {
      const doc = await task.promise;
      signal.throwIfAborted();
      return {
        pageCount: doc.numPages,
        async render(number) {
          const page = await doc.getPage(number);
          signal.throwIfAborted();
          const original = page.getViewport({ scale: 1 });
          const canvas = canvasFor(original.width, original.height);
          const viewport = page.getViewport({ scale: canvas.width / original.width });
          try {
            renderTask = page.render({ canvas, viewport, annotationMode: pdf.AnnotationMode.DISABLE });
            await renderTask.promise;
            signal.throwIfAborted();
            return canvas;
          } finally { renderTask = undefined; page.cleanup(); }
        },
        close() { signal.removeEventListener('abort', close); close(); },
      };
    } catch (error) {
      signal.removeEventListener('abort', close);
      close();
      throw new Error((error as Error).name === 'PasswordException'
        ? 'Este PDF tem senha. Escolha uma versão sem senha.'
        : 'Não foi possível abrir o PDF. Verifique se o documento é válido.');
    }
  }

  // A blob-backed image is inert: never inject uploaded SVG/HTML into the document.
  const url = URL.createObjectURL(file);
  const image = new Image();
  const cancel = () => { image.src = ''; };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');
    if (!context) throw new Error();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      pageCount: 1,
      render: async () => canvas,
      close() { canvas.width = canvas.height = 0; },
    };
  } catch {
    throw new Error('Não foi possível abrir a imagem. Use JPG, PNG, WebP, GIF, BMP, AVIF, SVG ou PDF válido.');
  } finally {
    signal.removeEventListener('abort', cancel);
    image.src = '';
    URL.revokeObjectURL(url);
  }
}

export function logoPlacement(width: number, height: number, side: number, zoom: number, x: number, y: number, fill: boolean) {
  const scale = (fill ? Math.max(side / width, side / height) : Math.min(side / width, side / height)) * zoom;
  const drawWidth = width * scale, drawHeight = height * scale;
  return {
    width: drawWidth, height: drawHeight,
    left: (side - drawWidth) / 2 + x / 100 * Math.abs(side - drawWidth) / 2,
    top: (side - drawHeight) / 2 + y / 100 * Math.abs(side - drawHeight) / 2,
  };
}
