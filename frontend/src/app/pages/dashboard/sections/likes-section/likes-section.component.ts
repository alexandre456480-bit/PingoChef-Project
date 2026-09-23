import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-likes-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="likes-container">
      <div class="likes-card clay-card" style="--i:0">
        <div class="likes-icon-wrap">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </div>
        <h2 class="likes-title">Engajamento & Likes</h2>
        <p class="likes-desc">As métricas de likes serão computadas conforme seus clientes interagirem com o cardápio.</p>
        <div class="likes-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Em breve
        </div>
      </div>
    </div>
  `,
  styles: [`
    .likes-container { display: flex; flex-direction: column; gap: 24px; }
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
    .likes-icon-wrap {
      width: 80px; height: 80px; border-radius: 50%;
      background: rgba(236, 72, 153, 0.08);
      color: #EC4899;
      display: flex; align-items: center; justify-content: center;
    }
    .likes-title { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 700; color: #FFF; margin: 0; }
    .likes-desc { font-size: 0.9rem; color: #71717A; max-width: 400px; line-height: 1.5; margin: 0; }
    .likes-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2);
      color: #EAB308; padding: 6px 14px; border-radius: 20px;
      font-size: 0.8rem; font-weight: 600;
    }
    @keyframes cardIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .clay-card { animation: none !important; } }
  `]
})
export class LikesSectionComponent {}
