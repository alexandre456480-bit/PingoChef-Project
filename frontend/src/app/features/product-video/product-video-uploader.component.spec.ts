import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ProductVideoUploaderComponent } from './product-video-uploader.component';
import { VideoUploadService } from '../../services/video-upload.service';

class VideoUploadServiceStub {
  listProductMedia(): Observable<never[]> { return of([]); }
  deleteProductMedia(): Observable<void> { return of(undefined); }
}

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
