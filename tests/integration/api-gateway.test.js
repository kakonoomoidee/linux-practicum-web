const request = require('supertest');
const bcrypt = require('bcrypt');
const createApp = require('../../src/app');
const { pool } = require('../../src/db/connection');
const apiKeyService = require('../../src/services/apiKeyService');

const app = createApp();

async function seedStudent(nim = '20220140020') {
  const hash = await bcrypt.hash('somepass123', 10);
  await pool.query(
    'INSERT INTO students (nim, nama, password_hash, first_login) VALUES ($1, $2, $3, FALSE)',
    [nim, 'Test Student', hash]
  );
}

describe('Integration: API Gateway (/api/v1)', () => {
  test('GET /api/v1/health selalu bisa diakses tanpa API key, dan beneran verifikasi koneksi database', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.checks.database).toBe('ok');
  });

  test('GET /api/v1/students TANPA API key ditolak 401', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/v1/students dengan API key SALAH/PALSU ditolak 401', async () => {
    const res = await request(app).get('/api/v1/students').set('X-API-Key', 'plk_key_yang_dikarang_bebas_123456');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/students dengan API key VALID berhasil, dan TIDAK PERNAH menyertakan password_hash', async () => {
    await seedStudent('20220140020');
    const { rawKey } = await apiKeyService.createApiKey('Test Integration', 'admin');

    const res = await request(app).get('/api/v1/students').set('X-API-Key', rawKey);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nim).toBe('20220140020');
    expect(res.body.data[0]).not.toHaveProperty('password_hash');
  });

  test('GET /api/v1/containers dengan API key valid berhasil (list kosong kalau belum ada container aktif)', async () => {
    const { rawKey } = await apiKeyService.createApiKey('Test Integration', 'admin');
    const res = await request(app).get('/api/v1/containers').set('X-API-Key', rawKey);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('API key yang sudah di-REVOKE langsung ditolak di request berikutnya', async () => {
    const created = await apiKeyService.createApiKey('Bakal Dicabut', 'admin');

    const beforeRevoke = await request(app).get('/api/v1/students').set('X-API-Key', created.rawKey);
    expect(beforeRevoke.status).toBe(200);

    await apiKeyService.revokeApiKey(created.id);

    const afterRevoke = await request(app).get('/api/v1/students').set('X-API-Key', created.rawKey);
    expect(afterRevoke.status).toBe(401);
  });

  test('endpoint API Gateway TIDAK terpengaruh sama sekali oleh proteksi CSRF (autentikasi API key, bukan session)', async () => {
    const { rawKey } = await apiKeyService.createApiKey('CSRF Independence Test', 'admin');
    const res = await request(app).get('/api/v1/students').set('X-API-Key', rawKey);
    expect(res.status).toBe(200);
  });

  test('response API Gateway SELALU berbahasa Inggris, terlepas dari cookie bahasa yang dikirim', async () => {
    const res = await request(app)
      .get('/api/v1/students')
      .set('Cookie', 'lang=id')
      .set('X-API-Key', 'plk_key_invalid_buat_trigger_pesan_error');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid|revoked/i);
  });
});
