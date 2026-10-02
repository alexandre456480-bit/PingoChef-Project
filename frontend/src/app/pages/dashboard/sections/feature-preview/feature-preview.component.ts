import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommercialService } from '../../../../services/commercial.service';
@Component({
  selector: 'app-feature-preview',
  standalone: true,
  imports: [RouterLink],
  template: ` <section
    class="feature-card"
    [class.animate-demo]="animate"
    aria-labelledby="feature-title"
  >
    <span class="feature-label">{{
      available ? 'Incluído no seu plano · em preparação' : 'Conheça este recurso'
    }}</span>
    <div class="demo" aria-label="Demonstração conceitual com dados ilustrativos">
      @if (feature === 'analytics') {
        <div class="demo-heading">
          <span>Visualizações</span><strong>1.284</strong><small>Exemplo ilustrativo</small>
        </div>
        <svg
          class="chart"
          viewBox="0 0 360 115"
          role="img"
          aria-label="Exemplo de gráfico de visualizações"
        >
          <path class="grid" d="M0 25H360M0 65H360M0 105H360" />
          <path class="line" d="M5 100L48 84L88 91L130 57L175 63L218 39L260 49L303 17L355 10" />
        </svg>
        <div class="sample-metrics">
          <span>Produto mais visto<strong>Hambúrguer da casa</strong></span
          ><span>Horário de maior interesse<strong>19h às 21h</strong></span>
        </div>
      } @else {
        <div class="qr-layout">
          <div class="concept-qr" aria-label="Mockup ilustrativo; não é um QR Code utilizável">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path
                d="M8 8h25v25H8zM67 8h25v25H67zM8 67h25v25H8z"
                fill="none"
                stroke="currentColor"
                stroke-width="6"
              />
              <path
                d="M15 15h11v11H15zM74 15h11v11H74zM15 74h11v11H15zM45 8h9v14h-9zM43 30h12v9H43zM70 46h22v9H70zM42 70h10v22H42zM64 68h9v12h-9zM82 73h10v19H82zM8 45h22v9H8zM62 85h12v7H62z"
                fill="currentColor"
              /></svg
            ><img src="/logo_img.webp" alt="Logo no mockup" />
          </div>
          <div>
            <strong>Seu cardápio, em cada mesa.</strong>
            <p>Cores, identidade e materiais do seu negócio.</p>
            <div class="swatches" aria-hidden="true"><i></i><i></i><i></i></div>
          </div>
        </div>
      }
    </div>
    <h1 id="feature-title">
      {{
        feature === 'analytics'
          ? 'Entenda como seus clientes interagem com seu cardápio.'
          : 'Leve seu cardápio para qualquer lugar.'
      }}
    </h1>
    @if (available) {
      <p>
        Este recurso está incluído no seu plano. A ferramenta real será disponibilizada em uma
        próxima etapa. Esta tela é uma apresentação conceitual.
      </p>
    } @else {
      <p>
        {{
          feature === 'analytics'
            ? 'Disponível a partir do Basic.'
            : 'Disponível a partir do Medium.'
        }}
      </p>
      <a class="button" routerLink="/plans">Comparar planos</a>
    }
    <p class="fine">
      Demonstração ilustrativa. Os valores e o código acima não representam dados ou recursos
      ativos.
    </p>
  </section>`,
  styles: [
    `
      :host {
        display: block;
      }
      .feature-card {
        max-width: 800px;
        margin: 12px auto;
        padding: clamp(22px, 4vw, 40px);
        background: var(--pc-surface, #fff9f4);
        color: var(--pc-text, #2d1b2e);
        border: 1px solid var(--pc-border, #ddcccf);
        border-radius: 24px;
        box-shadow: 0 10px 26px #2c102414;
      }
      .feature-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--pc-link, #691525);
      }
      .demo {
        margin: 24px 0;
        padding: 24px;
        background: var(--pc-track, #f1e4dc);
        border: 1px solid var(--pc-border, #ddcccf);
        border-radius: 20px;
      }
      .demo-heading {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        font-size: 14px;
      }
      .demo-heading strong {
        font:
          700 32px Outfit,
          sans-serif;
      }
      .demo-heading small {
        color: var(--pc-muted, #725f68);
      }
      .chart {
        width: 100%;
        height: 130px;
        margin: 14px 0;
      }
      .grid {
        stroke: var(--pc-border, #ddcccf);
        stroke-width: 1;
        fill: none;
      }
      .line {
        stroke: #f47b20;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
      }
      .sample-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        font-size: 13px;
        color: var(--pc-muted, #725f68);
      }
      .sample-metrics strong {
        display: block;
        color: var(--pc-text, #2d1b2e);
        margin-top: 8px;
        font-size: 14px;
      }
      .qr-layout {
        display: flex;
        gap: 24px;
        align-items: center;
      }
      .concept-qr {
        position: relative;
        background: #fff9f4;
        color: #691525;
        padding: 12px;
        border-radius: 18px;
        width: 170px;
        flex-shrink: 0;
      }
      .concept-qr svg {
        width: 100%;
        display: block;
      }
      .concept-qr img {
        position: absolute;
        width: 36px;
        height: 36px;
        object-fit: contain;
        background: #fff9f4;
        left: calc(50% - 18px);
        top: calc(50% - 18px);
        border-radius: 8px;
      }
      .swatches {
        display: flex;
        gap: 8px;
      }
      .swatches i {
        width: 22px;
        height: 22px;
        border: 1px solid #8a2338;
        border-radius: 50%;
        background: #691525;
      }
      .swatches i:nth-child(2) {
        background: #f47b20;
      }
      .swatches i:nth-child(3) {
        background: #f7eee7;
      }
      h1 {
        font:
          700 clamp(24px, 3vw, 32px) Outfit,
          sans-serif;
        line-height: 1.25;
      }
      p {
        font:
          15px/1.65 Inter,
          sans-serif;
        color: var(--pc-muted, #725f68);
        margin: 16px 0;
      }
      .fine {
        font-size: 12px;
      }
      .button {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        padding: 12px 20px;
        border-radius: 14px;
        background: #f47b20;
        color: #2c1024;
        border: 1px solid #e96b12;
        text-decoration: none;
        font:
          600 15px Inter,
          sans-serif;
        transition: transform 160ms;
      }
      .button:hover {
        transform: translateY(-1px);
      }
      .animate-demo .line {
        animation: chart-reveal 2400ms ease-out both;
      }
      .animate-demo .sample-metrics {
        animation: metric-in 2400ms ease-out both;
      }
      .animate-demo .concept-qr {
        animation: qr-in 2400ms ease-out both;
      }
      @keyframes chart-reveal {
        from {
          opacity: 0.3;
          transform: scaleY(0.2);
        }
        to {
          opacity: 1;
          transform: scaleY(1);
        }
      }
      @keyframes metric-in {
        0%,
        40% {
          opacity: 0;
          transform: translateY(6px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes qr-in {
        0% {
          opacity: 0;
          transform: scale(0.9);
        }
        55%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
      :focus-visible {
        outline: 3px solid #f47b2080;
        outline-offset: 3px;
      }
      @media (max-width: 600px) {
        .qr-layout {
          flex-direction: column;
          align-items: flex-start;
        }
        .sample-metrics {
          grid-template-columns: 1fr;
        }
        .demo {
          padding: 18px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation: none !important;
          transition: none !important;
        }
      }
    `,
  ],
})
export class FeaturePreviewComponent implements OnChanges {
  @Input() feature: 'analytics' | 'qr' = 'analytics';
  animate = false;
  constructor(public commercial: CommercialService) {}
  get available() {
    return this.feature === 'analytics' ? this.commercial.analytics() : this.commercial.qr();
  }
  ngOnChanges() {
    this.animate = !this.available && !this.commercial.seenDemos.has(this.feature);
    this.commercial.seenDemos.add(this.feature);
  }
}
