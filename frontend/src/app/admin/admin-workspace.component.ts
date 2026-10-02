import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, AdminDashboard, AdminFilter } from './admin-api.service';
import { AdminFilterComponent } from './admin-filter.component';
import { AdminOverviewComponent } from './admin-overview.component';
import { AdminClientsComponent } from './admin-clients.component';
import { AdminClientDetailComponent } from './admin-client-detail.component';
import { AdminInvitesComponent } from './admin-invites.component';
import { AdminAnalyticsComponent } from './admin-analytics.component';
import { AdminOperationsComponent } from './admin-operations.component';
import { filterFromParams, presetFilter } from './admin-filter';

@Component({
  selector:'app-admin-workspace',standalone:true,
  imports:[CommonModule,RouterLink,AdminFilterComponent,AdminOverviewComponent,AdminClientsComponent,
    AdminClientDetailComponent,AdminInvitesComponent,AdminAnalyticsComponent,AdminOperationsComponent],
  template:`
    <div class="admin-shell">
      <aside class="admin-sidebar" [class.open]="menuOpen()" aria-label="Navegação administrativa">
        <a class="admin-brand" routerLink="/admin/overview" (click)="menuOpen.set(false)"><img src="/logo_principal_tema_light.webp" alt="PingoChef"/><span>ADMIN</span></a>
        <nav>
          @for(group of groups;track group.title){
            <div class="admin-nav-group"><span class="admin-nav-title">{{group.title}}</span>
              @for(item of group.items;track item.path){
                <a [routerLink]="'/admin/'+item.path" [queryParams]="filterParams" (click)="menuOpen.set(false)"
                  [class.current]="section===item.path || (item.path==='clients' && !!clientId)"
                  [attr.aria-current]="section===item.path?'page':null"><span aria-hidden="true">{{item.icon}}</span>{{item.label}}</a>
              }
            </div>
          }
        </nav>
        <div class="admin-sidebar-foot"><span>Conta administrativa</span><button type="button" (click)="logout()">Sair com segurança</button>@if(logoutError()){<span role="alert">Falha ao sair. Tente novamente.</span>}</div>
      </aside>
      @if(menuOpen()){<button class="admin-menu-backdrop" type="button" aria-label="Fechar navegação" (click)="menuOpen.set(false)"></button>}
      <main class="admin-main" id="main-content">
        <header class="admin-topbar"><button class="admin-menu-toggle" type="button" aria-label="Abrir navegação" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">☰</button>
          <div><span class="admin-topbar-kicker">PINGOCHEF / ADMIN</span><h1>{{title}}</h1></div>
          <div class="admin-topbar-right"><span class="admin-session-dot" aria-hidden="true"></span><span>Sessão protegida</span></div>
        </header>
        <div class="admin-content">
          @if(analytical){<app-admin-filter [filter]="filter" (filterChange)="changeFilter($event)"/>}
          @switch(section){
            @case('overview'){<app-admin-overview [data]="report()" [filter]="filter" [loading]="loading()" [error]="error()"/>}
            @case('clients'){
              @if(clientId){<app-admin-client-detail [id]="clientId"/>}
              @else{<app-admin-clients/>}
            }
            @case('invites'){<app-admin-invites/>}
            @case('analytics'){<app-admin-analytics [data]="report()" [filter]="filter" [loading]="loading()" [error]="error()"/>}
            @default{<app-admin-operations [section]="section" [data]="report()" [filter]="filter" [loading]="loading()" [error]="error()"/>}
          }
        </div>
      </main>
    </div>
  `
})
export class AdminWorkspaceComponent {
  private readonly api=inject(AdminApiService);
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private readonly destroy=inject(DestroyRef);
  private readonly reportRequests=new Subject<AdminFilter>();
  readonly menuOpen=signal(false);
  readonly report=signal<AdminDashboard|null>(null);
  readonly loading=signal(false);
  readonly error=signal(false);
  readonly logoutError=signal(false);
  filter=presetFilter();section='overview';clientId:string|null=null;
  private lastKey='';
  readonly groups=[
    {title:'VISÃO GERAL',items:[{path:'overview',label:'Painel',icon:'◫'}]},
    {title:'GESTÃO',items:[{path:'clients',label:'Clientes',icon:'▣'},{path:'invites',label:'Convites',icon:'✉'}]},
    {title:'NEGÓCIO',items:[{path:'subscriptions',label:'Assinaturas',icon:'◈'},{path:'analytics',label:'Analytics',icon:'▥'}]},
    {title:'INFRAESTRUTURA',items:[{path:'usage',label:'Uso e custos',icon:'◉'},{path:'videos',label:'Vídeos',icon:'▷'},{path:'storage',label:'Storage',icon:'▤'}]},
    {title:'SISTEMA',items:[{path:'security',label:'Segurança',icon:'◇'},{path:'audit',label:'Auditoria',icon:'☷'},{path:'settings',label:'Configurações',icon:'⚙'}]}
  ];
  get analytical(){return ['overview','analytics','subscriptions','usage','videos','storage'].includes(this.section);}
  get title(){return this.groups.flatMap(group=>group.items).find(item=>item.path===this.section)?.label||'Admin';}
  get filterParams(){const {preset,...rest}=this.filter;return {...rest,preset};}
  constructor(){
    this.reportRequests.pipe(
      distinctUntilChanged((a,b)=>JSON.stringify(a)===JSON.stringify(b)),
      switchMap(filter=>{
        this.loading.set(true);this.error.set(false);
        return this.api.dashboard(filter).pipe(
          catchError(()=>{this.error.set(true);return EMPTY;}),
          finalize(()=>this.loading.set(false)));
      }),takeUntilDestroyed(this.destroy)
    ).subscribe(data=>{this.report.set(data);this.lastKey=JSON.stringify(this.filter);});
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params=>{
      this.section=params.get('section')||String(this.route.snapshot.data['section']||'overview');this.clientId=params.get('id');
      if(this.analytical)this.loadReport();
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params=>{
      const query:Record<string,string|null>={};
      ['from','to','timezone','granularity','comparison','preset'].forEach(key=>query[key]=params.get(key));
      this.filter=filterFromParams(query);if(this.analytical)this.loadReport();
    });
  }
  private loadReport(){const key=JSON.stringify(this.filter);if(key!==this.lastKey){this.reportRequests.next(this.filter);}}
  changeFilter(filter:AdminFilter){
    this.filter=filter;this.lastKey='';
    this.router.navigate([],{relativeTo:this.route,queryParams:this.filterParams,queryParamsHandling:'merge'});
  }
  logout(){this.logoutError.set(false);this.api.logout().subscribe({next:()=>this.router.navigateByUrl('/admin/login'),error:()=>this.logoutError.set(true)});}
}
