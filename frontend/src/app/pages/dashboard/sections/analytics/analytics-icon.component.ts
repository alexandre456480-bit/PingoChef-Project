import { Component, Input } from '@angular/core';

const paths = {
  chart: ['M3 3v18h18', 'm7 14 4-4 4 3 6-8'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  ],
  product: ['m12 3 9 5-9 5-9-5 9-5Z', 'M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5'],
  heart: [
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  ],
  video: ['M4 4h16v16H4z', 'm10 8 6 4-6 4V8Z'],
  layers: ['m12 3 10 5-10 5L2 8l10-5Z', 'm2 12 10 5 10-5M2 16l10 5 10-5'],
  globe: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18'],
  clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M12 7v5l3 2'],
  qr: ['M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z', 'M15 15h3v3h3v3h-6v-6ZM21 12v3M12 3v9H3M12 15v6'],
  spark: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
  download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v5h16v-5'],
  filter: ['M4 5h16M7 12h10M10 19h4'],
} as const;
export type AnalyticsIcon = keyof typeof paths;

@Component({
  selector: 'app-analytics-icon',
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @for (path of paths[name]; track $index) {
      <path [attr.d]="path" />
    }
  </svg>`,
  styles: [
    ':host { display: inline-flex; width: 20px; height: 20px; flex: 0 0 auto; } svg { width: 100%; height: 100%; }',
  ],
})
export class AnalyticsIconComponent {
  @Input() name: AnalyticsIcon = 'chart';
  readonly paths = paths;
}
