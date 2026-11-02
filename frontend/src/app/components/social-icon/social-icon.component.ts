import { Component, Input } from '@angular/core';
import { SocialPlatform } from '../../models/social-links';

@Component({
  selector: 'app-social-icon',
  standalone: true,
  template: `
    @if (platform !== 'other') {
      <img [src]="'/assets/social/' + platform + '.svg'" alt="" width="22" height="22" />
    } @else {
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path
          d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
          transform="translate(1 1)"
        />
      </svg>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        border-radius: 9px;
        background: #fff;
        color: #690a1a;
      }
      img {
        display: block;
        object-fit: contain;
      }
    `,
  ],
})
export class SocialIconComponent {
  @Input({ required: true }) platform!: SocialPlatform;
}
