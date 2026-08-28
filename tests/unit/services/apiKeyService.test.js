jest.mock('../../../src/repositories/apiKeyRepository');

const apiKeyRepository = require('../../../src/repositories/apiKeyRepository');
const apiKeyService = require('../../../src/services/apiKeyService');

describe('apiKeyService.createApiKey', () => {
  beforeEach(() => jest.clearAllMocks());

  test('MISSING_API_KEY_NAME kalau nama kosong atau cuma spasi', async () => {
    await expect(apiKeyService.createApiKey('', 'admin')).rejects.toMatchObject({ code: 'MISSING_API_KEY_NAME' });
    await expect(apiKeyService.createApiKey('   ', 'admin')).rejects.toMatchObject({ code: 'MISSING_API_KEY_NAME' });
    expect(apiKeyRepository.insert).not.toHaveBeenCalled();
  });

  test('berhasil bikin key baru, rawKey diawali prefix "plk_" dan cuma muncul sekali di response', async () => {
    apiKeyRepository.insert.mockImplementation(async ({ name, keyPrefix, keyHash, createdBy }) => ({
      id: 1, name, key_prefix: keyPrefix, key_hash: keyHash, created_by: createdBy, created_at: new Date(),
    }));

    const result = await apiKeyService.createApiKey('Integrasi Moodle', 'admin');

    expect(result.rawKey).toMatch(/^plk_/);
    expect(result.name).toBe('Integrasi Moodle');
    expect(result.keyPrefix).toBe(result.rawKey.slice(0, 12));

    const insertCall = apiKeyRepository.insert.mock.calls[0][0];
    expect(insertCall.keyHash).not.toBe(result.rawKey);
  });

  test('nama di-trim sebelum disimpan', async () => {
    apiKeyRepository.insert.mockResolvedValue({ id: 1, name: 'Trimmed', key_prefix: 'plk_xxx', created_at: new Date() });
    await apiKeyService.createApiKey('  Trimmed  ', 'admin');
    expect(apiKeyRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trimmed' }));
  });
});

describe('apiKeyService.verifyApiKey', () => {
  beforeEach(() => jest.clearAllMocks());

  test('return null kalau key kosong/undefined', async () => {
    expect(await apiKeyService.verifyApiKey(undefined)).toBeNull();
    expect(await apiKeyService.verifyApiKey('')).toBeNull();
    expect(apiKeyRepository.findActiveWithPrefix).not.toHaveBeenCalled();
  });

  test('return null kalau key tidak diawali prefix "plk_" (langsung ditolak tanpa query DB)', async () => {
    expect(await apiKeyService.verifyApiKey('sk_bukan_format_kita')).toBeNull();
    expect(apiKeyRepository.findActiveWithPrefix).not.toHaveBeenCalled();
  });

  test('return null kalau tidak ada key aktif yang cocok dengan prefix-nya', async () => {
    apiKeyRepository.findActiveWithPrefix.mockResolvedValue([]);
    const result = await apiKeyService.verifyApiKey('plk_' + 'x'.repeat(32));
    expect(result).toBeNull();
  });

  test('berhasil verifikasi key yang valid, dan update last_used_at', async () => {
    apiKeyRepository.insert.mockImplementation(async ({ name, keyPrefix, keyHash }) => ({
      id: 42, name, key_prefix: keyPrefix, key_hash: keyHash, created_at: new Date(),
    }));
    const created = await apiKeyService.createApiKey('Test Key', 'admin');

    apiKeyRepository.findActiveWithPrefix.mockResolvedValue([
      { id: 42, key_hash: apiKeyRepository.insert.mock.calls[0][0].keyHash },
    ]);

    const result = await apiKeyService.verifyApiKey(created.rawKey);

    expect(result).not.toBeNull();
    expect(result.id).toBe(42);
    expect(apiKeyRepository.touchLastUsed).toHaveBeenCalledWith(42);
  });

  test('key yang sudah diubah 1 karakter TIDAK valid (bcrypt.compare harus gagal)', async () => {
    apiKeyRepository.insert.mockImplementation(async ({ name, keyPrefix, keyHash }) => ({
      id: 1, name, key_prefix: keyPrefix, key_hash: keyHash, created_at: new Date(),
    }));
    const created = await apiKeyService.createApiKey('Test', 'admin');
    const tamperedKey = created.rawKey.slice(0, -1) + (created.rawKey.slice(-1) === 'a' ? 'b' : 'a');

    apiKeyRepository.findActiveWithPrefix.mockResolvedValue([
      { id: 1, key_hash: apiKeyRepository.insert.mock.calls[0][0].keyHash },
    ]);

    const result = await apiKeyService.verifyApiKey(tamperedKey);
    expect(result).toBeNull();
  });
});

describe('apiKeyService.revokeApiKey', () => {
  beforeEach(() => jest.clearAllMocks());

  test('API_KEY_NOT_FOUND kalau id tidak ada', async () => {
    apiKeyRepository.findById.mockResolvedValue(null);
    await expect(apiKeyService.revokeApiKey(999)).rejects.toMatchObject({ code: 'API_KEY_NOT_FOUND' });
    expect(apiKeyRepository.revoke).not.toHaveBeenCalled();
  });

  test('API_KEY_NOT_FOUND kalau key sudah pernah di-revoke sebelumnya (tidak bisa di-revoke dobel)', async () => {
    apiKeyRepository.findById.mockResolvedValue({ id: 1, revoked_at: new Date('2026-01-01') });
    await expect(apiKeyService.revokeApiKey(1)).rejects.toMatchObject({ code: 'API_KEY_NOT_FOUND' });
    expect(apiKeyRepository.revoke).not.toHaveBeenCalled();
  });

  test('berhasil revoke key yang masih aktif', async () => {
    apiKeyRepository.findById.mockResolvedValue({ id: 1, revoked_at: null });
    await apiKeyService.revokeApiKey(1);
    expect(apiKeyRepository.revoke).toHaveBeenCalledWith(1);
  });
});
