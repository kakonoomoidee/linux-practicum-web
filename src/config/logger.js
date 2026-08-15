const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const isProd = (process.env.NODE_ENV || 'development') === 'production';
const logDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');

// Format JSON terstruktur - dipakai buat file log dan console di production.
// Cocok buat di-ingest tool monitoring/log aggregator (ELK, Loki, Datadog, dst)
// kalau nanti dibutuhkan, karena setiap baris adalah satu objek JSON yang valid.
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Format enak dibaca manusia - dipakai di console pas development, biar ga perlu
// mikir parsing JSON pas lagi debug lokal.
const prettyFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    delete meta.stack; // stack trace ditangani terpisah di bawah biar ga dobel
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: isProd ? jsonFormat : prettyFormat,
  }),
  // File log selalu JSON (biar konsisten & gampang di-parse), terlepas dari NODE_ENV.
  // Rotasi harian, disimpan 14 hari, max 20MB per file sebelum ke-rotate juga.
  new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: jsonFormat,
  }),
  new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: jsonFormat,
  }),
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  format: jsonFormat,
  transports,
  exitOnError: false, // error di logging sendiri jangan sampai crash aplikasi
});

module.exports = logger;
