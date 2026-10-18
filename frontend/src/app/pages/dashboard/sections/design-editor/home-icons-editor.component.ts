import { Component, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DesignService } from '../../../../services/design.service';
import { ICON_CATALOG, ICON_GROUPS, CatalogIcon, findCatalogIcon } from '../../../../constants/icon-catalog';
import { EMOJI_GROUPS, EmojiRecord, emojiEntries } from '../../../../constants/emoji-catalog';
import { HOME_ICON_SECTIONS, HomeIconChoice } from '../../../../constants/home-icons';
import { MenuHomeIconComponent } from '../../../../components/menu-home-icon/menu-home-icon.component';
import { DialogFocusDirective } from '../../../../components/dialog-focus.directive';

@Component({
  selector: 'app-home-icons-editor', standalone: true,
  imports: [FormsModule, MenuHomeIconComponent, DialogFocusDirective],
  templateUrl: './home-icons-editor.component.html', styleUrl: './home-icons-editor.component.css',
})
export class HomeIconsEditorComponent {
  @ViewChild('picker') set picker(element: ElementRef<HTMLDialogElement> | undefined) {
    if (element) queueMicrotask(() => {
      if (element.nativeElement.isConnected && !element.nativeElement.open) element.nativeElement.showModal();
    });
  }
  readonly design = inject(DesignService);
  private readonly http = inject(HttpClient);
  readonly sections = HOME_ICON_SECTIONS;
  readonly groups = [...ICON_GROUPS, 'Emojis'];
  readonly emojiGroups = EMOJI_GROUPS;
  readonly emojis = signal<CatalogIcon[]>([]);
  readonly emojiState = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  readonly emojiGroup = signal('all');
  readonly pageSize = signal(96);
  readonly editing = signal<typeof HOME_ICON_SECTIONS[number] | null>(null);
  readonly selected = signal<HomeIconChoice>(undefined);
  readonly query = signal('');
  readonly style = signal<'all' | '2d' | '3d' | 'emoji'>('all');
  readonly group = signal('all');
  readonly styles = [{ key: 'all', label: 'Todos' }, { key: '2d', label: '2D' }, { key: '3d', label: '3D' }, { key: 'emoji', label: 'Emojis' }] as const;
  readonly filtered = computed(() => {
    const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const terms = normalize(this.query().trim()).split(/\s+/).filter(Boolean);
    return [...ICON_CATALOG, ...this.emojis()].filter(icon =>
      (this.style() === 'all' || (icon.emoji ? this.style() === 'emoji' : icon.type === this.style())) &&
      (this.group() === 'all' || icon.group === this.group()) &&
      (this.emojiGroup() === 'all' || !icon.emoji || String(icon.emojiGroup) === this.emojiGroup()) &&
      terms.every(term => normalize([icon.name, ...icon.tags, icon.group, icon.emoji ?? ''].join(' ')).includes(term)));
  });
  readonly visible = computed(() => this.filtered().slice(0, this.pageSize()));
  loadEmojis() {
    if (this.emojiState() === 'loading' || this.emojiState() === 'loaded') return;
    this.emojiState.set('loading');
    this.http.get<EmojiRecord[]>('/assets/catalog/emojis-pt.json').subscribe({
      next: records => { this.emojis.set(emojiEntries(records)); this.emojiState.set('loaded'); },
      error: () => this.emojiState.set('error'),
    });
  }
  setStyle(style: typeof this.styles[number]['key']) {
    this.style.set(style); this.group.set('all'); this.emojiGroup.set('all'); this.pageSize.set(96);
  }
  clearFilters() {
    this.query.set(''); this.group.set('all'); this.style.set('all'); this.emojiGroup.set('all'); this.pageSize.set(96);
  }
  label(choice: HomeIconChoice): string {
    return choice === null ? 'Sem ícone' : choice === undefined ? 'Padrão do PingoChef' : findCatalogIcon(choice)?.name ?? 'Padrão do PingoChef';
  }
  open(section: typeof HOME_ICON_SECTIONS[number]) {
    this.selected.set(this.design.homeIcon(section.key)); this.clearFilters(); this.loadEmojis();
    this.editing.set(section);
  }
  apply() {
    const section = this.editing();
    if (section) this.design.setHomeIcon(section.key, this.selected());
    this.editing.set(null);
  }
  backdrop(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLDialogElement).getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
      this.editing.set(null);
  }
}
