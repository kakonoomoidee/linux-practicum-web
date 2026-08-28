jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/repositories/containerRepository');
jest.mock('../../../src/repositories/activityLogRepository');
jest.mock('../../../src/services/dockerService');

const containerRepository = require('../../../src/repositories/containerRepository');
const activityLogRepository = require('../../../src/repositories/activityLogRepository');
const dockerService = require('../../../src/services/dockerService');
const containerService = require('../../../src/services/containerService');
const ServiceError = require('../../../src/utils/ServiceError');

const NIM = '20220140020';

function makeContainerRow(overrides = {}) {
  return {
    id: 1,
    nim: NIM,
    container_id: 'docker-abc123',
    container_name: 'student-20220140020-1700000000000',
    ssh_port: 19121,
    linux_username: 'mahasiswa',
    status: 'running',
    created_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

describe('containerService.createForStudent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    containerRepository.findFirstRunningByNim.mockResolvedValue(null);
    containerRepository.countRunningByNim.mockResolvedValue(0);
    containerRepository.findAllRunningPorts.mockResolvedValue(new Set());
  });

  test('berhasil bikin container baru kalau mahasiswa belum punya container aktif', async () => {
    const spawnResult = {
      containerId: 'docker-new-id',
      containerName: 'student-20220140020-new',
      sshPort: 19122,
      linuxUsername: 'mahasiswa',
      linuxPassword: 'randomPass123',
    };
    dockerService.spawnContainer.mockResolvedValue(spawnResult);
    containerRepository.insert.mockResolvedValue(makeContainerRow({ container_name: spawnResult.containerName }));

    const result = await containerService.createForStudent(NIM);

    expect(dockerService.spawnContainer).toHaveBeenCalledTimes(1);
    expect(containerRepository.insert).toHaveBeenCalledTimes(1);
    expect(activityLogRepository.log).toHaveBeenCalledWith(NIM, 'container_created', spawnResult.containerName);
    expect(result.ssh_password).toBe('randomPass123');
  });

  test('menolak dengan CONTAINER_LIMIT_REACHED kalau container lama MASIH hidup di Docker', async () => {
    const existing = makeContainerRow();
    containerRepository.findFirstRunningByNim.mockResolvedValue(existing);
    dockerService.isContainerAlive.mockResolvedValue(true);

    await expect(containerService.createForStudent(NIM)).rejects.toThrow(ServiceError);
    await expect(containerService.createForStudent(NIM)).rejects.toMatchObject({ code: 'CONTAINER_LIMIT_REACHED' });

    expect(dockerService.spawnContainer).not.toHaveBeenCalled();
    expect(containerRepository.markDestroyed).not.toHaveBeenCalled();
  });

  describe('self-healing: container lama sudah tidak ada di Docker Engine', () => {
    test('otomatis bersihin record basi dan lanjut bikin container baru (TIDAK perlu admin turun tangan)', async () => {
      const stale = makeContainerRow({ id: 99, container_name: 'student-stale-container' });
      containerRepository.findFirstRunningByNim.mockResolvedValue(stale);
      dockerService.isContainerAlive.mockResolvedValue(false);

      const spawnResult = {
        containerId: 'docker-new-id-2',
        containerName: 'student-fresh-container',
        sshPort: 19123,
        linuxUsername: 'mahasiswa',
        linuxPassword: 'freshPass456',
      };
      dockerService.spawnContainer.mockResolvedValue(spawnResult);
      containerRepository.insert.mockResolvedValue(makeContainerRow({ id: 2, container_name: spawnResult.containerName }));

      const result = await containerService.createForStudent(NIM);

      expect(containerRepository.markDestroyed).toHaveBeenCalledWith(stale.id);
      expect(activityLogRepository.log).toHaveBeenCalledWith(NIM, 'container_auto_cleaned_stale', stale.container_name);
      expect(dockerService.spawnContainer).toHaveBeenCalledTimes(1);
      expect(result.ssh_password).toBe('freshPass456');
    });

    test('TIDAK menghapus record kalau Docker Engine sendiri tidak bisa dihubungi (beda kasus dari "container sudah tidak ada")', async () => {
      const existing = makeContainerRow();
      containerRepository.findFirstRunningByNim.mockResolvedValue(existing);
      dockerService.isContainerAlive.mockRejectedValue(new Error('connect ECONNREFUSED /var/run/docker.sock'));

      await expect(containerService.createForStudent(NIM)).rejects.toMatchObject({ code: 'DOCKER_UNREACHABLE' });

      expect(containerRepository.markDestroyed).not.toHaveBeenCalled();
      expect(dockerService.spawnContainer).not.toHaveBeenCalled();
    });
  });

  describe('compensating transaction (rollback)', () => {
    test('rollback container di Docker kalau gagal simpan ke database setelah container berhasil dibuat', async () => {
      const spawnResult = {
        containerId: 'docker-orphan-risk-id',
        containerName: 'student-will-fail-db',
        sshPort: 19124,
        linuxUsername: 'mahasiswa',
        linuxPassword: 'willRollback789',
      };
      dockerService.spawnContainer.mockResolvedValue(spawnResult);
      containerRepository.insert.mockRejectedValue(new Error('connection terminated unexpectedly'));
      dockerService.destroyContainer.mockResolvedValue(undefined);

      await expect(containerService.createForStudent(NIM)).rejects.toMatchObject({ code: 'DB_INSERT_FAILED' });

      expect(dockerService.destroyContainer).toHaveBeenCalledWith(spawnResult.containerId);
    });

    test('tetap lempar DB_INSERT_FAILED walau rollback di Docker JUGA gagal (kasus orphan, tapi ga boleh crash)', async () => {
      const spawnResult = {
        containerId: 'docker-worst-case-id',
        containerName: 'student-worst-case',
        sshPort: 19125,
        linuxUsername: 'mahasiswa',
        linuxPassword: 'worstCase000',
      };
      dockerService.spawnContainer.mockResolvedValue(spawnResult);
      containerRepository.insert.mockRejectedValue(new Error('db down'));
      dockerService.destroyContainer.mockRejectedValue(new Error('docker daemon juga down'));

      await expect(containerService.createForStudent(NIM)).rejects.toMatchObject({ code: 'DB_INSERT_FAILED' });
    });
  });

  test('menolak dengan CONTAINER_LIMIT_REACHED kalau activeCount sudah di batas MAX_CONTAINER_PER_STUDENT', async () => {
    containerRepository.findFirstRunningByNim.mockResolvedValue(null);
    containerRepository.countRunningByNim.mockResolvedValue(1);

    await expect(containerService.createForStudent(NIM)).rejects.toMatchObject({ code: 'CONTAINER_LIMIT_REACHED' });
    expect(dockerService.spawnContainer).not.toHaveBeenCalled();
  });

  test('DOCKER_SPAWN_FAILED kalau dockerService.spawnContainer melempar error', async () => {
    dockerService.spawnContainer.mockRejectedValue(new Error('no available port in range'));

    await expect(containerService.createForStudent(NIM)).rejects.toMatchObject({ code: 'DOCKER_SPAWN_FAILED' });
    expect(containerRepository.insert).not.toHaveBeenCalled();
  });
});

describe('containerService.destroyForStudent', () => {
  beforeEach(() => jest.clearAllMocks());

  test('berhasil hapus container yang dimiliki mahasiswa', async () => {
    const row = makeContainerRow();
    containerRepository.findRunningByIdAndNim.mockResolvedValue(row);
    dockerService.destroyContainer.mockResolvedValue(undefined);

    await containerService.destroyForStudent(NIM, row.id);

    expect(dockerService.destroyContainer).toHaveBeenCalledWith(row.container_id);
    expect(containerRepository.markDestroyed).toHaveBeenCalledWith(row.id);
    expect(activityLogRepository.log).toHaveBeenCalledWith(NIM, 'container_destroyed_manual', row.container_name);
  });

  test('INSTANCE_NOT_FOUND kalau container bukan milik mahasiswa ini atau sudah tidak aktif', async () => {
    containerRepository.findRunningByIdAndNim.mockResolvedValue(null);

    await expect(containerService.destroyForStudent(NIM, 999)).rejects.toMatchObject({ code: 'INSTANCE_NOT_FOUND' });
    expect(dockerService.destroyContainer).not.toHaveBeenCalled();
  });

  test('tetap tandai destroyed di DB walau hapus di Docker gagal (mahasiswa ga boleh keblokir)', async () => {
    const row = makeContainerRow();
    containerRepository.findRunningByIdAndNim.mockResolvedValue(row);
    dockerService.destroyContainer.mockRejectedValue(new Error('container sudah tidak ada'));

    await containerService.destroyForStudent(NIM, row.id);

    expect(containerRepository.markDestroyed).toHaveBeenCalledWith(row.id);
  });
});

describe('containerService.listForStudent', () => {
  test('mengembalikan daftar container dalam format publik (tanpa data sensitif seperti password hash)', async () => {
    const row = makeContainerRow();
    containerRepository.findRunningByNim.mockResolvedValue([row]);

    const result = await containerService.listForStudent(NIM);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: row.id,
      container_name: row.container_name,
      ssh_username: row.linux_username,
    });
    expect(result[0]).not.toHaveProperty('linux_password_hash');
  });
});
