import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { OwnerSessionState } from './owner-session-state.service';
import { ownerSessionInterceptor } from './owner-session.interceptor';

describe('Owner cookie session', () => {
  let auth: AuthService; let http: HttpTestingController; let state: OwnerSessionState;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([ownerSessionInterceptor])),provideHttpClientTesting()]});
    auth=TestBed.inject(AuthService);http=TestBed.inject(HttpTestingController);state=TestBed.inject(OwnerSessionState);
  });
  afterEach(()=>{http.verify();localStorage.clear();});
  it('login stores only memory state and uses credentials cookie',()=>{
    auth.login({email:'owner@example.test',password:'test-password'}).subscribe();
    const login=http.expectOne('/api/v1/auth/login');expect(login.request.withCredentials).toBe(true);
    login.flush({success:true,data:{user:{id:'owner'},business:{id:'business'},csrfToken:'csrf'}});
    expect(auth.currentUser()?.id).toBe('owner');expect(localStorage.getItem('access_token')).toBeNull();
    auth.publishBusinessMenu().subscribe();const publish=http.expectOne('/api/v1/business/publish');
    expect(publish.request.headers.get('X-CSRF-Token')).toBe('csrf');expect(publish.request.headers.has('Authorization')).toBe(false);
    publish.flush({success:true});
  });
  it('reload restores /me and shares one in-flight request',()=>{
    auth.restore().subscribe();auth.restore().subscribe();const me=http.expectOne('/api/v1/auth/me');
    expect(me.request.withCredentials).toBe(true);
    me.flush({success:true,data:{user:{id:'owner'},csrfToken:'csrf'}});expect(state.csrfToken()).toBe('csrf');
  });
  it('legacy import is attempted once and removes old tokens even when migration is closed',()=>{
    localStorage.setItem('access_token','legacy-access');localStorage.setItem('refresh_token','legacy-refresh');
    auth.restore().subscribe({error:()=>{}});
    const me=http.expectOne('/api/v1/auth/me');expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();me.flush({}, {status:401,statusText:'Unauthorized'});
    const migration=http.expectOne('/api/v1/auth/migrate-session');expect(migration.request.headers.get('Authorization')).toBe('Bearer legacy-access');
    expect(migration.request.body).toEqual({});migration.flush({}, {status:410,statusText:'Gone'});
    auth.restore().subscribe({error:()=>{}});http.expectOne('/api/v1/auth/me').flush({}, {status:401,statusText:'Unauthorized'});
    http.expectNone('/api/v1/auth/migrate-session');
  });
  it('public, admin and Mux requests never receive owner CSRF or credential flags',()=>{
    state.csrfToken.set('csrf');const client=TestBed.inject(HttpClient);
    for(const path of ['/api/v1/public/menus/test','/api/v1/admin/auth/login','https://uploads.example.test/mux','https://evil.test/api/v1/items']){
      client.post(path,{}).subscribe();const req=http.expectOne(path);expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
      expect(req.request.withCredentials).toBe(false);req.flush({});
    }
  });
  it('logout revokes server session before clearing memory',()=>{
    state.accept({user:{id:'owner'},csrfToken:'csrf'});auth.logout(true).subscribe();
    const logout=http.expectOne('/api/v1/auth/logout-all');expect(auth.currentUser()).not.toBeNull();
    expect(logout.request.headers.get('X-CSRF-Token')).toBe('csrf');logout.flush(null,{status:204,statusText:'No Content'});
    expect(auth.currentUser()).toBeNull();expect(state.csrfToken()).toBeNull();
  });
});
