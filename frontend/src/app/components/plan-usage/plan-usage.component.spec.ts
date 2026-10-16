import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PlanUsageComponent } from './plan-usage.component';
import { AuthService } from '../../services/auth.service';

describe('PlanUsageComponent Home variant', () => {
  const account = signal<any>(null);
  beforeEach(() => {
    account.set({ plan: { name: 'Free' }, usage: { videos: 0 }, entitlements: { MAX_VIDEOS: 0 } });
    TestBed.configureTestingModule({
      imports: [PlanUsageComponent],
      providers: [{ provide: AuthService, useValue: { account } }],
    });
  });
  it('preserves the default settings heading and layout without opting into Home', () => {
    const fixture = TestBed.createComponent(PlanUsageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.usage-card--compact')).toBeNull();
    expect(el.querySelector('.usage-heading > h2')?.textContent).toContain('Free · uso atual');
    expect(el.querySelector('.plan-icon')).toBeNull();
    expect(el.textContent).toContain('0 / 0'); // Existing default presentation is preserved.
  });
  it('gives Home explicit unavailable states without 0/0 or non-finite progress', () => {
    const fixture = TestBed.createComponent(PlanUsageComponent);
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Plano Free');
    expect(el.textContent).toContain('Não incluído no plano');
    expect(el.textContent).toContain('Limite indisponível');
    expect(el.textContent).not.toContain('0 / 0');
    expect(el.innerHTML).not.toContain('NaN');
    expect(fixture.componentInstance.ratio('videos', 'MAX_VIDEOS')).toBe(0);
  });
});
