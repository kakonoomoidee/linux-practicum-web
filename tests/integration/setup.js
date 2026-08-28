process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-untuk-integration-test-minimal-16-char';
process.env.LOG_LEVEL = 'error';
process.env.TRUST_PROXY_HOPS = '0';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://praktikum_user:testpass123@localhost:5432/praktikum_db';

const { pool } = require('../../src/db/connection');
const { initSchema } = require('../../src/db/initSchema');

beforeAll(async () => {
  await initSchema();
});

beforeEach(async () => {
  await pool.query('TRUNCATE containers, activity_log, students, admins, api_keys RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
