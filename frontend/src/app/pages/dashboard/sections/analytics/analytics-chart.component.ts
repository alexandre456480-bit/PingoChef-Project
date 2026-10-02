import { Component, Input } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt, 'pt-BR');
@Component({
  selector: 'app-analytics-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-wrap">
      <svg
        viewBox="0 0 720 220"
        role="img"
        [attr.aria-label]="title + '. Os valores exatos estão na tabela abaixo.'"
      >
        @for (tick of [0, 1, 2, 3]; track tick) {
          <line
            x1="48"
            x2="704"
            [attr.y1]="24 + tick * 52"
            [attr.y2]="24 + tick * 52"
            class="grid"
          />
          <text x="40" [attr.y]="28 + tick * 52" text-anchor="end">
            {{ (maximum * (3 - tick)) / 3 | number: '1.0-0' : 'pt-BR' }}
          </text>
        }
        <polyline [attr.points]="line" fill="none" class="data-line" />
        @for (point of points; track $index; let i = $index) {
          <circle [attr.cx]="x(i)" [attr.cy]="y(point.value)" r="3" class="data-point">
            <title>{{ point.label }}: {{ point.value | number: '1.0-0' : 'pt-BR' }}</title>
          </circle>
          @if (
            i === 0 ||
            i === points.length - 1 ||
            (points.length > 8 && i % labelStep === 0) ||
            points.length <= 8
          ) {
            <text
              [attr.x]="x(i)"
              y="210"
              [attr.text-anchor]="i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'"
            >
              {{ point.shortLabel || point.label }}
            </text>
          }
        }
      </svg>
    </div>
    <details>
      <summary>Ver valores em tabela</summary>
      <div class="table-wrap">
        <table>
          <caption>
            {{
              title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (point of points; track $index) {
              <tr>
                <th scope="row">{{ point.label }}</th>
                <td>{{ point.value | number: '1.0-0' : 'pt-BR' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .chart-wrap {
        width: 100%;
        margin: 16px 0;
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
        min-height: 150px;
        overflow: visible;
      }
      .grid {
        stroke: var(--panel-border-strong);
      }
      text {
        font:
          12px Inter,
          sans-serif;
        fill: var(--panel-text-muted);
      }
      .data-line {
        stroke: var(--panel-accent);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .data-point {
        fill: var(--panel-accent);
      }
      details {
        font-size: 0.8rem;
        color: var(--panel-text-soft);
      }
      summary {
        cursor: pointer;
        padding: 8px 0;
      }
      summary:focus-visible {
        outline: 2px solid var(--panel-accent);
      }
      .table-wrap {
        overflow: auto;
        max-height: 340px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th,
      td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--panel-border);
      }
      td {
        text-align: right;
      }
      caption {
        text-align: left;
        padding: 8px;
        font-weight: 700;
      }
    `,
  ],
})
export class AnalyticsChartComponent {
  @Input() title = '';
  @Input() points: { label: string; shortLabel?: string; value: number }[] = [];
  get maximum() {
    return Math.max(3, ...this.points.map((p) => p.value));
  }
  get labelStep() {
    return Math.ceil(this.points.length / 6);
  }
  x(index: number) {
    return this.points.length === 1
      ? 376
      : 48 + (index * 656) / Math.max(1, this.points.length - 1);
  }
  y(value: number) {
    return 180 - (value / this.maximum) * 156;
  }
  get line() {
    return this.points.map((p, i) => `${this.x(i)},${this.y(p.value)}`).join(' ');
  }
}
