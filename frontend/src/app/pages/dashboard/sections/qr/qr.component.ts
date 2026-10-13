import { afterNextRender, Component, computed, ElementRef, inject, Injector, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogFocusDirective } from '../../../../components/dialog-focus.directive';
import { Subject, finalize, takeUntil } from 'rxjs';
import { OwnerQr, OwnerQrList, QrConfiguration, QrService } from '../../../../services/qr.service';
import { QrLogoEditorComponent } from './qr-logo-editor.component';
import { validateQrLogoFile } from './qr-logo-file';

const defaults = (): QrConfiguration => ({
  color: '#2C1024',
  frame: 'card',
  caption: 'Acesse nosso cardápio',
  logoPng: null,
});
@Component({
  selector: 'app-owner-qr',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogFocusDirective, QrLogoEditorComponent],
  templateUrl: './qr.component.html',
  styleUrl: './qr.component.css',
})
export class QrComponent implements OnInit, OnDestroy {
  private service = inject(QrService);
  private injector = inject(Injector);
  @ViewChild('logoInput') private logoInput?: ElementRef<HTMLInputElement>;
  private destroyed = new Subject<void>();
  private imageCancelled = new Subject<void>();
  data = signal<OwnerQrList | null>(null);
  selected = signal<OwnerQr | null>(null);
  deleting = signal<OwnerQr | null>(null);
  name = signal('QR Principal');
  config = signal(defaults());
  active = signal(true);
  loading = signal(true);
  busy = signal(false);
  rendering = signal(false);
  error = signal('');
  notice = signal('');
  imageUrl = signal('');
  logoFile = signal<File | null>(null);
  dirty = computed(() => {
    const row = this.selected();
    return (
      !row ||
      row.name !== this.name().trim() ||
      JSON.stringify(row.configuration) !== JSON.stringify(this.config()) ||
      (row.status === 'ACTIVE') !== this.active()
    );
  });
  valid = computed(
    () =>
      !!this.name().trim() &&
      this.name().trim().length <= 120 &&
      !/[<>\x00-\x1f\x7f]/.test(this.name() + this.config().caption) &&
      this.config().caption.length <= 40 &&
      /^[\u0020-\u007e\u00a0-\u017f\u2013\u2014\u2018\u2019\u201c\u201d]*$/.test(
        this.config().caption,
      ) &&
      /^#[a-fA-F0-9]{6}$/.test(this.config().color),
  );
  ngOnInit() {
    this.load();
  }
  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
    this.imageCancelled.next();
    this.imageCancelled.complete();
    this.clearImage();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.service
      .list()
      .pipe(
        takeUntil(this.destroyed),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (data) => {
          this.data.set(data);
          if (data.rows.length) this.select(data.rows[0].id);
          else this.newCode();
        },
        error: (e) => this.fail(e),
      });
  }
  select(id: string) {
    const row = this.data()?.rows.find((r) => r.id === id);
    if (!row) return;
    this.selected.set(row);
    this.name.set(row.name);
    this.config.set({ ...row.configuration });
    this.active.set(row.status === 'ACTIVE');
    this.error.set('');
    this.notice.set('');
    this.preview();
  }
  newCode() {
    this.imageCancelled.next();
    this.rendering.set(false);
    this.clearImage();
    this.selected.set(null);
    this.name.set('Novo QR Code');
    this.config.set(defaults());
    this.active.set(true);
    this.error.set('');
    this.notice.set('');
  }
  edit<K extends keyof QrConfiguration>(key: K, value: QrConfiguration[K]) {
    this.config.update((c) => ({ ...c, [key]: value }));
  }
  cancelDelete() {
    if (!this.busy()) this.deleting.set(null);
  }
  remove() {
    const row = this.deleting();
    if (!row || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.service
      .remove(row)
      .pipe(
        takeUntil(this.destroyed),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.deleting.set(null);
          this.data.update((data) =>
            data ? { ...data, rows: data.rows.filter((r) => r.id !== row.id) } : data,
          );
          this.newCode();
          const next = this.data()?.rows[0];
          if (next) this.select(next.id);
          this.notice.set('QR Code excluído. Seu link foi desativado e uma vaga está disponível.');
        },
        error: (e) => {
          this.deleting.set(null);
          this.fail(e);
        },
      });
  }
  logo(event: Event) {
    const input = event.target as HTMLInputElement;
    this.chooseLogo(input.files?.[0]);
    input.value = '';
  }
  dropLogo(event: DragEvent) {
    event.preventDefault();
    this.chooseLogo(event.dataTransfer?.files[0]);
  }
  private chooseLogo(file?: File) {
    if (!file || this.busy() || !this.data()?.customization) return;
    try {
      validateQrLogoFile(file);
      this.error.set('');
      this.logoFile.set(file);
    } catch (error) { this.error.set((error as Error).message); }
  }
  applyLogo(logo: string) {
    this.edit('logoPng', logo);
    this.closeLogo();
    this.notice.set('Logo ajustado. Gere ou atualize o QR Code para salvar a imagem.');
  }
  closeLogo() {
    this.logoFile.set(null);
    afterNextRender(() => this.logoInput?.nativeElement.focus(), { injector: this.injector });
  }
  save() {
    if (!this.valid() || this.busy() || this.logoFile()) return;
    const row = this.selected();
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const request = row
      ? this.service.update(row, this.name().trim(), this.config(), this.active())
      : this.service.create(this.name().trim(), this.config());
    request
      .pipe(
        takeUntil(this.destroyed),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.data.update((data) =>
            data
              ? {
                  ...data,
                  rows: row
                    ? data.rows.map((r) => (r.id === saved.id ? saved : r))
                    : [...data.rows, saved],
                }
              : data,
          );
          this.select(saved.id);
          this.notice.set(
            row
              ? 'QR Code atualizado. O endereço permanece o mesmo.'
              : 'QR Code gerado com sucesso.',
          );
        },
        error: (e) => this.fail(e),
      });
  }
  preview() {
    const row = this.selected();
    if (!row) return;
    this.imageCancelled.next();
    this.clearImage();
    this.rendering.set(true);
    this.service
      .image(row.id)
      .pipe(
        takeUntil(this.destroyed),
        takeUntil(this.imageCancelled),
        finalize(() => this.rendering.set(false)),
      )
      .subscribe({
        next: (blob) => this.imageUrl.set(URL.createObjectURL(blob)),
        error: (e) => this.fail(e),
      });
  }
  download(format: 'png' | 'svg') {
    const row = this.selected();
    if (!row || this.busy() || this.dirty()) return;
    this.busy.set(true);
    this.error.set('');
    this.service
      .image(row.id, format)
      .pipe(
        takeUntil(this.destroyed),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob),
            anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `pingochef-qr-${row.id}.${format}`;
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.notice.set(
            `Arquivo ${format.toUpperCase()} pronto. Teste a leitura antes de imprimir.`,
          );
        },
        error: (e) => this.fail(e),
      });
  }
  private clearImage() {
    if (this.imageUrl()) URL.revokeObjectURL(this.imageUrl());
    this.imageUrl.set('');
  }
  private async fail(e: any) {
    let code = e?.error?.error?.code;
    if (e?.error instanceof Blob && e.error.size <= 8192 && e.error.type.includes('json')) {
      try {
        code = JSON.parse(await e.error.text())?.error?.code;
      } catch {
        /* Keep the bounded generic message. */
      }
    }
    const messages: Record<string, string> = {
      QR_NOT_ENTITLED: 'QR Code está disponível nos planos Medium e Pro.',
      QR_VERSION_CONFLICT:
        'Este QR foi alterado em outra sessão. Recarregue a lista antes de atualizar.',
      QR_CAPACITY_REACHED: 'Você atingiu o limite de QR Codes deste estabelecimento.',
      QR_INVALID_LOGO:
        'Não foi possível usar o logo PNG ajustado. Escolha outro arquivo e tente novamente.',
      QR_CUSTOMIZATION_NOT_ENTITLED: 'A personalização não está incluída no seu plano.',
      SHARED_RATE_LIMITED: 'Muitas solicitações. Aguarde um minuto e tente novamente.',
    };
    this.error.set(
      messages[code] ||
        (e.status === 429
          ? 'Aguarde um minuto antes de tentar novamente.'
          : e.status === 403
            ? 'Seu plano não autoriza esta operação. Atualize a página para consultar os recursos atuais.'
            : 'Não foi possível concluir. Confira sua conexão e tente novamente.'),
    );
  }
}
