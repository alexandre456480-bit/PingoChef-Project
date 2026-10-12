import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminApiService } from './admin-api.service';
import { AdminClientDetailComponent } from './admin-client-detail.component';

describe('Admin plan assignment', () => {
  it('reauthenticates and sends the selected plan with an audit reason', () => {
    const id = '72000000-0000-0000-0000-000000000001';
    const account = {
      name: 'Pingo Chefinho',
      plan: { code: 'FREE', name: 'Free' },
      subscription: { status: 'active', provider: null },
      accountState: { lifecycle_status: 'ACTIVE' }
    };
    const api = {
      business: vi.fn().mockReturnValue(of(account)),
      reauthenticate: vi.fn().mockReturnValue(of(void 0)),
      assignPlan: vi.fn().mockReturnValue(of({ success: true, data: { businessId: id, planCode: 'PRO' } }))
    };
    TestBed.configureTestingModule({
      imports: [AdminClientDetailComponent],
      providers: [provideRouter([]), { provide: AdminApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(AdminClientDetailComponent);
    const component = fixture.componentInstance;
    component.id = id;
    component.ngOnChanges();
    component.openAction('plan');
    component.selectedPlan = 'PRO';
    component.reason = 'Concessão solicitada pelo proprietário';
    component.password = 'admin-password';

    component.confirmAction();

    expect(api.reauthenticate).toHaveBeenCalledWith('admin-password');
    expect(api.assignPlan).toHaveBeenCalledWith(id, 'PRO', 'Concessão solicitada pelo proprietário');
    expect(api.business).toHaveBeenCalledTimes(2);
    expect(component.action).toBeNull();
  });
});
