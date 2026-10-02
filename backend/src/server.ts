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
import adminRoutes from './routes/admin.routes';
import { adminOrigins } from './middleware/admin.middleware';
import billingWebhookRoutes from './routes/billing-webhook.routes';
import internalOperationsRoutes from './routes/internal-operations.routes';
import { apiTelemetry,apiRouteGroup } from './middleware/api-telemetry.middleware';
import { validateDeploymentEnvironment } from './config/deployment.config';
import { mapEntitlementDatabaseError } from './services/entitlement.service';
import analyticsRoutes from './routes/analytics.routes';
import { requireAnalyticsJson } from './controllers/menu-analytics.controller';
import qrRoutes from './routes/qr.routes';
import { sharedRateLimit } from './middleware/shared-rate-limit.middleware';
import { ownerError, ownerCookie } from './services/owner-session.service';
import { securityAudit } from './services/security-audit.service';

dotenv.config();
validateDeploymentEnvironment(process.env);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use((_req, res, next) => {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});
app.use(apiTelemetry);

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
  .filter(o => Boolean(o) && o !== '*')
  .concat(adminOrigins());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida pela política de CORS.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true
};

app.use(cors(corsOptions));

// Mux signatures cover the exact raw bytes. This route must stay before every
// JSON/body parser; moving it below express.json() breaks cryptographic checks.
app.use('/api/v1/webhooks/mux', muxWebhookRoutes);
app.use('/api/v1/webhooks/billing', billingWebhookRoutes);

// Rate Limiters
const standardRateLimitHandler = (message: string) => (req: express.Request, res: express.Response) => {
  securityAudit('warn', {
    event: 'rate_limit_exceeded',
    requestId: res.locals?.requestId,
    method: req.method,
    routeGroup: apiRouteGroup(req.originalUrl)
  });
  res.status(429).json({
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      requestId: res.locals?.requestId,
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

app.use('/api/v1/public/menu/:slug/events', requireAnalyticsJson, express.json({ limit: '16kb' }));
app.use('/api/v1/auth', (req, _res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) throw ownerError(415, 'AUTH_JSON_REQUIRED');
  next();
}, express.json({ limit: '16kb' }));
app.use('/api/v1/qr', (req, _res, next) => {
  if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) throw ownerError(415, 'QR_JSON_REQUIRED');
  next();
}, express.json({ limit: '64kb' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));


// Shared quotas supplement process-local filters across serverless/multiple instances.
app.use('/api/v1/auth', (req, res, next) => {
  // Credential/email flows already reserve durable per-email AND per-IP budgets.
  if (!/^\/(plan-intents(?:\/|$)|confirm-email$|recover$|recovery-session$|reset-password$|complete-registration$|migrate-session$|change-password$|delete-account$)/.test(req.path)) return next();
  if (/^\/(recovery-session|reset-password|complete-registration|change-password|delete-account)$/.test(req.path) && !ownerCookie(req)) return next();
  return sharedRateLimit('owner-auth-http', 100, 900)(req, res, next);
});
app.use('/api/v1/public/qr', sharedRateLimit('qr-resolve', 60));

// Rotas da API REST
app.use(['/api/v1/auth/login','/api/v1/auth/register','/api/v1/auth/forgot-password',
  '/api/v1/auth/resend-confirmation','/api/v1/auth/migrate-session'], authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/subcategories', subcategoryRoutes);
app.use('/api/v1/items', productVideoRoutes);
app.use('/api/v1/items', itemRoutes);
app.use('/api/v1/internal/videos', videoInternalRoutes);
app.use('/api/v1/internal/operations', internalOperationsRoutes);
app.use('/api/v1/design', designRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/qr', qrRoutes);

// Health Check Endpoint
app.get('/api/v1/health', (_req, res) => {
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({
    success: true,
    data: { status: 'UP' }
  });
});

// Middleware Padrão de Tratativa de Erro Sanitizado (RFC 7807)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  err = mapEntitlementDatabaseError(err) || err;

  if (err.message === 'Origem não permitida pela política de CORS.') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        requestId: res.locals?.requestId,
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
        requestId: res.locals?.requestId,
        message: 'Dados enviados são inválidos.',
        details: err.errors,
        timestamp: new Date().toISOString()
      }
    });
  }

  const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const isProduction = process.env.NODE_ENV === 'production';
  securityAudit('error', {
    event: 'request_failed',
    requestId: res.locals?.requestId,
    code: typeof err.code === 'string' ? err.code : 'UNHANDLED_ERROR',
    status: statusCode,
    method: req.method,
    routeGroup: apiRouteGroup(req.originalUrl)
  });
  const sanitizedMessage = statusCode >= 500 && isProduction
    ? 'Ocorreu um erro interno no servidor.'
    : (err.message || 'Ocorreu um erro interno no servidor.');

  res.status(statusCode).json({
    success: false,
    error: {
      requestId: res.locals?.requestId,
      code: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
      message: sanitizedMessage,
      ...(err.code === 'LIMIT_EXCEEDED' && err.metadata ? { metadata: err.metadata } : {}),
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

