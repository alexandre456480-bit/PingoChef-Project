import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt, 'pt-BR');

export interface ChartPoint {
  label: string;
  shortLabel?: string;
  value: number;
}

@Component({
  selector: 'app-analytics-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-chart.component.html',
  styleUrl: './analytics-chart.component.css',
})
export class AnalyticsChartComponent implements OnChanges {
  @Input() title = '';
  @Input() points: ChartPoint[] = [];
  @Input() kind: 'line' | 'bars' = 'line';
  @Input() drilldown = false;
  @Output() pointSelected = new EventEmitter<number>();
  active = signal<number | null>(null);
  maximum = 3;
  line = '';
  area = '';
  ticks: number[] = [];
  labels: { text: string; position: number }[] = [];

  ngOnChanges() {
    this.active.set(null);
    this.maximum = Math.max(3, ...this.points.map((p) => p.value));
    this.ticks = [this.maximum, (this.maximum * 2) / 3, this.maximum / 3, 0];
    this.line = this.points.map((p, i) => `${this.x(i)},${this.y(p.value)}`).join(' ');
    this.area = this.points.length
      ? `${this.x(0)},180 ${this.line} ${this.x(this.points.length - 1)},180`
      : '';
    const step = Math.max(1, Math.ceil((this.points.length - 1) / 4));
    this.labels = this.points.flatMap((p, i) =>
      i % step === 0 || i === this.points.length - 1
        ? [
            {
              text: p.shortLabel || p.label,
              position: this.points.length === 1 ? 50 : (i / (this.points.length - 1)) * 100,
            },
          ]
        : [],
    );
  }
  x(index: number) {
    return this.points.length === 1
      ? 376
      : 48 + (index * 656) / Math.max(1, this.points.length - 1);
  }
  y(value: number) {
    return 180 - (value / this.maximum) * 156;
  }
  get selected() {
    return this.active() === null ? null : this.points[this.active()!] || null;
  }
  get valueText() {
    const point = this.selected || this.points[0];
    return point ? `${point.label}: ${point.value.toLocaleString('pt-BR')}` : 'Sem dados';
  }
  pointer(event: PointerEvent) {
    if (!this.points.length) return;
    const bounds = (event.currentTarget as SVGElement).getBoundingClientRect();
    const position = ((event.clientX - bounds.left) / bounds.width) * 720;
    this.active.set(
      Math.max(
        0,
        Math.min(
          this.points.length - 1,
          Math.round(((position - 48) / 656) * (this.points.length - 1)),
        ),
      ),
    );
  }
  selectBar(index: number) {
    this.active.set(index);
    if (this.drilldown) this.pointSelected.emit(index);
  }
  leave(event: PointerEvent) {
    if (event.pointerType === 'mouse') this.active.set(null);
  }
  key(event: KeyboardEvent) {
    const index = this.active() ?? 0;
    const next: Record<string, number | null> = {
      ArrowRight: Math.min(this.points.length - 1, index + 1),
      ArrowLeft: Math.max(0, index - 1),
      Home: 0,
      End: this.points.length - 1,
      Escape: null,
    };
    if (event.key in next) {
      event.preventDefault();
      this.active.set(next[event.key]);
    }
  }
}
