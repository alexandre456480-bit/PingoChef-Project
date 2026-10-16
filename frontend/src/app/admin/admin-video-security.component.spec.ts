import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AdminVideoSecurityComponent } from './admin-video-security.component';
import { AdminApiService, VideoSecurityReport } from './admin-api.service';

describe('Admin video security', () => {
  const report: VideoSecurityReport = { days:1,page:1,total:1,measurement:'ESTIMATED',globalState:'NORMAL',environmentKillSwitch:false,
    businesses:[{businessId:'business',name:'Fixture',plan:'PRO',activeVideos:2,metrics:{playback_token_requests:8},estimatedDeliverySeconds:64,
      providerReportedDeliverySeconds:null,state:'SOFT_ALERT',expiresAt:null}],media:[],events:[] };
  const api = { videoSecurity: vi.fn(), setVideoSecurityState: vi.fn() };
  beforeEach(() => {
    api.videoSecurity.mockReset().mockReturnValue(of(report));api.setVideoSecurityState.mockReset().mockReturnValue(of({success:true}));
    TestBed.configureTestingModule({ imports:[AdminVideoSecurityComponent],providers:[{provide:AdminApiService,useValue:api}] });
  });
  it('labels estimates separately from unmeasured provider usage and never presents a currency cost', async () => {
    const fixture=TestBed.createComponent(AdminVideoSecurityComponent);fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Uso estimado');
    expect(fixture.nativeElement.textContent).toContain('Não medido');
    expect(fixture.nativeElement.textContent).toContain('SOFT_ALERT');
    expect(fixture.nativeElement.textContent).not.toContain('R$');
  });
  it('requires an explicit target and reason and prevents concurrent mutations', () => {
    const fixture=TestBed.createComponent(AdminVideoSecurityComponent);const component=fixture.componentInstance;fixture.detectChanges();
    component.apply();expect(api.setVideoSecurityState).not.toHaveBeenCalled();
    component.target='business';component.reason='Review incident';
    api.setVideoSecurityState.mockReturnValue(new Subject());
    component.apply();component.apply();
    expect(api.setVideoSecurityState).toHaveBeenCalledTimes(1);
    expect(api.setVideoSecurityState).toHaveBeenCalledWith('business','HARD_BLOCK',300,'Review incident');
  });
  it('explains recent reauthentication required by the server', () => {
    const fixture=TestBed.createComponent(AdminVideoSecurityComponent);const component=fixture.componentInstance;fixture.detectChanges();
    api.setVideoSecurityState.mockReturnValue(throwError(()=>({error:{error:{code:'ADMIN_REAUTH_REQUIRED'}}})));
    component.target='business';component.reason='Review incident';component.apply();
    expect(component.error()).toContain('Reautentique');expect(component.saving()).toBe(false);
  });
});
