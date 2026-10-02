import { Directive, ElementRef, HostBinding, inject } from '@angular/core';

@Directive({ selector: 'article[title]', standalone: true })
export class AdminMetricTooltipDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  @HostBinding('attr.tabindex') readonly tabindex = '0';
  @HostBinding('attr.aria-description') get description() {
    return this.element.nativeElement.getAttribute('title') || '';
  }
}
