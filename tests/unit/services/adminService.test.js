jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../../src/repositories/adminRepository');
jest.mock('../../../src/repositories/containerRepository');
jest.mock('../../../src/repositories/studentRepository');
jest.mock('../../../src/repositories/activityLogRepository');
jest.mock('../../../src/services/dockerService');

const bcrypt = require('bcrypt');
const adminRepository = require('../../../src/repositories/adminRepository');
const containerRepository = require('../../../src/repositories/containerRepository');
const studentRepository = require('../../../src/repositories/studentRepository');
const activityLogRepository = require('../../../src/repositories/activityLogRepository');
const dockerService = require('../../../src/services/dockerService');
const adminService = require('../../../src/services/adminService');

describe('adminService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('MISSING_ADMIN_CREDENTIALS kalau username/password kosong', async () => {
    await expect(adminService.login('', 'pass')).rejects.toMatchObject({ code: 'MISSING_ADMIN_CREDENTIALS' });
  });

  test('INVALID_ADMIN_CREDENTIALS kalau username tidak ada', async () => {
    adminRepository.findByUsername.mockResolvedValue(null);
    await expect(adminService.login('notexist', 'pass')).rejects.toMatchObject({ code: 'INVALID_ADMIN_CREDENTIALS' });
  });

  test('INVALID_ADMIN_CREDENTIALS kalau password salah', async () => {
    adminRepository.findByUsername.mockResolvedValue({ id: 1, username: 'admin', password_hash: await bcrypt.hash('benar', 10) });
    await expect(adminService.login('admin', 'salah')).rejects.toMatchObject({ code: 'INVALID_ADMIN_CREDENTIALS' });
  });

  test('berhasil login, mengembalikan preferredLanguage', async () => {
    adminRepository.findByUsername.mockResolvedValue({
      id: 1, username: 'admin', password_hash: await bcrypt.hash('benar123', 10), preferred_language: 'id',
    });
    const result = await adminService.login('admin', 'benar123');
    expect(result).toEqual({ id: 1, username: 'admin', preferredLanguage: 'id' });
  });
});

describe('adminService.forceDestroyInstance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('INSTANCE_NOT_FOUND kalau container tidak ada', async () => {
    containerRepository.findById.mockResolvedValue(null);
    await expect(adminService.forceDestroyInstance(999)).rejects.toMatchObject({ code: 'INSTANCE_NOT_FOUND' });
  });

  test('INSTANCE_NOT_FOUND kalau container sudah destroyed sebelumnya', async () => {
    containerRepository.findById.mockResolvedValue({ id: 1, status: 'destroyed' });
    await expect(adminService.forceDestroyInstance(1)).rejects.toMatchObject({ code: 'INSTANCE_NOT_FOUND' });
  });

  test('berhasil force-destroy instance yang aktif', async () => {
    const row = { id: 1, nim: '123', container_id: 'docker-1', container_name: 'test', status: 'running' };
    containerRepository.findById.mockResolvedValue(row);
    dockerService.destroyContainer.mockResolvedValue(undefined);

    await adminService.forceDestroyInstance(1);

    expect(dockerService.destroyContainer).toHaveBeenCalledWith('docker-1');
    expect(containerRepository.markDestroyed).toHaveBeenCalledWith(1);
    expect(activityLogRepository.log).toHaveBeenCalledWith('123', 'container_destroyed_by_admin', 'test');
  });

  test('tetap tandai destroyed di DB walau hapus di Docker gagal', async () => {
    const row = { id: 1, nim: '123', container_id: 'docker-1', container_name: 'test', status: 'running' };
    containerRepository.findById.mockResolvedValue(row);
    dockerService.destroyContainer.mockRejectedValue(new Error('docker error'));

    await adminService.forceDestroyInstance(1);
    expect(containerRepository.markDestroyed).toHaveBeenCalledWith(1);
  });
});

describe('adminService.resetStudentPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('PASSWORD_TOO_SHORT kalau password kurang dari 8 karakter', async () => {
    await expect(adminService.resetStudentPassword('123', 'short')).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
  });

  test('STUDENT_NOT_FOUND kalau NIM tidak ada', async () => {
    studentRepository.findByNim.mockResolvedValue(null);
    await expect(adminService.resetStudentPassword('123', 'validpass123')).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
  });

  test('berhasil reset password, memakai resetPasswordByAdmin (BUKAN updatePassword biasa) supaya first_login kembali true', async () => {
    studentRepository.findByNim.mockResolvedValue({ nim: '123', nama: 'Test' });
    await adminService.resetStudentPassword('123', 'validpass123');
    expect(studentRepository.resetPasswordByAdmin).toHaveBeenCalledWith('123', expect.any(String));
    expect(studentRepository.updatePassword).not.toHaveBeenCalled();
    expect(activityLogRepository.log).toHaveBeenCalledWith('123', 'password_reset_by_admin');
  });
});

describe('adminService.changeOwnPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('MISSING_PASSWORD_FIELDS kalau field kosong', async () => {
    await expect(adminService.changeOwnPassword(1, '', 'newpass123')).rejects.toMatchObject({ code: 'MISSING_PASSWORD_FIELDS' });
  });

  test('ADMIN_NOT_FOUND kalau adminId tidak ada', async () => {
    adminRepository.findById.mockResolvedValue(null);
    await expect(adminService.changeOwnPassword(999, 'old', 'newpass123')).rejects.toMatchObject({ code: 'ADMIN_NOT_FOUND' });
  });

  test('PASSWORD_INCORRECT kalau password lama salah', async () => {
    adminRepository.findById.mockResolvedValue({ id: 1, username: 'admin', password_hash: await bcrypt.hash('benar', 10) });
    await expect(adminService.changeOwnPassword(1, 'salah', 'newpass123')).rejects.toMatchObject({ code: 'PASSWORD_INCORRECT' });
  });

  test('berhasil ganti password sendiri', async () => {
    adminRepository.findById.mockResolvedValue({ id: 1, username: 'admin', password_hash: await bcrypt.hash('benar123', 10) });
    await adminService.changeOwnPassword(1, 'benar123', 'passwordbaru456');
    expect(adminRepository.updatePassword).toHaveBeenCalledWith(1, expect.any(String));
  });
});
