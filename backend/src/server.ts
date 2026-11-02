import { timingSafeEqual } from 'node:crypto';
import express from 'express';
let app: any = express();
try {
  app = require('./app-runtime').default;
} catch (error: any) {
  app = (req: any, res: any) => {
    const expected = process.env.INTERNAL_JOBS_SECRET || '';
    const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const authorized = expected.length >= 32 && expected.length === supplied.length
      && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
    let detail = `${error?.name || 'Error'}: ${error?.message || 'Startup failed'}`;
    for (const value of Object.values(process.env)) {
      if (value && value.length >= 12) detail = detail.split(value).join('<REDACTED>');
    }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const diagnostic = authorized && req.url?.split('?')[0] === '/api/v1/internal/operations/ready';
    res.end(JSON.stringify({ success: false, error: { code: 'API_STARTUP_FAILED', ...(diagnostic ? { detail } : {}) } }));
  };
}
export default app;
export { app };
