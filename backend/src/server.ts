import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import itemRoutes from './routes/item.routes';
import subcategoryRoutes from './routes/subcategory.routes';
import designRoutes from './routes/design.routes';
import publicRoutes from './routes/public.routes';
import businessRoutes from './routes/business.routes';
import productVideoRoutes from './routes/product-video.routes';
import muxWebhookRoutes from './routes/mux-webhook.routes';
import videoInternalRoutes from './routes/video-internal.routes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use((_req, res, next) => {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Trust only the explicitly configured number of reverse-proxy hops. A broad
// unconditional trust lets callers spoof X-Forwarded-For and evade IP quotas.
const trustProxyRaw = process.env.TRUST_PROXY?.trim().toLowerCase() ?? 'false';
const trustProxy = trustProxyRaw === 'true'
  ? 1
  : (/^\d+$/.test(trustProxyRaw) ? Number(trustProxyRaw) : false);
app.set('trust proxy', trustProxy);

// Middlewares de Segurança
app.use(helmet());

// Configuração estrita de CORS com Allowlist
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida pela política de CORS.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Mux signatures cover the exact raw bytes. This route must stay before every
// JSON/body parser; moving it below express.json() breaks cryptographic checks.
app.use('/api/v1/webhooks/mux', muxWebhookRoutes);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Rate Limiters
const standardRateLimitHandler = (message: string) => (req: express.Request, res: express.Response) => {
  console.warn('[Security Audit]', {
    event: 'rate_limit_exceeded',
    requestId: res.locals?.requestId,
    method: req.method,
    path: req.path
  });
  res.status(429).json({
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message,
      timestamp: new Date().toISOString()
    }
  });
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardRateLimitHandler('Muitas requisições originadas deste IP. Tente novamente mais tarde.')
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardRateLimitHandler('Muitas tentativas de autenticação. Tente novamente em 15 minutos.')
});

app.use(globalLimiter);

// Rotas da API REST
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/subcategories', subcategoryRoutes);
app.use('/api/v1/items', productVideoRoutes);
app.use('/api/v1/items', itemRoutes);
app.use('/api/v1/internal/videos', videoInternalRoutes);
app.use('/api/v1/design', designRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/public', publicRoutes);

// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      service: 'Cardapio Digital SaaS Backend API',
      timestamp: new Date().toISOString()
    }
  });
});

// Middleware Padrão de Tratativa de Erro Sanitizado (RFC 7807)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {

  if (err.message === 'Origem não permitida pela política de CORS.') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: err.message,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados enviados são inválidos.',
        details: err.errors,
        timestamp: new Date().toISOString()
      }
    });
  }

  const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const isProduction = process.env.NODE_ENV === 'production';
  console.error('[Error Audit]', {
    requestId: res.locals?.requestId,
    code: typeof err.code === 'string' ? err.code : 'UNHANDLED_ERROR',
    status: statusCode,
    method: req.method,
    path: req.path
  });
  const sanitizedMessage = statusCode >= 500 && isProduction
    ? 'Ocorreu um erro interno no servidor.'
    : (err.message || 'Ocorreu um erro interno no servidor.');

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
      message: sanitizedMessage,
      timestamp: new Date().toISOString()
    }
  });
});

// Vercel imports the Express app as a serverless function. Only the local
// process owns a listening socket; opening one during a serverless import can
// cause port conflicts and duplicate instances.
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend API rodando na porta ${PORT} [ENV: ${process.env.NODE_ENV || 'development'}]`);
  });
}

export default app;
export { app };

