import { ApplicationRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable } from 'rxjs';
import { NavigationStart, Router } from '@angular/router';
import type { ImageCropComponent, ImageCropOptions } from '../components/image-crop/image-crop.component';

@Injectable({ providedIn: 'root' })
export class ImageCropService {
  private app = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private document = inject(DOCUMENT);
  private router = inject(Router, { optional: true });
  private active = false;

  open(file: File, options: ImageCropOptions): Observable<string | null> {
    return new Observable(subscriber => {
      if (this.active) { subscriber.error(new Error('Conclua o enquadramento aberto antes de escolher outra imagem.')); return; }
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        subscriber.error(new Error('Selecione uma imagem JPG, PNG, WebP ou AVIF de até 10 MB.')); return;
      }
      this.active = true;
      let ref: ReturnType<typeof createComponent<ImageCropComponent>> | undefined;
      const source = URL.createObjectURL(file);
      const navigation = this.router?.events.subscribe(event => {
        if (event instanceof NavigationStart) { subscriber.next(null); subscriber.complete(); }
      });
      import('../components/image-crop/image-crop.component').then(({ ImageCropComponent }) => {
        if (subscriber.closed) return;
        ref = createComponent(ImageCropComponent, { environmentInjector: this.injector });
        ref.instance.source = source;
        ref.instance.options = options;
        ref.instance.finish = value => { subscriber.next(value); subscriber.complete(); };
        (this.document.querySelector('.dashboard-shell') || this.document.body).appendChild(ref.location.nativeElement);
        this.app.attachView(ref.hostView);
        ref.changeDetectorRef.detectChanges();
        ref.instance.open();
      }).catch(error => subscriber.error(error));
      return () => {
        navigation?.unsubscribe();
        if (ref) { this.app.detachView(ref.hostView); ref.destroy(); ref.location.nativeElement.remove(); }
        URL.revokeObjectURL(source);
        this.active = false;
      };
    });
  }
}
