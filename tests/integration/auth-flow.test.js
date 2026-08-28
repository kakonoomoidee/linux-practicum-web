const request = require('supertest');
const bcrypt = require('bcrypt');
const createApp = require('../../src/app');
const { pool } = require('../../src/db/connection');

const app = createApp();

const NIM = '20220140020';
const DEFAULT_PASSWORD = '12345678';

async function seedStudent({ firstLogin = true } = {}) {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await pool.query(
    'INSERT INTO students (nim, nama, password_hash, first_login) VALUES ($1, $2, $3, $4)',
    [NIM, 'Rizki Ramadan', hash, firstLogin]
  );
}

async function getCsrfToken(agent, path = '/login') {
  const res = await agent.get(path);
  const match = res.text.match(/csrf-token" content="([^"]*)"/);
  return match ? match[1] : null;
}

describe('Integration: Alur Login Mahasiswa', () => {
  test('login gagal (401) kalau NIM tidak terdaftar', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ nim: '99999999999', password: 'anypassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('login GAGAL (403) kalau CSRF token tidak disertakan sama sekali', async () => {
    await seedStudent();
    const agent = request.agent(app);
    await getCsrfToken(agent);

    const res = await agent
      .post('/api/auth/login')
      .send({ nim: NIM, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(403);
  });

  test('login BERHASIL dengan NIM + password default yang benar, first_login true diteruskan ke response', async () => {
    await seedStudent({ firstLogin: true });
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ nim: NIM, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.first_login).toBe(true);
  });

  test('setelah login sukses, dashboard TIDAK bisa diakses langsung selama first_login masih true (dialihkan ke change-password)', async () => {
    await seedStudent({ firstLogin: true });
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    await agent.post('/api/auth/login').set('X-CSRF-Token', csrfToken).send({ nim: NIM, password: DEFAULT_PASSWORD });

    const dashboardRes = await agent.get('/dashboard');
    expect(dashboardRes.status).toBe(302);
    expect(dashboardRes.headers.location).toBe('/change-password');
  });

  test('alur penuh: login -> ganti password wajib -> dashboard bisa diakses', async () => {
    await seedStudent({ firstLogin: true });
    const agent = request.agent(app);
    let csrfToken = await getCsrfToken(agent);

    await agent.post('/api/auth/login').set('X-CSRF-Token', csrfToken).send({ nim: NIM, password: DEFAULT_PASSWORD });

    const cpPage = await agent.get('/change-password');
    csrfToken = cpPage.text.match(/csrf-token" content="([^"]*)"/)[1];

    const changeRes = await agent
      .post('/api/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ old_password: DEFAULT_PASSWORD, new_password: 'passwordBaruAman123' });

    expect(changeRes.status).toBe(200);

    const dashboardRes = await agent.get('/dashboard');
    expect(dashboardRes.status).toBe(200);
  });

  test('mengganti password dengan password baru yang SAMA dengan default ditolak (400)', async () => {
    await seedStudent({ firstLogin: true });
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    await agent.post('/api/auth/login').set('X-CSRF-Token', csrfToken).send({ nim: NIM, password: DEFAULT_PASSWORD });

    const res = await agent
      .post('/api/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ old_password: DEFAULT_PASSWORD, new_password: DEFAULT_PASSWORD });

    expect(res.status).toBe(400);
  });

  test('endpoint yang butuh login (mis. /api/containers) menolak akses tanpa session (401)', async () => {
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(401);
  });

  test('halaman yang tidak ada mengembalikan 404 branded (bukan crash/500)', async () => {
    const res = await request(app).get('/halaman-yang-tidak-pernah-ada-12345');
    expect(res.status).toBe(404);
    expect(res.text).toContain('404');
  });
});
