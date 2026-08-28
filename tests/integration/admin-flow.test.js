const request = require('supertest');
const bcrypt = require('bcrypt');
const createApp = require('../../src/app');
const { pool } = require('../../src/db/connection');

const app = createApp();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'adminPassAman123';

async function seedAdmin() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const { rows } = await pool.query(
    'INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id',
    [ADMIN_USERNAME, hash]
  );
  return rows[0].id;
}

async function seedStudent(nim = '20220140001', firstLogin = false) {
  const hash = await bcrypt.hash('somepassword123', 10);
  await pool.query(
    'INSERT INTO students (nim, nama, password_hash, first_login) VALUES ($1, $2, $3, $4)',
    [nim, 'Test Student', hash, firstLogin]
  );
}

async function getCsrfToken(agent, path) {
  const res = await agent.get(path);
  const match = res.text.match(/csrf-token" content="([^"]*)"/);
  return match ? match[1] : null;
}

async function loginAsAdmin(agent) {
  const csrfToken = await getCsrfToken(agent, '/admin/login');
  return agent
    .post('/admin/login')
    .type('form')
    .send({ _csrf: csrfToken, username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
}

describe('Integration: Alur Admin', () => {
  test('dashboard admin TIDAK bisa diakses tanpa login (redirect ke /admin/login)', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/login');
  });

  test('login admin gagal dengan password salah', async () => {
    await seedAdmin();
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent, '/admin/login');

    const res = await agent
      .post('/admin/login')
      .type('form')
      .send({ _csrf: csrfToken, username: ADMIN_USERNAME, password: 'passwordsalah' });

    expect(res.status).toBe(401);
  });

  test('login admin berhasil, redirect ke /admin, dashboard bisa diakses', async () => {
    await seedAdmin();
    const agent = request.agent(app);

    const loginRes = await loginAsAdmin(agent);
    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.location).toBe('/admin');

    const dashboardRes = await agent.get('/admin');
    expect(dashboardRes.status).toBe(200);
  });

  test('admin bisa reset password mahasiswa, dan mahasiswa WAJIB ganti lagi di login berikutnya', async () => {
    await seedAdmin();
    await seedStudent('20220140099', false);
    const agent = request.agent(app);
    await loginAsAdmin(agent);

    const csrfToken = await getCsrfToken(agent, '/admin/settings');

    const resetRes = await agent
      .post('/admin/students/20220140099/reset-password')
      .set('X-CSRF-Token', csrfToken)
      .send({ new_password: 'passwordDariAdmin123' });

    expect(resetRes.status).toBe(200);

    const { rows } = await pool.query('SELECT first_login FROM students WHERE nim = $1', ['20220140099']);
    expect(rows[0].first_login).toBe(true);

    const studentAgent = request.agent(app);
    const studentCsrf = await getCsrfToken(studentAgent, '/login');
    const studentLoginRes = await studentAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', studentCsrf)
      .send({ nim: '20220140099', password: 'passwordDariAdmin123' });

    expect(studentLoginRes.status).toBe(200);
    expect(studentLoginRes.body.data.first_login).toBe(true);
  });

  test('admin bisa ganti password sendiri lewat halaman settings', async () => {
    const adminId = await seedAdmin();
    const agent = request.agent(app);
    await loginAsAdmin(agent);

    const csrfToken = await getCsrfToken(agent, '/admin/settings');

    const res = await agent
      .post('/admin/settings/password')
      .set('X-CSRF-Token', csrfToken)
      .send({ old_password: ADMIN_PASSWORD, new_password: 'passwordBaruAdmin456' });

    expect(res.status).toBe(200);

    const { rows } = await pool.query('SELECT password_hash FROM admins WHERE id = $1', [adminId]);
    const oldStillWorks = await bcrypt.compare(ADMIN_PASSWORD, rows[0].password_hash);
    const newWorks = await bcrypt.compare('passwordBaruAdmin456', rows[0].password_hash);
    expect(oldStillWorks).toBe(false);
    expect(newWorks).toBe(true);
  });

  test('endpoint admin AJAX (mis. force-destroy instance) menolak akses tanpa login/CSRF dengan JSON (bukan redirect)', async () => {
    const res = await request(app)
      .post('/admin/instances/1/destroy')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('halaman admin (GET, navigasi browser biasa) tetap redirect ke /admin/login kalau belum login', async () => {
    const res = await request(app).get('/admin/settings');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/login');
  });
});
