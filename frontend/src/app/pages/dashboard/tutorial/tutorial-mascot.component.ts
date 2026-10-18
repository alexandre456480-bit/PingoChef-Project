import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-tutorial-mascot', standalone: true,
  template: `<img [src]="'/assets/mascots/tutorial/pingo-chef-tutorial-animation-' + pose + '.webp'"
    width="144" height="144" alt="PingoChef, seu guia pelo painel" draggable="false" />`,
  styles: [`:host{display:block;width:100%;height:100%}img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px #16071825);animation:idle 4s ease-in-out infinite}
    @keyframes idle{50%{transform:translateY(-3px) rotate(.5deg)}}
    @media(prefers-reduced-motion:reduce){img{animation:none}}`],
})
export class TutorialMascotComponent { @Input() pose: 1 | 2 | 3 | 4 = 1; }
