import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PingoLoaderComponent } from './pingo-loader.component';

describe('PingoLoaderComponent', () => {
  let fixture: ComponentFixture<PingoLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PingoLoaderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PingoLoaderComponent);
    fixture.detectChanges();
  });

  it('preloads all six official frames in the expected order', () => {
    const element = fixture.nativeElement as HTMLElement;
    const frames = Array.from(element.querySelectorAll<HTMLImageElement>('.pingo-loader__preload-frame'));

    expect(frames).toHaveLength(6);
    expect(frames.map(frame => frame.getAttribute('src'))).toEqual([
      '/assets/mascots/loading/pingo-run-01.webp',
      '/assets/mascots/loading/pingo-run-02.webp',
      '/assets/mascots/loading/pingo-run-03.webp',
      '/assets/mascots/loading/pingo-run-04.webp',
      '/assets/mascots/loading/pingo-run-05.webp',
      '/assets/mascots/loading/pingo-run-06.webp'
    ]);
  });

  it('announces its message and applies fullscreen and size variants', () => {
    fixture.componentRef.setInput('active', true);
    fixture.componentRef.setInput('fullscreen', true);
    fixture.componentRef.setInput('size', 'large');
    fixture.componentRef.setInput('message', 'Preparando seu cardápio...');
    fixture.detectChanges();

    const loader = fixture.nativeElement.querySelector('.pingo-loader') as HTMLElement;
    expect(loader.getAttribute('role')).toBe('status');
    expect(loader.getAttribute('aria-live')).toBe('polite');
    expect(loader.getAttribute('aria-busy')).toBe('true');
    expect(loader.classList.contains('pingo-loader--fullscreen')).toBe(true);
    expect(loader.classList.contains('pingo-loader--large')).toBe(true);
    expect(loader.textContent).toContain('Preparando seu cardápio...');
  });

  it('starts hidden and keeps the delayed entrance non-blocking', () => {
    let loader = fixture.nativeElement.querySelector('.pingo-loader') as HTMLElement;
    expect(loader.classList.contains('pingo-loader--visible')).toBe(false);
    expect(loader.getAttribute('aria-hidden')).toBe('true');

    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    loader = fixture.nativeElement.querySelector('.pingo-loader') as HTMLElement;
    expect(loader.classList.contains('pingo-loader--visible')).toBe(false);
    expect(loader.getAttribute('aria-busy')).toBe('true');
  });
});
