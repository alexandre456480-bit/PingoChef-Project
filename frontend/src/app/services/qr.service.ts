import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { API_BASE_URL } from '../constants/api';

export interface QrConfiguration {
  color: string;
  frame: 'none' | 'card';
  caption: string;
  logoPng: string | null;
}
export interface OwnerQr {
  id: string;
  name: string;
  publicIdentifier: string;
  publicUrl: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
  revision: number;
  configuration: QrConfiguration;
}
export interface OwnerQrList {
  rows: OwnerQr[];
  limit: number;
  customization: boolean;
  publicAvailable: boolean;
}
@Injectable({ providedIn: 'root' })
export class QrService {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/qr`;
  list() {
    return this.http.get<{ data: OwnerQrList }>(this.base).pipe(map((r) => r.data));
  }
  create(name: string, configuration: QrConfiguration) {
    return this.http
      .post<{ data: OwnerQr }>(this.base, { name, configuration })
      .pipe(map((r) => r.data));
  }
  update(row: OwnerQr, name: string, configuration: QrConfiguration, active: boolean) {
    return this.http
      .put<{ data: OwnerQr }>(`${this.base}/${row.id}`, {
        name,
        configuration,
        active,
        revision: row.revision,
      })
      .pipe(map((r) => r.data));
  }
  image(id: string, format: 'png' | 'svg' = 'png') {
    return this.http.get(`${this.base}/${id}/image`, { params: { format }, responseType: 'blob' });
  }
}
