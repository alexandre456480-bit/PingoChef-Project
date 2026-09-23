import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer, switchMap } from 'rxjs';
import {
  ProductMediaView,
  VideoUploadService
} from '../../services/video-upload.service';
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_FILE_SIZE_BYTES,
  ValidatedVideoFile,
  validateVideoFile
} from './video-file-validation';

type UploadUiState =
  | 'selecting'
  | 'validating'
  | 'selected'
  | 'requesting'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'rejected'
  | 'error'
  | 'cancelling';

@Component({
  selector: 'app-product-video-uploader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="video-panel" aria-labelledby="video-panel-title">
      <div class="video-heading">
        <div class="video-heading-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m16 13 5 3-5 3v-6Z"/><rect x="3" y="5" width="13" height="14" rx="2"/>
          </svg>
        </div>
        <div>
          <h4 id="video-panel-title">Vídeo do produto</h4>
          <p>MP4, MOV ou WebM · até 15 segundos · máximo 50 MB</p>
        </div>
      </div>

      @if (!itemId) {
        <div class="video-locked" role="note">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect width="16" height="12" x="4" y="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>
          </svg>
          <div>
            <strong>Salve o produto primeiro</strong>
            <span>Depois de criar o produto, abra a edição para enviar o vídeo.</span>
          </div>
        </div>
      } @else {
        @if (state === 'selecting' || state === 'error' || state === 'rejected' || state === 'ready') {
          <button
            type="button"
            class="video-dropzone"
            [class.dragging]="dragging"
            [disabled]="hasPendingMedia"
            (click)="videoInput.click()"
            (dragenter)="onDragEnter($event)"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)">
            <input
              #videoInput
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              (change)="onFileInput($event)"
              hidden />
            <span class="drop-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </span>
            <strong>{{ hasPendingMedia ? 'Aguarde o vídeo atual' : 'Escolher vídeo' }}</strong>
            <span>{{ hasPendingMedia ? 'O processamento precisa terminar antes de outro envio.' : 'Clique ou arraste o arquivo até aqui.' }}</span>
          </button>
        }

        @if (state === 'validating') {
          <div class="state-card neutral" role="status" aria-live="polite">
            <span class="spinner" aria-hidden="true"></span>
            <div><strong>Validando o vídeo…</strong><span>Conferindo formato, tamanho e duração local.</span></div>
          </div>
        }

        @if (state === 'selected' && selectedVideo) {
          <div class="selected-file">
            <div class="file-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 13 5 3-5 3v-6Z"/><rect x="3" y="5" width="13" height="14" rx="2"/></svg>
            </div>
            <div class="file-copy">
              <strong>{{ selectedVideo.file.name }}</strong>
              <span>{{ formatBytes(selectedVideo.file.size) }} · {{ formatDuration(selectedVideo.durationSeconds) }}</span>
            </div>
            <button type="button" class="icon-button" (click)="clearSelection()" aria-label="Remover vídeo selecionado">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <button type="button" class="upload-button" (click)="startUpload()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>
            Enviar vídeo
          </button>
        }

        @if (state === 'requesting' || state === 'uploading' || state === 'cancelling') {
          <div class="upload-progress-card" role="status" aria-live="polite">
            <div class="progress-copy">
              <div>
                <strong>{{ state === 'requesting' ? 'Preparando envio…' : state === 'cancelling' ? 'Cancelando…' : 'Enviando vídeo… ' + uploadProgress + '%' }}</strong>
                <span>{{ state === 'uploading' ? 'Envio direto e seguro para o Mux.' : 'Aguarde um instante.' }}</span>
              </div>
              @if (state === 'uploading') {
                <button type="button" class="cancel-button" (click)="cancelUpload()">Cancelar</button>
              }
            </div>
            <div
              class="progress-track"
              role="progressbar"
              aria-label="Progresso do envio do vídeo"
              [attr.aria-valuenow]="uploadProgress"
              aria-valuemin="0"
              aria-valuemax="100">
              <span [style.width.%]="uploadProgress"></span>
            </div>
          </div>
        }

        @if (state === 'processing') {
          <div class="state-card mascot processing" role="status" aria-live="polite">
            <img src="/icons_chef_hat.webp" alt="" />
            <div><strong>Processando seu vídeo…</strong><span>O PingoChef está preparando tudo. Você pode salvar e voltar depois.</span></div>
          </div>
        }

        @if (state === 'ready') {
          <div class="state-card mascot success" role="status" aria-live="polite">
            <img src="/icons_chef_hat.webp" alt="" />
            <div><strong>Vídeo pronto</strong><span>O processamento terminou com sucesso.</span></div>
          </div>
        }

        @if ((state === 'error' || state === 'rejected') && errorMessage) {
          <div class="state-card mascot danger" role="alert">
            <img src="/icons_chef_hat.webp" alt="" />
            <div><strong>{{ state === 'rejected' ? 'Vídeo rejeitado' : 'Não foi possível enviar' }}</strong><span>{{ errorMessage }}</span></div>
          </div>
        }

        @if (loadingMedia) {
          <div class="media-skeleton" aria-label="Carregando vídeos"><span></span><span></span></div>
        } @else if (videoMedia.length > 0) {
          <div class="media-list" aria-label="Vídeos do produto">
            @for (media of videoMedia; track media.id) {
              <article class="media-row">
                <span class="media-status-icon" [attr.data-status]="media.status" aria-hidden="true">
                  @if (media.status === 'ready') {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
                  } @else if (media.status === 'rejected' || media.status === 'errored') {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="m10.3 2.9-8.9 15.4A2 2 0 0 0 3.1 21h17.8a2 2 0 0 0 1.7-2.7L13.7 2.9a2 2 0 0 0-3.4 0Z"/></svg>
                  } @else {
                    <span class="mini-spinner"></span>
                  }
                </span>
                <div class="media-copy">
                  <strong>{{ statusLabel(media.status) }}</strong>
                  <span>{{ media.durationSeconds !== null ? formatDuration(media.durationSeconds) : 'Duração sendo confirmada' }}</span>
                </div>
                <button
                  type="button"
                  class="delete-button"
                  [disabled]="deletingMediaId === media.id"
                  (click)="deleteMedia(media)"
                  [attr.aria-label]="'Excluir vídeo com status ' + statusLabel(media.status)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                </button>
              </article>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .video-panel {
      margin: 4px 0 18px;
      padding: 16px;
      border-radius: 16px;
      border: 1px solid rgba(244, 123, 32, 0.2);
      background: linear-gradient(145deg, rgba(244, 123, 32, 0.07), rgba(255, 255, 255, 0.025));
      font-family: 'Inter', sans-serif;
    }
    .video-heading { display: flex; align-items: center; gap: 11px; margin-bottom: 13px; }
    .video-heading-icon {
      width: 36px; height: 36px; border-radius: 11px; flex: 0 0 auto;
      display: grid; place-items: center; color: #F47B20;
      background: rgba(244, 123, 32, 0.13); border: 1px solid rgba(244, 123, 32, 0.22);
    }
    h4 { margin: 0; color: #F4F4F5; font: 700 0.95rem 'Outfit', sans-serif; }
    .video-heading p { margin: 3px 0 0; color: #71717A; font-size: 0.72rem; line-height: 1.4; }
    .video-locked, .state-card, .selected-file, .upload-progress-card {
      border-radius: 13px; border: 1px solid rgba(255,255,255,.07); background: rgba(10,10,12,.38);
    }
    .video-locked { display: flex; gap: 11px; align-items: center; padding: 13px; color: #A1A1AA; }
    .video-locked svg { color: #71717A; flex: 0 0 auto; }
    .video-locked div, .state-card div, .file-copy, .media-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .video-locked strong, .state-card strong, .file-copy strong, .media-copy strong { color: #E4E4E7; font-size: .8rem; }
    .video-locked span, .state-card span, .file-copy span, .media-copy span { color: #71717A; font-size: .7rem; line-height: 1.4; }
    .video-dropzone {
      width: 100%; min-height: 112px; padding: 16px; border-radius: 14px;
      border: 1.5px dashed rgba(255,255,255,.15); background: rgba(255,255,255,.018);
      color: #A1A1AA; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
      cursor: pointer; transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
      font-family: 'Inter', sans-serif;
    }
    .video-dropzone strong { color: #E4E4E7; font-size: .82rem; }
    .video-dropzone > span:last-child { font-size: .7rem; }
    .video-dropzone:focus-visible { outline: 3px solid rgba(244,123,32,.25); outline-offset: 2px; border-color: #F47B20; }
    .video-dropzone.dragging { border-color: #F47B20; background: rgba(244,123,32,.08); transform: translateY(-1px); }
    .video-dropzone:disabled { cursor: not-allowed; opacity: .58; }
    .drop-icon { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #F47B20; background: rgba(244,123,32,.1); margin-bottom: 3px; }
    .state-card { display: flex; align-items: center; gap: 12px; padding: 13px; }
    .state-card.processing { border-color: rgba(245,158,11,.25); background: rgba(245,158,11,.06); }
    .state-card.success { border-color: rgba(34,197,94,.25); background: rgba(34,197,94,.06); }
    .state-card.danger { border-color: rgba(239,68,68,.25); background: rgba(239,68,68,.06); }
    .state-card.mascot img { width: 42px; height: 42px; object-fit: contain; flex: 0 0 auto; filter: drop-shadow(0 4px 7px rgba(0,0,0,.35)); }
    .spinner, .mini-spinner { display: inline-block; border-radius: 50%; border: 2px solid rgba(244,123,32,.2); border-top-color: #F47B20; animation: spin .8s linear infinite; }
    .spinner { width: 22px; height: 22px; margin: 3px 8px; }
    .mini-spinner { width: 12px; height: 12px; }
    .selected-file { display: flex; align-items: center; gap: 11px; padding: 12px; }
    .file-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; color: #F47B20; background: rgba(244,123,32,.1); flex: 0 0 auto; }
    .file-copy { flex: 1; }
    .file-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .icon-button, .delete-button { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; cursor: pointer; }
    .icon-button { border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); color: #A1A1AA; }
    .upload-button {
      width: 100%; margin-top: 9px; min-height: 42px; border: 0; border-radius: 12px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px; color: white; font: 700 .82rem 'Outfit', sans-serif;
      background: linear-gradient(135deg, #F47B20, #D26E2D); box-shadow: 0 8px 20px rgba(244,123,32,.18);
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .upload-progress-card { padding: 13px; }
    .progress-copy { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 11px; }
    .progress-copy > div { display: flex; flex-direction: column; gap: 3px; }
    .progress-copy strong { color: #F4F4F5; font-size: .8rem; }
    .progress-copy span { color: #71717A; font-size: .69rem; }
    .cancel-button { border: 0; background: transparent; color: #F87171; font: 600 .72rem 'Inter', sans-serif; cursor: pointer; padding: 6px; }
    .progress-track { height: 7px; border-radius: 99px; background: rgba(255,255,255,.07); overflow: hidden; }
    .progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #D26E2D, #F47B20); transition: width 180ms ease-out; }
    .media-list { display: flex; flex-direction: column; gap: 7px; margin-top: 11px; }
    .media-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 11px; border: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.025); }
    .media-status-icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: #F59E0B; background: rgba(245,158,11,.1); flex: 0 0 auto; }
    .media-status-icon[data-status="ready"] { color: #22C55E; background: rgba(34,197,94,.1); }
    .media-status-icon[data-status="rejected"], .media-status-icon[data-status="errored"] { color: #EF4444; background: rgba(239,68,68,.1); }
    .media-copy { flex: 1; }
    .delete-button { border: 1px solid rgba(239,68,68,.16); background: rgba(239,68,68,.07); color: #F87171; }
    .delete-button:disabled { opacity: .4; cursor: wait; }
    .media-skeleton { display: flex; gap: 8px; margin-top: 11px; }
    .media-skeleton span { display: block; height: 48px; flex: 1; border-radius: 10px; background: linear-gradient(90deg, rgba(255,255,255,.03), rgba(255,255,255,.08), rgba(255,255,255,.03)); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer { to { background-position: -200% 0; } }
    @media (hover: hover) and (pointer: fine) {
      .video-dropzone:not(:disabled):hover { border-color: #F47B20; background: rgba(244,123,32,.055); transform: translateY(-1px); }
      .upload-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(244,123,32,.28); }
      .icon-button:hover { color: white; background: rgba(255,255,255,.08); }
      .delete-button:hover:not(:disabled) { background: rgba(239,68,68,.14); }
    }
    @media (prefers-reduced-motion: reduce) {
      .video-dropzone, .upload-button, .progress-track span { transition: none; }
      .spinner, .mini-spinner, .media-skeleton span { animation-duration: 1.8s; }
    }
  `]
})
export class ProductVideoUploaderComponent implements OnChanges, OnDestroy {
  @Input() itemId: string | null = null;
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() onToast = new EventEmitter<string>();
  @Output() mediaChanged = new EventEmitter<void>();

  readonly maxBytes = MAX_VIDEO_FILE_SIZE_BYTES;
  readonly maxDuration = MAX_VIDEO_DURATION_SECONDS;

  state: UploadUiState = 'selecting';
  uploadProgress = 0;
  selectedVideo: ValidatedVideoFile | null = null;
  videoMedia: ProductMediaView[] = [];
  loadingMedia = false;
  dragging = false;
  errorMessage = '';
  deletingMediaId: string | null = null;

  private activeMediaId: string | null = null;
  private intentSubscription?: Subscription;
  private directUploadSubscription?: Subscription;
  private pollingSubscription?: Subscription;
  private pollingRetryTimer?: number;
  private destroyed = false;

  constructor(private readonly videoService: VideoUploadService) {}

  get hasPendingMedia(): boolean {
    return this.videoMedia.some(media => ['waiting', 'uploading', 'processing'].includes(media.status));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itemId']) {
      this.stopRequests();
      this.resetSelection(false);
      this.videoMedia = [];
      if (this.itemId) this.loadMedia();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.pollingRetryTimer) window.clearTimeout(this.pollingRetryTimer);
    const shouldCompensate = ['requesting', 'uploading', 'cancelling'].includes(this.state);
    this.stopRequests();
    if (shouldCompensate && this.itemId && this.activeMediaId) {
      this.videoService.deleteProductMedia(this.itemId, this.activeMediaId).subscribe({ error: () => undefined });
    }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.selectFile(file);
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    if (!this.hasPendingMedia) this.dragging = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
    if (this.hasPendingMedia) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.selectFile(file);
  }

  async selectFile(file: File): Promise<void> {
    if (!this.itemId || this.hasPendingMedia) return;
    this.errorMessage = '';
    this.setState('validating');
    try {
      this.selectedVideo = await validateVideoFile(file);
      this.setState('selected');
    } catch (error) {
      this.selectedVideo = null;
      this.errorMessage = error instanceof Error ? error.message : 'Não foi possível validar o vídeo.';
      this.setState('error');
    }
  }

  startUpload(): void {
    if (!this.itemId || !this.selectedVideo || this.state !== 'selected') return;
    const selection = this.selectedVideo;
    this.uploadProgress = 0;
    this.setState('requesting');
    this.intentSubscription = this.videoService.createUploadIntent(
      this.itemId,
      selection.file.size,
      selection.mimeType
    ).subscribe({
      next: intent => {
        this.activeMediaId = intent.mediaId;
        this.setState('uploading');
        this.directUploadSubscription = this.videoService.uploadDirect(
          intent.uploadUrl,
          selection.file,
          selection.mimeType
        ).subscribe({
          next: event => {
            this.uploadProgress = event.progress;
            if (event.complete) {
              this.selectedVideo = null;
              this.setState('processing');
              this.loadMedia(true);
            }
          },
          error: () => this.handleUploadError('O envio foi interrompido. Verifique sua conexão e tente novamente.')
        });
      },
      error: error => this.handleUploadError(
        error?.error?.error?.message || 'Não foi possível iniciar o upload.'
      )
    });
  }

  cancelUpload(): void {
    if (!this.itemId || this.state !== 'uploading') return;
    this.setState('cancelling');
    this.directUploadSubscription?.unsubscribe();
    if (!this.activeMediaId) {
      this.resetSelection();
      return;
    }
    const mediaId = this.activeMediaId;
    this.videoService.deleteProductMedia(this.itemId, mediaId).subscribe({
      next: () => {
        this.onToast.emit('Envio de vídeo cancelado.');
        this.resetSelection();
        this.loadMedia();
      },
      error: () => {
        this.errorMessage = 'O envio foi interrompido e a limpeza continuará automaticamente.';
        this.setState('error');
        this.startPolling();
      }
    });
  }

  clearSelection(): void {
    this.resetSelection();
  }

  deleteMedia(media: ProductMediaView): void {
    if (!this.itemId || this.deletingMediaId || !confirm('Excluir este vídeo do produto?')) return;
    this.deletingMediaId = media.id;
    this.videoService.deleteProductMedia(this.itemId, media.id).subscribe({
      next: () => {
        this.deletingMediaId = null;
        if (this.activeMediaId === media.id) this.activeMediaId = null;
        this.onToast.emit('Vídeo removido.');
        this.mediaChanged.emit();
        this.loadMedia();
      },
      error: error => {
        this.deletingMediaId = null;
        this.onToast.emit(error?.error?.error?.message || 'A exclusão ficou pendente e será tentada novamente.');
        this.loadMedia();
      }
    });
  }

  statusLabel(status: ProductMediaView['status']): string {
    const labels: Record<ProductMediaView['status'], string> = {
      waiting: 'Aguardando envio',
      uploading: 'Enviando',
      processing: 'Processando',
      ready: 'Pronto',
      rejected: 'Rejeitado',
      errored: 'Erro no processamento',
      pending_deletion: 'Exclusão pendente'
    };
    return labels[status];
  }

  formatBytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  formatDuration(seconds: number): string {
    return `${seconds.toFixed(1).replace('.', ',')} s`;
  }

  private loadMedia(startPollingAfter = false): void {
    if (!this.itemId) return;
    this.loadingMedia = this.videoMedia.length === 0;
    this.videoService.listProductMedia(this.itemId).subscribe({
      next: media => {
        this.loadingMedia = false;
        this.applyMedia(media);
        if (startPollingAfter || this.hasPendingMedia) this.startPolling();
      },
      error: () => {
        this.loadingMedia = false;
        if (this.state === 'processing') this.startPolling();
      }
    });
  }

  private startPolling(): void {
    if (this.destroyed || !this.itemId || (this.pollingSubscription && !this.pollingSubscription.closed)) return;
    const itemId = this.itemId;
    this.pollingSubscription = timer(1200, 2500).pipe(
      switchMap(() => this.videoService.listProductMedia(itemId))
    ).subscribe({
      next: media => this.applyMedia(media),
      error: () => {
        this.pollingSubscription = undefined;
        this.pollingRetryTimer = window.setTimeout(() => this.startPolling(), 3000);
      }
    });
  }

  private applyMedia(media: ProductMediaView[]): void {
    this.videoMedia = media.filter(entry => entry.mediaType === 'video');
    const active = this.activeMediaId
      ? this.videoMedia.find(entry => entry.id === this.activeMediaId)
      : this.videoMedia.find(entry => ['waiting', 'uploading', 'processing'].includes(entry.status));

    if (active) {
      this.activeMediaId = active.id;
      if (['waiting', 'uploading', 'processing'].includes(active.status)) {
        this.setState('processing');
        return;
      }
      if (active.status === 'ready') {
        this.pollingSubscription?.unsubscribe();
        this.pollingSubscription = undefined;
        this.setState('ready');
        this.onToast.emit('Vídeo pronto para a próxima etapa!');
        this.mediaChanged.emit();
        return;
      }
      if (active.status === 'rejected') {
        this.errorMessage = active.errorCode === 'DURATION_LIMIT_EXCEEDED'
          ? 'A duração real ultrapassou 15 segundos. O asset foi removido com segurança.'
          : 'O vídeo não atende aos requisitos de processamento.';
        this.pollingSubscription?.unsubscribe();
        this.pollingSubscription = undefined;
        this.setState('rejected');
        return;
      }
      if (active.status === 'errored' || active.status === 'pending_deletion') {
        this.errorMessage = active.status === 'pending_deletion'
          ? 'A exclusão está pendente e será tentada novamente.'
          : 'O Mux não conseguiu processar este vídeo.';
        this.pollingSubscription?.unsubscribe();
        this.pollingSubscription = undefined;
        this.setState('error');
        return;
      }
    }

    if (!this.hasPendingMedia && this.state === 'processing') {
      this.pollingSubscription?.unsubscribe();
      this.pollingSubscription = undefined;
      this.setState('selecting');
    }
  }

  private handleUploadError(message: string): void {
    this.errorMessage = message;
    this.directUploadSubscription?.unsubscribe();
    this.setState('error');
    if (this.itemId && this.activeMediaId) {
      const mediaId = this.activeMediaId;
      this.videoService.deleteProductMedia(this.itemId, mediaId).subscribe({
        next: () => this.loadMedia(),
        error: () => undefined
      });
    }
  }

  private resetSelection(emitBusy = true): void {
    this.selectedVideo = null;
    this.activeMediaId = null;
    this.errorMessage = '';
    this.uploadProgress = 0;
    this.state = 'selecting';
    if (emitBusy) this.busyChange.emit(false);
  }

  private setState(state: UploadUiState): void {
    this.state = state;
    this.busyChange.emit(['validating', 'selected', 'requesting', 'uploading', 'cancelling'].includes(state));
  }

  private stopRequests(): void {
    this.intentSubscription?.unsubscribe();
    this.directUploadSubscription?.unsubscribe();
    this.pollingSubscription?.unsubscribe();
    if (this.pollingRetryTimer) window.clearTimeout(this.pollingRetryTimer);
    this.pollingRetryTimer = undefined;
    this.pollingSubscription = undefined;
  }
}
