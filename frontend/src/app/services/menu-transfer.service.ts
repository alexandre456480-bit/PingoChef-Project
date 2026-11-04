import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../constants/api';

export interface MenuImportPreview {
  id: string; name: string; template: string; categories: number; subcategories: number; items: number;
  excludedVideos: number; canReplaceCatalog: boolean; blockedReason: string;
}
export const MENU_ARCHIVE_MAX_BYTES = 32 * 1024 * 1024;
const CHUNK_CHARS = 500_000;

@Injectable({ providedIn: 'root' })
export class MenuTransferService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/menu-transfer`;
  async exportMenu(progress: (percent: number) => void): Promise<Blob> {
    const { data } = await firstValueFrom(this.http.post<any>(this.url, { kind: 'export' }));
    try {
      const parts: string[] = [];
      for (let i = 0; i < data.parts; i++) {
        const part = await firstValueFrom(this.http.get<any>(`${this.url}/${data.id}/parts/${i}`));
        parts.push(part.data);
        progress(Math.round((i + 1) / data.parts * 100));
      }
      const blob = new Blob(parts, { type: 'application/json' });
      if (blob.size > MENU_ARCHIVE_MAX_BYTES) throw new Error('O arquivo ultrapassa o limite de 32 MB.');
      return blob;
    } finally { await this.discard(data.id); }
  }
  async prepareImport(file: File, progress: (percent: number) => void): Promise<MenuImportPreview> {
    if (!file.size || file.size > MENU_ARCHIVE_MAX_BYTES) throw new Error('Selecione um arquivo PingoChef de até 32 MB.');
    const text = await file.text();
    let archive: any;
    try { archive = JSON.parse(text); } catch { throw new Error('O arquivo não contém JSON válido.'); }
    if (archive?.format !== 'pingochef-menu' || archive?.version !== 1) throw new Error('Selecione um arquivo de cardápio PingoChef compatível (versão 1).');
    const parts = Math.ceil(text.length / CHUNK_CHARS);
    const { data } = await firstValueFrom(this.http.post<any>(this.url, { kind: 'import', parts }));
    try {
      for (let i = 0; i < parts; i++) {
        await firstValueFrom(this.http.put(`${this.url}/${data.id}/parts/${i}`, { content: text.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS) }));
        progress(Math.round((i + 1) / parts * 100));
      }
      const preview = await firstValueFrom(this.http.post<any>(`${this.url}/${data.id}/preview`, {}));
      return { ...preview.data, id: data.id };
    } catch (error) { await this.discard(data.id); throw error; }
  }
  async apply(id: string, catalog: boolean): Promise<void> {
    await firstValueFrom(this.http.post(`${this.url}/${id}/apply`, { catalog, confirmed: true }));
  }
  async discard(id: string): Promise<void> {
    try { await firstValueFrom(this.http.delete(`${this.url}/${id}`)); } catch { /* Expiring buffers are also cleaned server-side. */ }
  }
  download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export function menuTransferError(error: any): string {
  if (error?.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (error?.status === 413) return 'O arquivo ultrapassa o tamanho permitido. O limite é 32 MB.';
  if (error?.status === 429) return 'Aguarde um pouco antes de iniciar outra transferência.';
  if (['UNSAFE_MENU_ARCHIVE', 'UNSAFE_MENU_IMAGE', 'INVALID_MENU_ARCHIVE', 'VALIDATION_ERROR', 'DUPLICATE_MENU_REFERENCE', 'INVALID_RESOURCE_RELATIONSHIP'].includes(error?.error?.error?.code))
    return 'O arquivo contém dados inválidos ou incompatíveis. Exporte novamente pelo PingoChef.';
  return error?.error?.error?.message || (error instanceof Error ? error.message : '') || 'Não foi possível transferir o cardápio. Tente novamente.';
}
