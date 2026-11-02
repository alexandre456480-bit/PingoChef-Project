import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SOCIAL_PLATFORMS,
  SocialLink,
  SocialPlatform,
  socialLabel,
  validSocialUrl,
} from '../../models/social-links';
import { SocialIconComponent } from '../social-icon/social-icon.component';

@Component({
  selector: 'app-social-links-editor',
  standalone: true,
  imports: [FormsModule, SocialIconComponent],
  template: `
    <section aria-labelledby="social-links-title">
      <h3 id="social-links-title">Redes Sociais <span>Opcional</span></h3>
      <p>Adicione suas redes e canais de pedido ao menu do cardápio.</p>
      <div class="entry">
        <div class="chooser">
          <button
            #chooseButton
            type="button"
            class="choose"
            [attr.aria-expanded]="choosing"
            aria-controls="social-choices"
            (click)="choosing = !choosing"
          >
            @if (platform) {
              <app-social-icon [platform]="platform" />
            }
            {{ selectedLabel || 'Escolher' }}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          @if (choosing) {
            <div id="social-choices" class="choices">
              @for (choice of platforms; track choice.key) {
                <button
                  type="button"
                  (click)="select(choice.key)"
                  [disabled]="choice.key !== 'other' && alreadyAdded(choice.key)"
                >
                  <app-social-icon [platform]="choice.key" /> {{ choice.label }}
                  @if (choice.key !== 'other' && alreadyAdded(choice.key)) {
                    <small>Adicionada</small>
                  }
                </button>
              }
            </div>
          }
        </div>
        <input
          type="url"
          aria-label="Link da rede social"
          placeholder="https://..."
          maxlength="2048"
          [(ngModel)]="url"
          [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="error = ''"
        />
        <button type="button" class="add" (click)="add()" [disabled]="links.length >= 10">
          Adicionar
        </button>
      </div>
      @if (platform === 'other') {
        <input
          class="custom-label"
          type="text"
          aria-label="Nome do link"
          placeholder="Nome do link (ex.: Site da empresa)"
          maxlength="40"
          [(ngModel)]="label"
          [ngModelOptions]="{ standalone: true }"
        />
      }
      @if (error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <ul>
        @for (link of links; track $index) {
          <li>
            <app-social-icon [platform]="link.platform" />
            <div>
              <strong>{{ labelFor(link) }}</strong
              ><span class="address">{{ link.url }}</span>
            </div>
            <button
              type="button"
              class="remove"
              [attr.aria-label]="'Remover ' + labelFor(link)"
              (click)="remove($index)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          </li>
        }
      </ul>
      <p class="hint">
        {{ links.length }}/10 links · Clique em Salvar para confirmar as alterações.
      </p>
    </section>
  `,
  styleUrl: './social-links-editor.component.css',
})
export class SocialLinksEditorComponent {
  @Input() links: SocialLink[] = [];
  @Output() linksChange = new EventEmitter<SocialLink[]>();
  @ViewChild('chooseButton') chooseButton?: ElementRef<HTMLButtonElement>;
  readonly platforms = SOCIAL_PLATFORMS;
  readonly labelFor = socialLabel;
  platform: SocialPlatform | null = null;
  url = '';
  label = '';
  error = '';
  choosing = false;
  get selectedLabel(): string {
    return this.platforms.find((choice) => choice.key === this.platform)?.label || '';
  }
  alreadyAdded(platform: SocialPlatform): boolean {
    return this.links.some((link) => link.platform === platform);
  }
  constructor(private element: ElementRef<HTMLElement>) {}
  @HostListener('document:click', ['$event']) closeOutside(event: Event): void {
    if (
      this.choosing &&
      !this.element.nativeElement.querySelector('.chooser')?.contains(event.target as Node)
    )
      this.choosing = false;
  }
  @HostListener('keydown.escape') closeChoices(): void {
    if (this.choosing) {
      this.choosing = false;
      this.chooseButton?.nativeElement.focus();
    }
  }
  select(platform: SocialPlatform): void {
    this.platform = platform;
    this.choosing = false;
    this.error = '';
    this.chooseButton?.nativeElement.focus();
  }
  add(): void {
    const url = this.url.trim();
    if (!this.platform) {
      this.error = 'Escolha uma rede social.';
      return;
    }
    if (!validSocialUrl(this.platform, url)) {
      this.error = 'Informe um link HTTPS válido da rede escolhida, sem usuário ou senha.';
      return;
    }
    if (this.links.length >= 10) {
      this.error = 'O limite é de 10 links.';
      return;
    }
    if (
      this.links.some((link) =>
        this.platform === 'other' ? link.url === url : link.platform === this.platform,
      )
    ) {
      this.error = 'Esta rede social ou link já foi adicionado.';
      return;
    }
    const label = this.label.trim();
    if (this.platform === 'other' && (!label || /[<>\x00-\x1f\x7f]/.test(label))) {
      this.error = 'Informe um nome válido para o link.';
      return;
    }
    this.linksChange.emit([
      ...this.links,
      { platform: this.platform, url, ...(this.platform === 'other' ? { label } : {}) },
    ]);
    this.platform = null;
    this.url = '';
    this.label = '';
    this.error = '';
  }
  remove(index: number): void {
    this.linksChange.emit(this.links.filter((_, position) => position !== index));
  }
}
