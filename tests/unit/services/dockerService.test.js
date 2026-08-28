jest.mock('dockerode');

const Docker = require('dockerode');

const mockInspect = jest.fn();
const mockGetContainer = jest.fn(() => ({ inspect: mockInspect, stop: jest.fn(), remove: jest.fn() }));

Docker.mockImplementation(() => ({
  getContainer: mockGetContainer,
  listNetworks: jest.fn().mockResolvedValue([]),
  createNetwork: jest.fn().mockResolvedValue(undefined),
  listContainers: jest.fn().mockResolvedValue([]),
}));

const dockerService = require('../../../src/services/dockerService');

describe('dockerService.isContainerAlive', () => {
  beforeEach(() => jest.clearAllMocks());

  test('return true kalau container ada dan statusnya Running', async () => {
    mockInspect.mockResolvedValue({ State: { Running: true } });
    const result = await dockerService.isContainerAlive('docker-abc');
    expect(result).toBe(true);
  });

  test('return false kalau container ada tapi statusnya TIDAK Running (mis. stopped/exited)', async () => {
    mockInspect.mockResolvedValue({ State: { Running: false } });
    const result = await dockerService.isContainerAlive('docker-abc');
    expect(result).toBe(false);
  });

  test('return false kalau Docker Engine bilang container TIDAK DITEMUKAN (404) - ini kasus self-healing', async () => {
    const notFoundError = new Error('no such container');
    notFoundError.statusCode = 404;
    mockInspect.mockRejectedValue(notFoundError);
    const result = await dockerService.isContainerAlive('docker-abc');
    expect(result).toBe(false);
  });

  test('MELEMPAR ULANG error kalau Docker Engine sendiri tidak bisa dihubungi (BUKAN 404) - jangan diasumsikan mati', async () => {
    const connectionError = new Error('connect ECONNREFUSED /var/run/docker.sock');
    mockInspect.mockRejectedValue(connectionError);
    await expect(dockerService.isContainerAlive('docker-abc')).rejects.toThrow('connect ECONNREFUSED');
  });

  test('MELEMPAR ULANG error kalau statusCode BUKAN 404 (mis. 500 dari Docker Engine)', async () => {
    const serverError = new Error('internal docker error');
    serverError.statusCode = 500;
    mockInspect.mockRejectedValue(serverError);
    await expect(dockerService.isContainerAlive('docker-abc')).rejects.toThrow('internal docker error');
  });
});

describe('dockerService.generatePassword', () => {
  test('menghasilkan password dengan panjang default 10 karakter', () => {
    expect(dockerService.generatePassword()).toHaveLength(10);
  });

  test('menghasilkan password sesuai panjang yang diminta', () => {
    expect(dockerService.generatePassword(16)).toHaveLength(16);
  });

  test('tidak mengandung karakter ambigu (0/O, 1/l/I) yang bisa bikin bingung mahasiswa ngetik manual', () => {
    for (let i = 0; i < 50; i++) {
      expect(dockerService.generatePassword(20)).not.toMatch(/[0O1lI]/);
    }
  });

  test('dua panggilan berturut-turut menghasilkan password yang BERBEDA (acak, bukan hardcoded)', () => {
    expect(dockerService.generatePassword()).not.toBe(dockerService.generatePassword());
  });
});

describe('dockerService.destroyContainer', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sukses tanpa error kalau container sudah tidak ada (404) - dianggap "sudah tercapai tujuannya"', async () => {
    const container = { stop: jest.fn(), remove: jest.fn() };
    container.inspect = jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }));
    mockGetContainer.mockReturnValue(container);

    await expect(dockerService.destroyContainer('docker-abc')).resolves.toBeUndefined();
    expect(container.stop).not.toHaveBeenCalled();
    expect(container.remove).not.toHaveBeenCalled();
  });
});
