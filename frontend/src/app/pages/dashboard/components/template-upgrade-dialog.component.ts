import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DialogFocusDirective } from '../../../components/dialog-focus.directive';

@Component({
  selector: 'app-template-upgrade-dialog', standalone: true, imports: [RouterLink, DialogFocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="upgrade-backdrop" (click)="close.emit()">
    <section role="dialog" aria-modal="true" aria-labelledby="upgrade-template-title" tabindex="-1" appDialogFocus (dialogEscape)="close.emit()" (click)="$event.stopPropagation()">
      <button type="button" class="close" aria-label="Fechar aviso de template" (click)="close.emit()"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <span class="emblem" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 6 4 4 5-7 5 7 4-4-2 13H5L3 6ZM5 22h14"/></svg></span>
      <span class="eyebrow">Seu cardápio merece esse destaque</span>
      <h2 id="upgrade-template-title">Dê vida ao seu<br/>template favorito.</h2>
      <p><strong>{{ templateName }}</strong> é um template temático. Com o <strong>Basic ou superior</strong>, você pode publicá-lo e dar ainda mais personalidade ao seu cardápio.</p>
      <div class="included"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Todos os templates simples e temáticos</div>
      <div class="preserved">Sua escolha e personalizações continuam disponíveis no preview. No Free, você pode publicar usando um template simples.</div>
      <a routerLink="/plans" class="primary">Conhecer os planos <span aria-hidden="true">→</span></a>
      <button type="button" class="secondary" (click)="close.emit()">Continuar personalizando</button>
    </section>
  </div>`,
  styles: [`:host{position:fixed;inset:0;z-index:1500;font-family:Inter,sans-serif}.upgrade-backdrop{display:grid;place-items:center;min-height:100%;padding:20px;box-sizing:border-box;background:#100b16b3;backdrop-filter:blur(8px)}section{position:relative;box-sizing:border-box;width:100%;max-width:470px;max-height:calc(100dvh - 40px);overflow:auto;padding:34px;border:1px solid var(--panel-border);border-radius:26px;background:var(--panel-surface);color:var(--panel-text);box-shadow:0 24px 80px #0004}.close{position:absolute;right:12px;top:12px;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:12px;background:var(--panel-fill);color:var(--panel-text-muted);cursor:pointer}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.emblem{display:grid;place-items:center;width:60px;height:60px;margin-bottom:24px;border:1px solid #eea04766;border-radius:20px;background:linear-gradient(135deg,#ffcb791f,#f47b2033);color:var(--panel-accent)}.emblem svg{width:30px;height:30px}.eyebrow{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--panel-text-muted);font-weight:650}h2{font:700 30px/1.15 Outfit,Inter,sans-serif;margin:10px 0 18px}p{font-size:13px;line-height:1.8;color:var(--panel-text-soft)}strong{color:var(--panel-text)}.included{display:flex;align-items:center;gap:9px;margin:20px 0;font-size:12px;font-weight:600}.included svg{color:var(--panel-success);flex-shrink:0}.preserved{padding:13px;margin-bottom:22px;border:1px solid var(--panel-border);border-radius:12px;background:var(--panel-fill);font-size:11px;line-height:1.7;color:var(--panel-text-muted)}.primary,.secondary{display:flex;align-items:center;justify-content:center;gap:12px;min-height:48px;border:0;border-radius:13px;font:600 13px Inter,sans-serif;text-decoration:none;box-sizing:border-box;width:100%;cursor:pointer}.primary{color:white;background:var(--panel-action)}:host .upgrade-backdrop a.primary{color:#fffaf0!important}:host .upgrade-backdrop a.primary:hover{background:var(--panel-action-hover)}.secondary{color:var(--panel-text-soft);background:transparent;margin-top:8px}:is(a,button):focus-visible{outline:3px solid var(--panel-accent);outline-offset:3px}@media(max-width:420px){section{padding:26px 22px}h2{font-size:27px}}`]
})
export class TemplateUpgradeDialogComponent {
  @Input() templateName = 'Este template';
  @Output() close = new EventEmitter<void>();
}
