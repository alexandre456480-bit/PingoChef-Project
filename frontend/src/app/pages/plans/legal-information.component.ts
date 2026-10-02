import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({
  selector: 'app-legal-information',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './commercial.css',
  template: ` <div class="commercial-page">
    <nav class="commercial-nav">
      <a routerLink="/plans"><img src="/pingo_chef_logo_principal.webp" alt="PingoChef" /></a
      ><a routerLink="/plans">Voltar aos planos</a>
    </nav>
    <main class="center-card">
      <span class="eyebrow">Versão preliminar · outubro de 2026</span>
      <h1>{{ privacy ? 'Informações de privacidade' : 'Termos de uso' }}</h1>
      <p class="notice">
        Esta versão descreve a etapa atual do PingoChef e precisa de revisão antes do lançamento
        comercial dos planos pagos.
      </p>
      @if (privacy) {
        <h2>Dados usados pelo serviço</h2>
        <p>
          O cadastro utiliza nome, e-mail, senha e dados do estabelecimento. O cardápio pode incluir
          textos, imagens, vídeos e informações comerciais que você decidir publicar.
        </p>
        <h2>Autenticação e infraestrutura</h2>
        <p>
          A autenticação e o banco utilizam Supabase. As senhas são tratadas pelo serviço de
          autenticação. O navegador recebe um cookie de sessão protegido; os tokens de acesso e
          atualização ficam no backend. O Mux processa os vídeos enviados. Registros técnicos e
          limites de tentativas ajudam a proteger as contas.
        </p>
        <h2>Conteúdo público e exclusão</h2>
        <p>
          Os dados incluídos no cardápio publicado são acessíveis aos visitantes. A exclusão da
          conta retira o cardápio do ar e agenda a limpeza de dados e mídias após 30 dias pelo
          processo do sistema.
        </p>
        <h2>Estatísticas do cardápio</h2>
        <p>
          O cardápio registra acessos, abertura de categorias e produtos, curtidas confirmadas e
          reprodução de vídeos. Uma identificação aleatória é mantida na sessão do navegador;
          não usamos fingerprinting. O servidor transforma essa identificação em hash próprio
          do estabelecimento e usa hash temporário do IP para limitar abuso. URLs de referência,
          IP bruto, e-mail e dados de conta do consumidor não integram esses eventos.
        </p>
        <p>
          Eventos detalhados são mantidos por 90 dias por padrão. Contadores agregados e presença
          anônima diária para contar sessões únicas têm retenção configurável, inicialmente de
          até 3.650 dias. A coleta do navegador respeita Do Not Track e Global Privacy Control;
          curtidas confirmadas continuam sendo contabilizadas pelo servidor. Mídias continuam
          sendo processadas pelos serviços de infraestrutura mencionados acima.
        </p>
        <h2>Contato</h2>
        <p>
          Para dúvidas sobre dados ou solicitação de exclusão, contate
          <a href="mailto:pingochef@gmail.com">pingochef&#64;gmail.com</a>.
        </p>
      } @else {
        <h2>Etapa atual</h2>
        <p>
          O cadastro público está disponível apenas no Free, com até 10 produtos, 4 categorias e 1
          vídeo. Os preços exibidos para Basic, Medium e Pro são provisórios; não há contratação ou
          cobrança nesta etapa.
        </p>
        <h2>Sua conta e seu conteúdo</h2>
        <p>
          Confirme seu e-mail, proteja sua senha e publique apenas conteúdo que você tenha
          autorização para utilizar. Você é responsável por manter os dados do seu estabelecimento e
          cardápio corretos.
        </p>
        <h2>Limites e disponibilidade</h2>
        <p>
          Os limites são conferidos no servidor. Analytics Essencial, Avançado e Completo
          dependem dos direitos do plano. O Free exibe uma demonstração ilustrativa. QR Codes
          personalizados estão disponíveis em Medium e Pro. A disponibilidade das funções pode mudar durante
          o desenvolvimento.
        </p>
        <h2>Encerrar sua conta</h2>
        <p>
          Em Configurações, você pode sair de todos os dispositivos e solicitar a exclusão. A
          exclusão retira o cardápio do ar, encerra as sessões e agenda a limpeza após 30 dias.
          Durante esse período, fale com o suporte para solicitar ajuda ou cancelamento.
        </p>
        <h2>Suporte</h2>
        <p><a href="mailto:pingochef@gmail.com">pingochef&#64;gmail.com</a></p>
      }
    </main>
  </div>`,
})
export class LegalInformationComponent {
  privacy = false;
  constructor(route: ActivatedRoute) {
    this.privacy = route.snapshot.data['privacy'] === true;
  }
}
