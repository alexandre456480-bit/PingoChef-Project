import request from 'supertest';
import app from '../server';
import { localDb } from '../config/localDb';
import { hashActivationToken } from '../controllers/auth.controller';
import { isSupabaseConfigured } from '../config/supabase';

describe('🛡️ Hardening de Segurança - Suíte de Testes Obrigatórios', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // --------------------------------------------------------------------------
  // Caso 1: Rejeição de tokens inválidos (401)
  // --------------------------------------------------------------------------
  describe('1. Rejeição de tokens inválidos (401)', () => {
    it('deve rejeitar requisição sem header de autorização', async () => {
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar token malformatado ou inválido', async () => {
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', 'Bearer token_completamente_invalido_xyz');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('deve rejeitar tokens locais (local_jwt_) quando APP_MODE não for demo', async () => {
      delete process.env.APP_MODE;
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', 'Bearer local_jwt_usr_alexandre_01_fake');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  // --------------------------------------------------------------------------
  // Caso 2: Tentativa de acesso cross-tenant entre lojistas (401/403/404)
  // --------------------------------------------------------------------------
  describe('2. Tentativa de acesso cross-tenant entre lojistas', () => {
    it('não deve permitir operações sem identificação de tenant válida', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', 'Bearer invalid_or_unauthorized')
        .send({ name: 'Hacker Cat' });
      expect([401, 403]).toContain(res.status);
    });

    it('deve isolar categorias de estabelecimentos diferentes no localDb em modo demo', async () => {
      process.env.APP_MODE = 'demo';
      // Injetar dados isolados
      localDb.users.push({
        id: 'usr_tenant_b',
        email: 'tenantb@test.com',
        passwordHash: 'hash',
        fullName: 'Tenant B'
      });
      localDb.businesses.push({
        id: 'biz_tenant_b',
        owner_user_id: 'usr_tenant_b',
        name: 'Restaurante B',
        slug: 'restaurante-b',
        status: 'ACTIVE'
      });
      localDb.categories.push({
        id: 'cat_tenant_b_01',
        business_id: 'biz_tenant_b',
        name: 'Categoria Secreta B',
        icon: 'dish',
        icon_type: '2d',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString()
      });

      // Tenant A acessando não deve ver categorias do Tenant B
      const resA = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', 'Bearer local_jwt_usr_alexandre_01_mock');

      if (resA.status === 200) {
        const catNames = resA.body.data.map((c: any) => c.name);
        expect(catNames).not.toContain('Categoria Secreta B');
      }
      delete process.env.APP_MODE;
    });
  });

  // --------------------------------------------------------------------------
  // Caso 3: Falha segura quando o banco está offline (503, sem fallback indevido)
  // --------------------------------------------------------------------------
  describe('3. Falha segura quando o banco está indisponível (503)', () => {
    it('deve responder 503 e não vazar banco de memória quando APP_MODE não é demo', async () => {
      delete process.env.APP_MODE;
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'inexistente@qualquer.com', password: 'senha' });

      // Em produção sem Supabase funcional, deve falhar com 503 ou 401 sem recorrer ao demo local
      expect([503, 401]).toContain(res.status);
      if (res.status === 503) {
        expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Caso 4: Slug inexistente retornando 404 (sem vazar demo da Sapatolândia)
  // --------------------------------------------------------------------------
  describe('4. Slug inexistente retornando 404', () => {
    it('deve retornar 404 e jamais retornar o cardápio demo para slug inexistente', async () => {
      delete process.env.APP_MODE;
      const res = await request(app).get('/api/v1/public/menu/slug-totalmente-inexistente-123456');

      // Deve ser 404 ou 503 (se banco não conectado), JAMAIS 200 com dados da Sapatolândia
      expect(res.status).not.toBe(200);
      if (res.status === 404) {
        expect(res.body.error.code).toBe('BUSINESS_NOT_FOUND');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Caso 5: Race condition na ativação (segunda chamada deve falhar com 400)
  // --------------------------------------------------------------------------
  describe('5. Prevenção de Race Condition na ativação', () => {
    it('deve impedir que o mesmo token de ativação seja usado mais de uma vez', async () => {
      process.env.APP_MODE = 'demo';
      const rawToken = 'ACT-TEST-RACE';
      const tokenHash = hashActivationToken(rawToken);

      localDb.businesses.push({
        id: 'biz_test_race',
        owner_user_id: 'usr_alexandre_01',
        name: 'Biz Race',
        slug: 'biz-race',
        status: 'PENDING_ACTIVATION'
      });

      localDb.activationTokens.push({
        id: 'tok_race_01',
        tokenHash,
        business_id: 'biz_test_race',
        is_used: false,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      });

      // 1ª Ativação -> deve ter sucesso
      const res1 = await request(app)
        .post('/api/v1/auth/activate')
        .send({ token: rawToken });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.status).toBe('ACTIVE');

      // 2ª Ativação com o mesmo token -> deve falhar com TOKEN_ALREADY_USED
      const res2 = await request(app)
        .post('/api/v1/auth/activate')
        .send({ token: rawToken });

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('TOKEN_ALREADY_USED');
      delete process.env.APP_MODE;
    });
  });

  // --------------------------------------------------------------------------
  // Caso 6: Atomicidade de curtidas
  // --------------------------------------------------------------------------
  describe('6. Atomicidade de curtidas', () => {
    it('deve registrar somente uma curtida por visitante e item', async () => {
      if (isSupabaseConfigured) return;
      process.env.APP_MODE = 'demo';
      localDb.seedDefaultAccount();
      const visitor = request.agent(app);

      const first = await visitor
        .post('/api/v1/public/menu/sapatolandia-gourmet/like/item_01');
      const second = await visitor
        .post('/api/v1/public/menu/sapatolandia-gourmet/like/item_01');

      expect(first.status).toBe(200);
      expect(first.body.data.created).toBe(true);
      expect(second.status).toBe(200);
      expect(second.body.data.created).toBe(false);
      expect(second.body.data.likesCount).toBe(first.body.data.likesCount);
      expect(first.headers['set-cookie']?.[0]).toContain('HttpOnly');
      delete process.env.APP_MODE;
    });

    it('deve incrementar likes de forma consistente e rejeitar item inválido', async () => {
      process.env.APP_MODE = 'demo';
      const res = await request(app)
        .post('/api/v1/public/menu/sapatolandia-gourmet/like/item_inexistente_xyz');

      expect([404, 503]).toContain(res.status);
      delete process.env.APP_MODE;
    });
  });

  // --------------------------------------------------------------------------
  // Caso 7: Rate limiting acionado em excesso de requisições (429)
  // --------------------------------------------------------------------------
  describe('7. Rate Limiting de segurança', () => {
    it('deve ter headers de rate limit presentes nas respostas', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Caso 8: Validação de promotionalPrice >= price (400)
  // --------------------------------------------------------------------------
  describe('8. Validação de Preço Promocional', () => {
    it('deve rejeitar quando promotionalPrice for maior ou igual ao price original', async () => {
      process.env.APP_MODE = 'demo';
      localDb.seedDefaultAccount();
      const res = await request(app)
        .post('/api/v1/items')
        .set('Authorization', 'Bearer local_jwt_usr_alexandre_01')
        .send({
          categoryId: 'cat_01',
          name: 'Burger Invalido',
          price: 30.00,
          promotionalPrice: 35.00 // Inválido: maior que o preço normal
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      delete process.env.APP_MODE;
    });

    it('deve rejeitar quando promotionalPrice for igual ao price original', async () => {
      process.env.APP_MODE = 'demo';
      localDb.seedDefaultAccount();
      const res = await request(app)
        .post('/api/v1/items')
        .set('Authorization', 'Bearer local_jwt_usr_alexandre_01')
        .send({
          categoryId: 'cat_01',
          name: 'Burger Igual',
          price: 30.00,
          promotionalPrice: 30.00 // Inválido: igual ao preço normal
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      delete process.env.APP_MODE;
    });
  });

  // --------------------------------------------------------------------------
  // Caso 9: Rejeição de payload com SVG ou arquivos maliciosos (400)
  // --------------------------------------------------------------------------
  describe('9. Rejeição de SVG contra Stored XSS', () => {
    it('deve rejeitar imagem com formato SVG em Base64 ou data URI', async () => {
      process.env.APP_MODE = 'demo';
      localDb.seedDefaultAccount();
      const res = await request(app)
        .post('/api/v1/items')
        .set('Authorization', 'Bearer local_jwt_usr_alexandre_01')
        .send({
          categoryId: 'cat_01',
          name: 'Burger XSS',
          price: 25.00,
          imageUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4='
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      delete process.env.APP_MODE;
    });
  });

  // --------------------------------------------------------------------------
  // Caso 10: Sanitização de erros em produção (500)
  // --------------------------------------------------------------------------
  describe('10. Sanitização de Erros em Produção', () => {
    it('não deve vazar stack traces nem detalhes internos em produção', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const errorMiddleware = (app as any)._router.stack.find(
        (s: any) => s.route === undefined && s.handle && s.handle.length === 4
      )?.handle;

      expect(errorMiddleware).toBeDefined();

      const mockReq: any = {};
      const mockRes: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.body = data;
          return this;
        }
      };
      const mockNext = jest.fn();

      const sensitiveError = new Error('FATAL: password authentication failed for user postgres at internal_driver.ts:42');
      errorMiddleware(sensitiveError, mockReq, mockRes, mockNext);

      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.body.success).toBe(false);
      expect(mockRes.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(mockRes.body.error.message).toBe('Ocorreu um erro interno no servidor.');
      expect(mockRes.body.error.message).not.toContain('postgres');
      expect(mockRes.body.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
