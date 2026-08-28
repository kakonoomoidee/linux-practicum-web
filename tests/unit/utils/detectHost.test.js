jest.mock('os');
const os = require('os');
const { detectHost } = require('../../../src/utils/detectHost');

describe('detectHost', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SSH_HOST_DISPLAY;
    delete process.env.WSL_DISTRO_NAME;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('manual override di SSH_HOST_DISPLAY SELALU menang, bahkan kalau WSL_DISTRO_NAME juga ada', () => {
    process.env.SSH_HOST_DISPLAY = '192.168.1.99';
    process.env.WSL_DISTRO_NAME = 'Ubuntu';
    os.networkInterfaces.mockReturnValue({});

    const result = detectHost();
    expect(result).toEqual({ host: '192.168.1.99', source: 'manual (SSH_HOST_DISPLAY di .env)' });
  });

  test('SSH_HOST_DISPLAY yang cuma berisi spasi dianggap KOSONG (trim), lanjut ke deteksi berikutnya', () => {
    process.env.SSH_HOST_DISPLAY = '   ';
    process.env.WSL_DISTRO_NAME = 'Ubuntu';
    os.networkInterfaces.mockReturnValue({});

    const result = detectHost();
    expect(result.host).toBe('localhost');
  });

  test('kedeteksi WSL -> pakai "localhost"', () => {
    process.env.WSL_DISTRO_NAME = 'Ubuntu-22.04';
    os.networkInterfaces.mockReturnValue({});

    const result = detectHost();
    expect(result).toEqual({ host: 'localhost', source: 'auto-detect (WSL2 localhost forwarding)' });
  });

  test('server Linux biasa - pilih interface dengan nama umum (eth0) daripada interface virtual', () => {
    os.networkInterfaces.mockReturnValue({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      docker0: [{ family: 'IPv4', internal: false, address: '172.17.0.1' }],
      eth0: [{ family: 'IPv4', internal: false, address: '10.0.5.20' }],
    });

    const result = detectHost();
    expect(result.host).toBe('10.0.5.20');
    expect(result.source).toContain('eth0');
  });

  test('lewatin interface loopback dan virtual Docker sepenuhnya, ga pernah dipilih', () => {
    os.networkInterfaces.mockReturnValue({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      'docker0': [{ family: 'IPv4', internal: false, address: '172.17.0.1' }],
      'br-abc123': [{ family: 'IPv4', internal: false, address: '172.18.0.1' }],
      'veth1234': [{ family: 'IPv4', internal: false, address: '169.254.1.1' }],
    });

    const result = detectHost();
    expect(result.host).toBe('127.0.0.1');
    expect(result.source).toContain('fallback terakhir');
  });

  test('interface dengan family IPv6 dilewati, cuma ambil IPv4', () => {
    os.networkInterfaces.mockReturnValue({
      eth0: [
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        { family: 'IPv4', internal: false, address: '10.0.5.20' },
      ],
    });

    const result = detectHost();
    expect(result.host).toBe('10.0.5.20');
  });

  test('fallback ke interface non-preferred kalau tidak ada interface dengan nama umum (eth/en/wlan)', () => {
    os.networkInterfaces.mockReturnValue({
      customIface99: [{ family: 'IPv4', internal: false, address: '10.9.9.9' }],
    });

    const result = detectHost();
    expect(result.host).toBe('10.9.9.9');
    expect(result.source).toContain('fallback');
  });

  test('fallback terakhir ke 127.0.0.1 kalau tidak ada interface sama sekali', () => {
    os.networkInterfaces.mockReturnValue({});
    const result = detectHost();
    expect(result.host).toBe('127.0.0.1');
    expect(result.source).toContain('GAGAL auto-detect');
  });
});
