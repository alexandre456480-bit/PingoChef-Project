import { ChangeDetectorRef, Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuTransferService, MenuImportPreview, menuTransferError } from '../../../../services/menu-transfer.service';
import { resolveMenuTemplate } from '../../../../constants/menu-templates';

@Component({
  selector: 'app-menu-transfer', standalone: true, imports: [FormsModule],
  templateUrl: './menu-transfer.component.html', styleUrl: './menu-transfer.component.css'
})
export class MenuTransferComponent {
  private readonly transfer = inject(MenuTransferService);
  private readonly cdr = inject(ChangeDetectorRef);
  @Output() busyChange = new EventEmitter<boolean>();
  busy = false;
  progress = 0;
  status = '';
  error = '';
  notice = '';
  preview: MenuImportPreview | null = null;
  catalog = true;
  confirmed = false;
  imported = false;
  templateName(key: string) { return resolveMenuTemplate({ templateKey: key }).name; }
  private report = (percent: number) => { this.progress = percent; this.cdr.markForCheck(); };
  private setBusy(value: boolean, status = '') { this.busy = value; this.status = status; this.progress = 0; this.busyChange.emit(value || this.imported); this.cdr.markForCheck(); }
  private filename(prefix: string) { return `${prefix}-${new Date().toISOString().slice(0, 10)}.pingochef.json`; }
  async exportMenu() {
    if (this.busy) return;
    this.error = ''; this.notice = ''; this.setBusy(true, 'Preparando exportação');
    try {
      const blob = await this.transfer.exportMenu(this.report);
      this.transfer.download(blob, this.filename('cardapio'));
      this.notice = 'Exportação concluída. Guarde o arquivo em um local seguro.';
    } catch (error) { this.error = menuTransferError(error); }
    finally { this.setBusy(false); }
  }
  async selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file || this.busy) return;
    this.error = ''; this.notice = ''; this.setBusy(true, 'Enviando e validando arquivo');
    try {
      if (this.preview) await this.transfer.discard(this.preview.id);
      this.preview = null; this.confirmed = false;
      this.preview = await this.transfer.prepareImport(file, this.report);
      this.catalog = this.preview.canReplaceCatalog;
      this.notice = 'Arquivo validado. Revise os dados abaixo antes de importar.';
    } catch (error) { this.error = menuTransferError(error); }
    finally { this.setBusy(false); }
  }
  async cancel() {
    if (this.busy || !this.preview) return;
    const id = this.preview.id; this.preview = null; this.confirmed = false;
    await this.transfer.discard(id);
  }
  async importMenu() {
    if (this.busy || !this.preview || !this.confirmed) return;
    this.error = ''; this.setBusy(true, 'Salvando cópia do cardápio atual');
    try {
      const backup = await this.transfer.exportMenu(this.report);
      this.transfer.download(backup, this.filename('backup-antes-da-importacao'));
      this.status = 'Aplicando importação'; this.progress = 100;
      await this.transfer.apply(this.preview.id, this.catalog);
      this.imported = true; this.preview = null;
      this.notice = 'Importação concluída. Recarregue o painel para trabalhar com o cardápio atualizado.';
    } catch (error) { this.error = menuTransferError(error); }
    finally { this.setBusy(false); }
  }
  reload() { window.location.reload(); }
}
