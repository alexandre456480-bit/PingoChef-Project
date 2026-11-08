import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-shell', standalone: true, imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush, styleUrl: './auth-shell.css',
  template: `<div class="access-page"><div class="access-card">
    <aside class="access-story" aria-label="Bem-vindo ao PingoChef">
      <span class="story-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M8 14c-5-5 2-13 7-8 3 3 1 6-1 8v2H9v-2Z"/></svg>Seu negócio. Seu jeito.</span>
      <h2>{{ signup ? 'Uma boa ideia merece um ótimo cardápio.' : 'Seu cardápio bem cuidado, todos os dias.' }}</h2>
      <p>Mais personalidade para sua marca. Mais praticidade para quem escolhe o que pedir.</p>
      <img class="story-mascot" src="/pingo-chef-login.webp" alt="PingoChef trabalhando na organização do cardápio" width="1350" height="1165" fetchpriority="high" />
      <span class="story-footer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z"/><path d="m8 12 3 3 5-6"/></svg>Feito para facilitar o seu dia.</span>
    </aside>
    <main class="access-content"><a routerLink="/plans" class="access-brand" aria-label="PingoChef — ver planos"><img src="/pingo-chef-logo-principal.webp" alt="PingoChef" width="108" height="108" /></a><ng-content /></main>
  </div><footer class="access-footer">PingoChef <span>·</span> Cardápio digital com personalidade.<a routerLink="/privacy">Privacidade</a></footer></div>`
})
export class AuthShellComponent { @Input() signup = false; }
