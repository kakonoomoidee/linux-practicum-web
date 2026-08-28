jest.mock('../../../src/repositories/studentRepository');
jest.mock('../../../src/repositories/activityLogRepository');

const bcrypt = require('bcrypt');
const studentRepository = require('../../../src/repositories/studentRepository');
const activityLogRepository = require('../../../src/repositories/activityLogRepository');
const authService = require('../../../src/services/authService');
const ServiceError = require('../../../src/utils/ServiceError');

const NIM = '20220140020';

function makeStudent(overrides = {}) {
  return {
    nim: NIM,
    nama: 'Rizki Ramadan',
    password_hash: 'irrelevant-in-mocked-tests',
    first_login: false,
    preferred_language: 'en',
    ...overrides,
  };
}

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('MISSING_CREDENTIALS kalau nim atau password kosong', async () => {
    await expect(authService.login('', 'somepass')).rejects.toMatchObject({ code: 'MISSING_CREDENTIALS' });
    await expect(authService.login(NIM, '')).rejects.toMatchObject({ code: 'MISSING_CREDENTIALS' });
    expect(studentRepository.findByNim).not.toHaveBeenCalled();
  });

  test('INVALID_CREDENTIALS kalau NIM tidak terdaftar', async () => {
    studentRepository.findByNim.mockResolvedValue(null);
    await expect(authService.login(NIM, 'anypass')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  test('INVALID_CREDENTIALS kalau password salah, DAN tercatat sebagai login_failed di activity log', async () => {
    const student = makeStudent({ password_hash: await bcrypt.hash('passwordbenar', 10) });
    studentRepository.findByNim.mockResolvedValue(student);

    await expect(authService.login(NIM, 'passwordsalah')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(activityLogRepository.log).toHaveBeenCalledWith(NIM, 'login_failed');
  });

  test('berhasil login dengan password yang benar, mengembalikan data lengkap termasuk preferredLanguage', async () => {
    const realHash = await bcrypt.hash('passwordbenar123', 10);
    const student = makeStudent({ password_hash: realHash, first_login: true, preferred_language: 'id' });
    studentRepository.findByNim.mockResolvedValue(student);

    const result = await authService.login(NIM, 'passwordbenar123');

    expect(result).toEqual({
      nim: NIM,
      nama: 'Rizki Ramadan',
      firstLogin: true,
      preferredLanguage: 'id',
    });
    expect(activityLogRepository.log).toHaveBeenCalledWith(NIM, 'login_success');
  });

  test('NIM di-trim sebelum dicari ke database (toleran spasi tidak sengaja)', async () => {
    studentRepository.findByNim.mockResolvedValue(null);
    await expect(authService.login('  20220140020  ', 'pass')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(studentRepository.findByNim).toHaveBeenCalledWith(NIM);
  });
});

describe('authService.changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('MISSING_PASSWORD_FIELDS kalau salah satu field kosong', async () => {
    await expect(authService.changePassword(NIM, '', 'newpass123')).rejects.toMatchObject({ code: 'MISSING_PASSWORD_FIELDS' });
    await expect(authService.changePassword(NIM, 'oldpass', '')).rejects.toMatchObject({ code: 'MISSING_PASSWORD_FIELDS' });
  });

  test('PASSWORD_TOO_SHORT kalau password baru kurang dari 8 karakter', async () => {
    await expect(authService.changePassword(NIM, 'oldpass123', 'short')).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
  });

  test('PASSWORD_SAME_AS_DEFAULT kalau password baru sama persis dengan default (12345678)', async () => {
    await expect(authService.changePassword(NIM, 'oldpass123', '12345678')).rejects.toMatchObject({ code: 'PASSWORD_SAME_AS_DEFAULT' });
  });

  test('STUDENT_NOT_FOUND kalau NIM tidak ada di database', async () => {
    studentRepository.findByNim.mockResolvedValue(null);
    await expect(authService.changePassword(NIM, 'oldpass123', 'validNewPass123')).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
  });

  test('PASSWORD_INCORRECT kalau password lama tidak cocok', async () => {
    const student = makeStudent({ password_hash: await bcrypt.hash('passwordAsli', 10) });
    studentRepository.findByNim.mockResolvedValue(student);

    await expect(authService.changePassword(NIM, 'passwordSalah', 'validNewPass123')).rejects.toMatchObject({ code: 'PASSWORD_INCORRECT' });
    expect(studentRepository.updatePassword).not.toHaveBeenCalled();
  });

  test('berhasil ganti password kalau semua validasi lolos', async () => {
    const student = makeStudent({ password_hash: await bcrypt.hash('passwordAsli', 10) });
    studentRepository.findByNim.mockResolvedValue(student);

    await authService.changePassword(NIM, 'passwordAsli', 'validNewPass123');

    expect(studentRepository.updatePassword).toHaveBeenCalledWith(NIM, expect.any(String));
    expect(activityLogRepository.log).toHaveBeenCalledWith(NIM, 'password_changed');

    const savedHash = studentRepository.updatePassword.mock.calls[0][1];
    expect(savedHash).not.toBe('validNewPass123');
    expect(await bcrypt.compare('validNewPass123', savedHash)).toBe(true);
  });
});

describe('authService.updateLanguage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('menerima bahasa yang didukung (en/id)', async () => {
    await authService.updateLanguage(NIM, 'id');
    expect(studentRepository.updateLanguage).toHaveBeenCalledWith(NIM, 'id');
  });

  test('INVALID_LANGUAGE kalau bahasa tidak didukung', async () => {
    await expect(authService.updateLanguage(NIM, 'fr')).rejects.toMatchObject({ code: 'INVALID_LANGUAGE' });
    expect(studentRepository.updateLanguage).not.toHaveBeenCalled();
  });
});
