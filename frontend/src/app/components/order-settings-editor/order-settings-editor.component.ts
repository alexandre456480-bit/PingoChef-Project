import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { defaultOrderSettings, ORDER_CHANNELS, OrderSettings, orderSettingsError } from '../../models/order-settings';
import { DesignService, contrastTextColor } from '../../services/design.service';

@Component({
  selector: 'app-order-settings-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section aria-labelledby="orders-title">
      <div class="heading">
        <span class="icon" aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 3h2l3 12h11l3-9H6M9 20h.01M18 20h.01" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <div><h3 id="orders-title">Pedidos</h3><p>Conecte o carrinho ao seu canal de atendimento.</p></div>
      </div>
      <label class="toggle">
        <input type="checkbox" [ngModel]="settings.enabled" (ngModelChange)="change({ enabled: $event })" [ngModelOptions]="{ standalone: true }" />
        <span>Permitir pedidos</span>
      </label>
      @if (settings.enabled) {
        <fieldset>
          <legend>Onde o cliente fará o pedido?</legend>
          <div class="channels">
            @for (channel of channels; track channel.key) {
              <label class="channel" [class.selected]="settings.channel === channel.key">
                <input type="radio" name="orderChannel" [value]="channel.key" [ngModel]="settings.channel"
                  (ngModelChange)="change({ channel: $event })" [ngModelOptions]="{ standalone: true }" />
                {{ channel.label }}
              </label>
            }
          </div>
        </fieldset>
        <div class="fields">
          <div>
            <label for="order-url">Link</label>
            <input id="order-url" type="url" maxlength="2048" [placeholder]="settings.channel === 'whatsapp' ? 'https://wa.me/5511999999999' : 'https://...'"
              [ngModel]="settings.url" (ngModelChange)="change({ url: $event })" [ngModelOptions]="{ standalone: true }"
              (blur)="touched = true" [attr.aria-invalid]="touched && error ? 'true' : null" aria-describedby="order-help order-error" />
          </div>
          <div>
            <label for="order-button-text">Texto do botão</label>
            <input id="order-button-text" type="text" maxlength="40" placeholder="Fazer pedido"
              [ngModel]="settings.button_text" (ngModelChange)="change({ button_text: $event })" [ngModelOptions]="{ standalone: true }" />
          </div>
        </div>
        <p id="order-help" class="hint">
          @if (settings.channel === 'whatsapp') {
            Use o número com DDI e DDD. O cliente revisa e envia no WhatsApp a mensagem com os itens do carrinho.
          } @else {
            O cliente finalizará no link informado. Os itens do carrinho não são transferidos para esse canal.
          }
        </p>
        <p id="order-error" class="error" aria-live="polite">{{ touched ? error : '' }}</p>
        <div class="preview" aria-label="Prévia do botão de pedido">
          <span>Botão no carrinho</span><span class="preview-button" [style.background]="buttonColor" [style.color]="buttonTextColor">{{ settings.button_text || 'Fazer pedido' }} <span aria-hidden="true">↗</span></span>
        </div>
        <p class="hint">O carrinho ficará disponível no cardápio. Salve para aplicar as alterações.</p>
      }
    </section>
  `,
  styleUrl: './order-settings-editor.component.css',
})
export class OrderSettingsEditorComponent {
  private readonly design = inject(DesignService);
  get buttonColor(): string { return this.design.currentPalette().colors.primary; }
  get buttonTextColor(): string { return contrastTextColor(this.buttonColor); }
  @Input() settings: OrderSettings = defaultOrderSettings();
  @Output() settingsChange = new EventEmitter<OrderSettings>();
  readonly channels = ORDER_CHANNELS;
  touched = false;
  get error(): string { return orderSettingsError(this.settings); }
  change(patch: Partial<OrderSettings>): void {
    this.settingsChange.emit({ ...this.settings, ...patch });
  }
}
