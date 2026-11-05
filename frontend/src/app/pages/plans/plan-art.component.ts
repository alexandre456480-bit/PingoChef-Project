import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

let nextArt = 0;
/** Small local vector sculptures: no canvas, network request or animation loop. */
@Component({
  selector: 'app-plan-art', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient [id]="id" x1="25" y1="12" x2="94" y2="104" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".23" stop-color="var(--sculpt-light,#b8ffed)"/><stop offset=".66" stop-color="var(--sculpt-color,#35e9be)"/><stop offset="1" stop-color="var(--sculpt-dark,#14705c)"/></linearGradient>
      <linearGradient [id]="id+'-side'" x1="30" y1="30" x2="90" y2="100" gradientUnits="userSpaceOnUse"><stop stop-color="var(--sculpt-color,#35e9be)"/><stop offset="1" stop-color="var(--sculpt-dark,#14705c)"/></linearGradient>
    </defs>
    <ellipse cx="61" cy="103" rx="31" ry="5" fill="var(--sculpt-color,#35e9be)" opacity=".16"/>
    <g [attr.fill]="'url(#'+id+'-side)'" transform="translate(3 7)"><path [attr.d]="shape"/></g>
    <path [attr.d]="shape" [attr.fill]="'url(#'+id+')'" stroke="var(--sculpt-light,#b8ffed)" stroke-width="1.2" stroke-linejoin="round"/>
    <g stroke="#fff" stroke-opacity=".65" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      @switch (kind) {
        @case ('FREE') { <path d="M31 47h58M42 68h12v22M68 65h13v14H68zM27 35l7-11h49"/> }
        @case ('BASIC') { <path d="m64 23-24 32h22M55 85l18-25"/> }
        @case ('MEDIUM') { <path d="M21 44h78M40 23l-8 21 28 46 28-46-8-21M32 44h56M60 23v67"/> }
        @case ('PRO') { <path d="m24 40 11 39h51l10-39M39 87h44M50 58l10-14 10 14"/><circle cx="60" cy="66" r="4" fill="#fff"/> }
        @case ('qr') { <g stroke="#17223c" stroke-width="5"><path d="M32 30h20v20H32zM68 30h20v20H68zM32 66h20v20H32zM68 67v9h10v10h10M88 64v8M65 87h5"/></g> }
        @case ('analytics') { <path d="M31 77V60h10v17M53 77V47h10v30M76 77V33h10v44M29 87h61M32 44l22-13 12 4 18-16"/> }
        @case ('video') { <path d="m52 42 24 17-24 17V42Z" fill="#fff" fill-opacity=".75"/><path d="M31 31h54M31 88h54"/> }
        @case ('palette') { <circle cx="43" cy="41" r="5"/><circle cx="63" cy="32" r="5"/><circle cx="82" cy="43" r="5"/><path d="M30 66c0 13 8 20 17 21"/> }
        @default { <path d="M60 28v42m-15-15 15 15 15-15M34 78v12h52V78"/> }
      }
    </g>
    <path d="M99 18v10m-5-5h10M17 71v6m-3-3h6" stroke="var(--sculpt-light,#b8ffed)" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  styles: [`:host{display:block;width:100%;height:100%}svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 5px 8px #0003)}`]
})
export class PlanArtComponent {
  @Input() kind = 'FREE';
  readonly id = `plan-sculpt-${nextArt++}`;
  get shape(): string {
    switch (this.kind) {
      case 'FREE': return 'M24 47h72v44a5 5 0 0 1-5 5H29a5 5 0 0 1-5-5V47ZM21 47l14-27h50l14 27c0 13-15 15-19 5-5 10-16 10-20 0-5 10-16 10-20 0-5 10-19 8-19-5Z';
      case 'BASIC': return 'm67 14-42 49h30l-7 36 48-55H65l2-30Z';
      case 'MEDIUM': return 'M18 43 37 18h46l19 25-42 53-42-53Z';
      case 'PRO': return 'm19 31 23 18 18-29 18 29 23-18-13 65H32L19 31Z';
      case 'qr': return 'M24 17h72v77H24V17Z';
      case 'analytics': return 'M23 17h74v77H23V17Z';
      case 'video': return 'M27 24h66v69H27V24Z';
      case 'palette': return 'M61 18c-26 0-44 17-44 40s20 40 41 40c14 0 18-9 11-17-7-9 0-15 11-14 23 2 26-20 14-33-8-9-19-16-33-16Z';
      default: return 'M28 17h49l18 18v60H28V17Z';
    }
  }
}
