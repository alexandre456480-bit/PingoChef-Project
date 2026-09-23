import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductGalleryMedia {
  id: string;
  mediaType: 'image' | 'video';
  source: 'storage' | 'mux' | 'external';
  position: number;
  durationSeconds: number | null;
}

export interface PlaybackSession {
  playbackId: string;
  playbackToken: string;
  expiresAt: string;
  videoTitle: string;
}

@Injectable({ providedIn: 'root' })
export class ProductPlaybackService {
  private readonly apiUrl = 'http://localhost:3000/api/v1';

  constructor(private readonly http: HttpClient) {}

  requestPlayback(
    itemId: string,
    mediaId: string,
    publicSlug: string | null,
    previewMode: boolean
  ): Observable<{ success: boolean; data: PlaybackSession }> {
    if (previewMode) {
      const token = localStorage.getItem('access_token') || '';
      return this.http.post<{ success: boolean; data: PlaybackSession }>(
        `${this.apiUrl}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/playback`,
        {},
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      );
    }

    if (!publicSlug) throw new Error('Slug público ausente.');
    return this.http.post<{ success: boolean; data: PlaybackSession }>(
      `${this.apiUrl}/public/menus/${encodeURIComponent(publicSlug)}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/playback`,
      {}
    );
  }

  publishReadyMedia(): Observable<{ success: boolean; data: { publishedCount: number } }> {
    const token = localStorage.getItem('access_token') || '';
    return this.http.post<{ success: boolean; data: { publishedCount: number } }>(
      `${this.apiUrl}/items/media/publish-ready`,
      {},
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    );
  }
}
