const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');

const VALID_LEVELS = ['error', 'warn', 'info', 'http', 'debug'];

/**
 * Baca dan parse file log JSON dari folder log.
 *
 * @param {object} opts
 * @param {string} opts.level - 'all' (default, baca combined-*.log) atau salah satu
 *                              dari VALID_LEVELS (baca error-*.log kalau 'error', dst -
 *                              tapi karena cuma error-*.log yang dipisah levelnya secara
 *                              fisik di winston, level lain difilter dari combined setelah dibaca)
 * @param {string} opts.search - filter teks bebas di message/nim/event (case-insensitive)
 * @param {number} opts.limit - jumlah baris terbaru yang dikembalikan (default 200, max 1000)
 * @returns {Promise<{lines: object[], filesRead: string[], truncated: boolean}>}
 */
async function readLogs({ level = 'all', search = '', limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

  let files;
  try {
    files = await fs.readdir(config.log.dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { lines: [], filesRead: [], truncated: false, totalMatched: 0, error: `Folder log belum ada: ${config.log.dir}` };
    }
    throw err;
  }

  // Kalau filter level = 'error', baca file error-*.log langsung (lebih presisi & lebih cepat
  // karena filenya sudah dipisah level oleh winston). Selain itu baca combined-*.log lalu
  // difilter di memori.
  const prefix = level === 'error' ? 'error-' : 'combined-';
  const logFiles = files
    .filter((f) => f.startsWith(prefix) && f.endsWith('.log'))
    .sort()
    .reverse() // file terbaru duluan (nama file ada tanggalnya, YYYY-MM-DD, jadi sort string aman)
    .slice(0, 3); // paling banyak baca 3 file terakhir (hari ini + 2 hari sebelumnya), cukup buat kebutuhan admin

  const allLines = [];

  for (const filename of logFiles) {
    const content = await fs.readFile(path.join(config.log.dir, filename), 'utf-8');
    const rawLines = content.split('\n').filter(Boolean);

    for (const raw of rawLines) {
      try {
        const parsed = JSON.parse(raw);
        allLines.push(parsed);
      } catch {
        // Baris korup/ga lengkap (misal proses ke-kill di tengah nulis) - skip aja, ga fatal
      }
    }
  }

  // Urutkan terbaru dulu
  allLines.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let filtered = allLines;

  if (level !== 'all' && level !== 'error' && VALID_LEVELS.includes(level)) {
    filtered = filtered.filter((l) => l.level === level);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((l) => {
      const haystack = [l.message, l.nim, l.event, l.requestId, l.path, l.containerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const truncated = filtered.length > safeLimit;

  return {
    lines: filtered.slice(0, safeLimit),
    filesRead: logFiles,
    truncated,
    totalMatched: filtered.length,
    error: null,
  };
}

module.exports = { readLogs, VALID_LEVELS };
