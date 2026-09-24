import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VideoUploadService } from './video-upload.service';

describe('VideoUploadService', () => {
  let service: VideoUploadService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('access_token', 'user-access-token');
    TestBed.configureTestingModule({
      providers: [VideoUploadService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VideoUploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('requests an intent from the authenticated BFF without authority fields', () => {
    service.createUploadIntent('item-1', 1024, 'video/mp4').subscribe(result => {
      expect(result.mediaId).toBe('media-1');
    });

    const req = http.expectOne('/api/v1/items/item-1/media/video/upload-intent');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer user-access-token');
    expect(req.request.body).toEqual({ fileSizeBytes: 1024, mimeType: 'video/mp4' });
    expect(req.request.body).not.toHaveProperty('businessId');
    req.flush({
      success: true,
      data: {
        mediaId: 'media-1',
        uploadUrl: 'https://storage.example.test/upload',
        expiresAt: '2026-09-23T12:00:00.000Z',
        maxFileSizeBytes: 52428800,
        maxDurationSeconds: 15
      }
    });
  });

  it('uploads directly to Mux with progress and never forwards the PingoChef token', () => {
    const progress: number[] = [];
    const file = videoFile('produto.mp4', 'video/mp4', 100);

    service.uploadDirect('https://storage.example.test/upload', file, 'video/mp4')
      .subscribe(event => progress.push(event.progress));

    const req = http.expectOne('https://storage.example.test/upload');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBe(file);
    expect(req.request.headers.get('Content-Type')).toBe('video/mp4');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.event({ type: HttpEventType.UploadProgress, loaded: 58, total: 100 });
    req.flush('');
    expect(progress).toEqual([58, 100]);
  });
});

function videoFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}
