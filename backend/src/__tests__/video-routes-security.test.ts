import request from 'supertest';
import app from '../server';

describe('video route security gates', () => {
  it('requires authentication before creating a Direct Upload', async () => {
    const response = await request(app)
      .post('/api/v1/items/11111111-1111-4111-8111-111111111111/media/video/upload-intent')
      .set('Origin', 'http://localhost:4200')
      .send({ fileSizeBytes: 1024, mimeType: 'video/mp4' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a webhook without a valid Mux signature', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/mux')
      .set('Content-Type', 'application/json')
      .send({ id: 'fake-event', type: 'video.asset.ready', data: { id: 'fake-asset' } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('requires authentication before creating an owner preview playback token', async () => {
    const response = await request(app)
      .post('/api/v1/items/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222/playback')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rate-limits anonymous playback authorization attempts', async () => {
    const path = '/api/v1/public/menus/tenant-test/items/not-a-uuid/media/not-a-uuid/playback';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app).post(path).send({});
      expect(response.status).toBe(400);
    }

    const limited = await request(app).post(path).send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('PLAYBACK_RATE_LIMITED');
  });
});
