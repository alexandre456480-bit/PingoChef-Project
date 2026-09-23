import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { ProductMediaGalleryComponent } from './product-media-gallery.component';
import { ProductPlaybackService } from '../../services/product-playback.service';
import { MuxPlayerLoaderService } from '../../services/mux-player-loader.service';

class PlaybackServiceStub {
  requestPlayback = vi.fn().mockReturnValue(NEVER);
}

class PlayerLoaderStub {
  load = vi.fn().mockResolvedValue(undefined);
}

describe('ProductMediaGalleryComponent', () => {
  let fixture: ComponentFixture<ProductMediaGalleryComponent>;
  let playback: PlaybackServiceStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductMediaGalleryComponent],
      providers: [
        { provide: ProductPlaybackService, useClass: PlaybackServiceStub },
        { provide: MuxPlayerLoaderService, useClass: PlayerLoaderStub }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProductMediaGalleryComponent);
    playback = TestBed.inject(ProductPlaybackService) as unknown as PlaybackServiceStub;
    fixture.componentRef.setInput('itemId', 'item-1');
    fixture.componentRef.setInput('productName', 'Produto');
    fixture.componentRef.setInput('publicSlug', 'loja-teste');
    fixture.componentRef.setInput('media', [{
      id: 'media-1',
      mediaType: 'video',
      source: 'mux',
      position: 0,
      durationSeconds: 12
    }]);
    fixture.detectChanges();
  });

  it('does not mount a player or request a token before the explicit Play click', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('mux-player')).toBeNull();
    expect(playback.requestPlayback).not.toHaveBeenCalled();
    expect(element.querySelector('button.play-button')).not.toBeNull();
  });

  it('requests signed playback only when the Play button is activated', () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.play-button')?.click();
    expect(playback.requestPlayback).toHaveBeenCalledWith(
      'item-1',
      'media-1',
      'loja-teste',
      false
    );
  });

  it('renders the mounted player with preload none and no public stream URL', async () => {
    playback.requestPlayback.mockReturnValueOnce(of({
      success: true,
      data: {
        playbackId: 'signed-playback',
        playbackToken: 'short-token',
        expiresAt: '2026-09-23T12:02:00.000Z',
        videoTitle: 'Produto'
      }
    }));
    const slide = fixture.componentInstance.activeSlide;
    if (slide.kind !== 'video') throw new Error('Expected a video slide');
    await fixture.componentInstance.play(slide.media);
    expect(fixture.componentInstance.session, fixture.componentInstance.errorMessage ?? undefined).not.toBeNull();
    expect(fixture.componentInstance.activeMediaId).toBe('media-1');
    fixture.detectChanges();

    const player = (fixture.nativeElement as HTMLElement).querySelector('mux-player');
    expect(player).not.toBeNull();
    expect(player?.getAttribute('preload')).toBe('none');
    expect(player?.getAttribute('playback-token')).toBe('short-token');
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('stream.mux.com');
  });

  it('supports keyboard navigation and reduced-motion styles', () => {
    const styles = (ProductMediaGalleryComponent as any).ɵcmp.styles.join('\n');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    const gallery = (fixture.nativeElement as HTMLElement).querySelector('.media-gallery');
    expect(gallery?.getAttribute('tabindex')).toBe('0');
  });
});
