require('dotenv').config();
const path = require('path');
const { detectHost } = require('../utils/detectHost');

const detectedHost = detectHost();
const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'ganti_secret_ini',
  nodeEnv,

  db: {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'praktikum_user',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'praktikum_db',
  },

  docker: {
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    studentImage: process.env.STUDENT_IMAGE || 'praktikum-linux:latest',
    networkName: process.env.DOCKER_NETWORK || 'student-net',
  },

  ssh: {
    hostDisplay: detectedHost.host,
    hostDisplaySource: detectedHost.source,
    portMin: parseInt(process.env.SSH_PORT_MIN || '30000', 10),
    portMax: parseInt(process.env.SSH_PORT_MAX || '40000', 10),
  },

  container: {
    ttlHours: parseFloat(process.env.CONTAINER_TTL_HOURS || '24'),
    memoryMb: parseInt(process.env.CONTAINER_MEMORY_MB || '512', 10),
    cpuLimit: parseFloat(process.env.CONTAINER_CPU_LIMIT || '0.5'),
    diskQuotaMb: parseInt(process.env.CONTAINER_DISK_QUOTA_MB || '2048', 10),
    maxPerStudent: parseInt(process.env.MAX_CONTAINER_PER_STUDENT || '1', 10),
  },

  auth: {
    defaultPassword: process.env.DEFAULT_STUDENT_PASSWORD || '12345678',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },

  cron: {
    cleanupPattern: process.env.CLEANUP_CRON_PATTERN || '*/10 * * * *',
  },

  log: {
    dir: process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs'),
    level: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
  },
};
