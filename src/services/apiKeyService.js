const crypto = require('crypto');
const bcrypt = require('bcrypt');
const apiKeyRepository = require('../repositories/apiKeyRepository');
const ServiceError = require('../utils/ServiceError');

const KEY_PREFIX = 'plk_'; // "praktikum linux key" - biar gampang dikenali kalau ke-commit ga sengaja

function generateRawKey() {
  const random = crypto.randomBytes(24).toString('base64url'); // ~32 karakter, URL-safe
  return `${KEY_PREFIX}${random}`;
}

/**
 * Bikin API key baru. Nilai ASLI (rawKey) cuma dikembalikan sekali di sini -
 * setelah ini, cuma hash-nya yang tersimpan, ga bisa ditampilkan ulang.
 */
async function createApiKey(name, createdBy) {
  if (!name || !name.trim()) {
    throw new ServiceError('Nama API key wajib diisi', 'MISSING_API_KEY_NAME');
  }

  const rawKey = generateRawKey();
  const keyPrefix = rawKey.slice(0, 12); // dipakai buat lookup cepat, bukan data sensitif
  const keyHash = await bcrypt.hash(rawKey, 10);

  const row = await apiKeyRepository.insert({ name: name.trim(), keyPrefix, keyHash, createdBy });

  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdAt: row.created_at,
    rawKey, // HANYA ada di response ini, tidak pernah disimpan/ditampilkan lagi setelahnya
  };
}

async function listApiKeys() {
  const rows = await apiKeyRepository.findAllActive();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    createdBy: r.created_by,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

async function revokeApiKey(id) {
  const row = await apiKeyRepository.findById(id);
  if (!row || row.revoked_at) {
    throw new ServiceError('API key tidak ditemukan', 'API_KEY_NOT_FOUND');
  }
  await apiKeyRepository.revoke(id);
}

/**
 * Verifikasi API key mentah dari header request. Return record key kalau valid,
 * null kalau tidak valid/sudah dicabut. Otomatis update last_used_at kalau valid,
 * berguna buat admin lihat kapan terakhir kali suatu integrasi benar-benar dipakai.
 */
async function verifyApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith(KEY_PREFIX)) return null;

  const keyPrefix = rawKey.slice(0, 12);
  const candidates = await apiKeyRepository.findActiveWithPrefix(keyPrefix);

  for (const candidate of candidates) {
    const match = await bcrypt.compare(rawKey, candidate.key_hash);
    if (match) {
      await apiKeyRepository.touchLastUsed(candidate.id);
      return candidate;
    }
  }

  return null;
}

module.exports = { createApiKey, listApiKeys, revokeApiKey, verifyApiKey };
