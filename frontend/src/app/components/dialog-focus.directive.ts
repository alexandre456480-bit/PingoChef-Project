import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
@Directive({ selector: '[appDialogFocus]', standalone: true })
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  @Output() dialogEscape = new EventEmitter<void>();
  private document = inject(DOCUMENT);
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private previous = this.document.activeElement as HTMLElement | null;
  private nodes() {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
      ),
    ).filter((e) => e.getClientRects().length > 0);
  }
  ngAfterViewInit() {
    (this.nodes()[0] || this.element.nativeElement).focus();
  }
  @HostListener('keydown', ['$event']) onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.dialogEscape.emit();
    }
    if (e.key === 'Tab') {
      const nodes = this.nodes();
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const index = nodes.indexOf(this.document.activeElement as HTMLElement);
      if (e.shiftKey && index <= 0) {
        e.preventDefault();
        nodes.at(-1)!.focus();
      } else if (!e.shiftKey && (index === nodes.length - 1 || index < 0)) {
        e.preventDefault();
        nodes[0].focus();
      }
    }
  }
  ngOnDestroy() {
    if (this.previous?.isConnected && this.document.defaultView?.getComputedStyle(this.previous).visibility !== 'hidden') this.previous.focus();
    else this.document.querySelector<HTMLElement>('[aria-label="Abrir menu"]')?.focus();
  }
}
