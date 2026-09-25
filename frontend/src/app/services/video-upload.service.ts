import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpEventType,
  HttpHeaders,
  HttpRequest
} from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import type { AllowedVideoMimeType } from '../features/product-video/video-file-validation';
import { API_BASE_URL } from '../constants/api';

export type ProductMediaStatus =
  | 'waiting'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'rejected'
  | 'errored'
  | 'pending_deletion';

export interface ProductMediaView {
  id: string;
  mediaType: 'image' | 'video';
  source: 'storage' | 'mux' | 'external';
  position: number;
  status: ProductMediaStatus;
  isPublished: boolean;
  durationSeconds: number | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoUploadIntent {
  mediaId: string;
  uploadUrl: string;
  expiresAt: string;
  maxFileSizeBytes: number;
  maxDurationSeconds: number;
}

export interface DirectUploadProgress {
  progress: number;
  complete: boolean;
}

export type ProductMediaDeletionStatus = 'deleted' | 'pending_deletion';

@Injectable({ providedIn: 'root' })
export class VideoUploadService {
  private readonly apiUrl = API_BASE_URL;

  constructor(private readonly http: HttpClient) {}

  createUploadIntent(
    itemId: string,
    fileSizeBytes: number,
    mimeType: AllowedVideoMimeType
  ): Observable<VideoUploadIntent> {
    return this.http.post<{ success: true; data: VideoUploadIntent }>(
      `${this.apiUrl}/items/${encodeURIComponent(itemId)}/media/video/upload-intent`,
      { fileSizeBytes, mimeType },
      this.authOptions()
    ).pipe(map(response => response.data));
  }

  uploadDirect(uploadUrl: string, file: File, mimeType: AllowedVideoMimeType): Observable<DirectUploadProgress> {
    const request = new HttpRequest('PUT', uploadUrl, file, {
      headers: new HttpHeaders({ 'Content-Type': mimeType }),
      reportProgress: true,
      responseType: 'text'
    });

    // Deliberately no PingoChef Authorization header here: this request goes
    // from the browser directly to the short-lived Mux URL.
    return this.http.request(request).pipe(
      filter(event => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map(event => {
        if (event.type === HttpEventType.Response) {
          return { progress: 100, complete: true };
        }
        const total = event.total || file.size;
        return {
          progress: total > 0 ? Math.min(99, Math.round((event.loaded / total) * 100)) : 0,
          complete: false
        };
      })
    );
  }

  listProductMedia(itemId: string): Observable<ProductMediaView[]> {
    return this.http.get<{ success: true; data: ProductMediaView[] }>(
      `${this.apiUrl}/items/${encodeURIComponent(itemId)}/media`,
      this.authOptions()
    ).pipe(map(response => response.data));
  }

  deleteProductMedia(itemId: string, mediaId: string): Observable<ProductMediaDeletionStatus> {
    return this.http.delete<{ success: true; data: { status: 'pending_deletion' } }>(
      `${this.apiUrl}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}`,
      { ...this.authOptions(), observe: 'response' }
    ).pipe(map(response => response.status === 202 ? 'pending_deletion' : 'deleted'));
  }

  private authOptions(): { headers: HttpHeaders } {
    const token = localStorage.getItem('access_token') || '';
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }
}
