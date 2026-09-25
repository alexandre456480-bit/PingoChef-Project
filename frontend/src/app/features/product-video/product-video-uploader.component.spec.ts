import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ProductVideoUploaderComponent } from './product-video-uploader.component';
import { ProductMediaDeletionStatus, VideoUploadService } from '../../services/video-upload.service';

class VideoUploadServiceStub {
  readonly deletedMediaIds: string[] = [];

  listProductMedia(): Observable<never[]> { return of([]); }
  deleteProductMedia(_itemId: string, mediaId: string): Observable<ProductMediaDeletionStatus> {
    this.deletedMediaIds.push(mediaId);
    return of('deleted');
  }
}

const readyMedia = (id: string) => ({
  id,
  mediaType: 'video' as const,
  source: 'mux' as const,
  position: 0,
  status: 'ready' as const,
  isPublished: true,
  durationSeconds: 8,
  errorCode: null,
  createdAt: '2026-09-23T10:00:00.000Z',
  updatedAt: '2026-09-23T10:01:00.000Z'
});

describe('ProductVideoUploaderComponent', () => {
  let fixture: ComponentFixture<ProductVideoUploaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductVideoUploaderComponent],
      providers: [{ provide: VideoUploadService, useClass: VideoUploadServiceStub }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProductVideoUploaderComponent);
  });

  it('uses a keyboard-accessible native button and mounts no video player', () => {
    fixture.componentRef.setInput('itemId', 'item-1');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const dropzone = element.querySelector('button.video-dropzone');

    expect(dropzone).not.toBeNull();
    expect(element.querySelector('video')).toBeNull();
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('shows the save-first state for a product without an id', () => {
    fixture.componentRef.setInput('itemId', null);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.video-locked')?.textContent).toContain('Salve o produto primeiro');
    expect(element.querySelector('.video-dropzone')).toBeNull();
  });

  it('contains reduced-motion handling in the component styles', () => {
    const styles = (ProductVideoUploaderComponent as any).ɵcmp.styles.join('\n');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('shows explicit replace and delete actions for an existing video', () => {
    const component = fixture.componentInstance;
    component.itemId = 'item-1';
    component.videoMedia = [readyMedia('media-old')];
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.video-dropzone')).toBeNull();
    expect(element.querySelector('.replace-button')?.textContent).toContain('Trocar vídeo');
    expect(element.querySelector('.delete-button')?.textContent).toContain('Excluir vídeo');

    (element.querySelector('.delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.delete-confirmation')?.textContent).toContain('Mux');
  });

  it('deletes the previous asset only after the replacement is ready', () => {
    const component = fixture.componentInstance;
    const service = TestBed.inject(VideoUploadService) as unknown as VideoUploadServiceStub;
    component.itemId = 'item-1';

    component.replacementMediaId = 'media-old';
    (component as any).activeMediaId = 'media-new';
    expect(service.deletedMediaIds).toEqual([]);

    (component as any).applyMedia([readyMedia('media-old'), readyMedia('media-new')]);

    expect(service.deletedMediaIds).toEqual(['media-old']);
    expect(component.state).toBe('ready');
  });

  it('turns an errored Mux asset into a clear UI error state', () => {
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('itemId', 'item-1');
    fixture.detectChanges();
    (component as any).activeMediaId = 'media-1';
    (component as any).applyMedia([{
      id: 'media-1',
      mediaType: 'video',
      source: 'mux',
      position: 0,
      status: 'errored',
      isPublished: false,
      durationSeconds: null,
      errorCode: 'MUX_ASSET_ERRORED',
      createdAt: '2026-09-23T10:00:00.000Z',
      updatedAt: '2026-09-23T10:01:00.000Z'
    }]);
    fixture.detectChanges();

    expect(component.state).toBe('error');
    expect(component.errorMessage).toBe('O Mux não conseguiu processar este vídeo.');
  });
});
