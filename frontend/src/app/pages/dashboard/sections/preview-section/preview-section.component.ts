import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-preview-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-container">
      <div class="preview-card clay-card" style="--i:0">
        <div class="preview-icon-wrap">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h2 class="preview-title">Visualização do Rascunho</h2>
        <p class="preview-desc">Veja ao lado como o cardápio está ficando em tempo real. Use o preview do celular para verificar antes de publicar.</p>
        <div class="preview-actions">
          <button class="btn-publish" (click)="onPublish.emit()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            Publicar Cardápio
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .preview-container { display: flex; flex-direction: column; gap: 24px; }
    .clay-card {
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 22px;
      padding: 48px 32px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      box-shadow: 6px 6px 14px rgba(0,0,0,0.35), -3px -3px 10px rgba(255,255,255,0.02), inset 1px 1px 2px rgba(255,255,255,0.04);
      animation: cardIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .preview-icon-wrap {
      width: 80px; height: 80px; border-radius: 50%;
      background: rgba(244, 123, 32, 0.08);
      color: #F47B20;
      display: flex; align-items: center; justify-content: center;
    }
    .preview-title { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 700; color: #FFF; margin: 0; }
    .preview-desc { font-size: 0.9rem; color: #71717A; max-width: 420px; line-height: 1.5; margin: 0; }
    .btn-publish {
      display: inline-flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #F47B20, #D26E2D); border: none; color: #FFF;
      padding: 14px 28px; border-radius: 14px; font-family: 'Inter', sans-serif;
      font-size: 0.95rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 6px 20px rgba(244, 123, 32, 0.35); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-publish:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(244, 123, 32, 0.5); }
    @keyframes cardIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .clay-card { animation: none !important; } }
  `]
})
export class PreviewSectionComponent {
  @Output() onPublish = new EventEmitter<void>();
}
