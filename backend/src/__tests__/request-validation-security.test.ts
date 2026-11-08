import request from 'supertest';
import { gzipSync } from 'node:zlib';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import app from '../server';

test('invalid requests retain structured validation details after the Zod upgrade', async () => {
  const response = await request(app).post('/api/v1/public/menu/security-check/vitals')
    .send({ templateCode: 'default', deviceClass: 'mobile', metrics: [{ name: 'INP', value: -1 }] });
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(response.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: expect.any(Array) })]));
});

test('compressed request parsing rejects malformed JSON without disabling subsequent requests', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address() as { port: number };
    const body = Buffer.concat([gzipSync(Buffer.from('{')), Buffer.from('trailing bytes')]);
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port: address.port,
        path: '/api/v1/public/menu/security-check/vitals', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': body.length } }, res => {
          res.resume(); res.on('end', () => resolve(res.statusCode!));
        });
      req.on('error', reject); req.end(body);
    });
    expect(status).toBe(400);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
