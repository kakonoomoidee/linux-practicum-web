const { z } = require('zod');

// Nilai placeholder dari .env.example - kalau masih kepakai persis, itu tanda
// admin lupa ganti .env sebelum deploy. Bahaya khusus buat SESSION_SECRET dan
// PGPASSWORD karena keduanya krusial buat keamanan produksi.
const INSECURE_DEFAULTS = {
  SESSION_SECRET: 'ganti_ini_dengan_random_string_yang_panjang_dan_rahasia',
  PGPASSWORD: 'ganti_password_ini',
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/, 'PORT harus berupa angka').optional(),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET minimal 16 karakter (dipakai buat enkripsi cookie sesi)'),
});

/**
 * Validasi environment variable saat startup, SEBELUM koneksi database atau
 * apa pun lainnya dijalankan - biar kesalahan konfigurasi ketahuan secepat
 * mungkin, bukan nyusul jadi bug aneh di tengah jalan.
 *
 * Di production: kesalahan konfigurasi kritis (secret masih placeholder) akan
 * menghentikan startup sama sekali. Di development: cuma warning, biar iterasi
 * cepat tetap nyaman.
 */
function validateEnv(logger) {
  const result = envSchema.safeParse(process.env);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const problems = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  for (const [key, badValue] of Object.entries(INSECURE_DEFAULTS)) {
    if (process.env[key] === badValue) {
      problems.push(`${key} masih pakai nilai placeholder dari .env.example - WAJIB diganti sebelum deploy`);
    }
  }

  if (problems.length === 0) {
    return;
  }

  const log = logger || console;

  for (const problem of problems) {
    log.warn ? log.warn(`[env] ${problem}`) : console.warn(`[env] ${problem}`);
  }

  if (isProd) {
    (log.error || console.error)('[env] Ditemukan masalah konfigurasi kritis di NODE_ENV=production, server tidak dijalankan. Perbaiki .env terlebih dahulu.');
    process.exit(1);
  } else {
    (log.warn || console.warn)('[env] Server tetap dijalankan (NODE_ENV bukan production), tapi masalah di atas WAJIB diperbaiki sebelum deploy ke production.');
  }
}

module.exports = { validateEnv, envSchema, INSECURE_DEFAULTS };
