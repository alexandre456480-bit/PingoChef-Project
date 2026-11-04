import { Injectable } from '@angular/core';
import { Observable, defer, of } from 'rxjs';

// Leave room below the hosting platform's 4.5 MB request limit, including base64 overhead.
export const MAX_SAVE_BYTES = 3_500_000;
const MAX_IMAGE_CHARS = 400_000;
const INLINE_IMAGE = /^data:image\/(?:png|jpe?g|webp|avif);base64,/i;
export const payloadBytes = (value: unknown): number => new Blob([JSON.stringify(value)]).size;

export function imageSaveError(error: any, fallback: string): string {
  if (error instanceof ImagePayloadError) return error.message;
  if (error?.status === 413) return 'As imagens ultrapassaram o tamanho permitido. Atualize a página e selecione as imagens novamente.';
  return fallback;
}

export class ImagePayloadError extends Error {}

@Injectable({ providedIn: 'root' })
export class ImagePayloadService {
  prepare<T>(body: T): Observable<T> {
    const counts = new Map<string, number>();
    const visit = (value: unknown): void => {
      if (typeof value === 'string' && INLINE_IMAGE.test(value)) counts.set(value, (counts.get(value) || 0) + 1);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(body);
    const bytes = payloadBytes(body);
    if (bytes <= MAX_SAVE_BYTES && [...counts.keys()].every(image => image.length <= MAX_IMAGE_CHARS)) return of(body);
    return defer(async () => {
      const occurrences = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const imageBytes = [...counts].reduce((sum, [image, count]) => sum + image.length * count, 0);
      const available = MAX_SAVE_BYTES - (bytes - imageBytes) - 4096;
      if (!occurrences || available < occurrences * 1024) throw new ImagePayloadError('O conteúdo excede o tamanho permitido para salvar. Reduza a quantidade de imagens incorporadas.');
      const budget = Math.min(MAX_IMAGE_CHARS, Math.floor(available / occurrences));
      const replacements = new Map<string, string>();
      // Process sequentially to bound memory; repeated banners are decoded once per save.
      for (const image of counts.keys()) {
        replacements.set(image, image.length > budget ? await this.optimizeImage(image, budget) : image);
      }
      const replace = (value: unknown): unknown => {
        if (typeof value === 'string') return replacements.get(value) ?? value;
        if (Array.isArray(value)) return value.map(replace);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
        return value;
      };
      const prepared = replace(body) as T;
      if (payloadBytes(prepared) > MAX_SAVE_BYTES) throw new ImagePayloadError('Não foi possível reduzir as imagens ao tamanho permitido. Selecione imagens menores.');
      return prepared;
    });
  }

  readFile(file: File): Observable<string> {
    return defer(async () => {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new ImagePayloadError('Não foi possível ler a imagem. Selecione o arquivo novamente.'));
        reader.readAsDataURL(file);
      });
      if (!INLINE_IMAGE.test(source)) throw new ImagePayloadError('Selecione uma imagem JPG, PNG, WebP ou AVIF.');
      return source.length <= MAX_IMAGE_CHARS ? source : this.optimizeImage(source, MAX_IMAGE_CHARS);
    });
  }

  async optimizeImage(source: string, maxChars: number): Promise<string> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImagePayloadError('Não foi possível abrir uma das imagens. Selecione novamente o arquivo JPG, PNG ou WebP.'));
      img.src = source;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new ImagePayloadError('A imagem selecionada é inválida.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new ImagePayloadError('Não foi possível otimizar a imagem neste navegador.');
    // Preserve aspect ratio and transparency; never stretch, crop, or upscale the source.
    const initialScale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    try {
      for (let step = 0; step < 12; step++) {
        const scale = initialScale * Math.pow(.8, step);
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [.9, .82, .74]) {
          const result = canvas.toDataURL('image/webp', quality);
          if (result.startsWith('data:image/') && result.length <= maxChars) return result;
        }
      }
    } finally {
      canvas.width = canvas.height = 0;
    }
    throw new ImagePayloadError('A imagem continua muito grande. Escolha um arquivo menor.');
  }
}
