const Docker = require('dockerode');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');

const docker = new Docker({ socketPath: config.docker.socketPath });

/**
 * Pastikan isolated network buat container mahasiswa sudah ada.
 * enable_icc=false -> container ga bisa saling akses satu sama lain.
 */
async function ensureNetwork() {
  const networks = await docker.listNetworks();
  const exists = networks.some((n) => n.Name === config.docker.networkName);
  if (exists) return;

  await docker.createNetwork({
    Name: config.docker.networkName,
    Driver: 'bridge',
    Options: {
      'com.docker.network.bridge.enable_icc': 'false',
    },
  });
  logger.info(`Network isolated "${config.docker.networkName}" dibuat (ICC disabled)`, { event: 'docker_network_created' });
}

async function findAvailablePort(usedPorts) {
  const containers = await docker.listContainers({ all: true });
  const dockerUsedPorts = new Set();
  containers.forEach((c) => {
    (c.Ports || []).forEach((p) => {
      if (p.PublicPort) dockerUsedPorts.add(p.PublicPort);
    });
  });

  for (let port = config.ssh.portMin; port <= config.ssh.portMax; port++) {
    if (!usedPorts.has(port) && !dockerUsedPorts.has(port)) {
      return port;
    }
  }
  throw new Error('Tidak ada port SSH yang tersedia di range yang ditentukan');
}

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pass = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

/**
 * Cek ke Docker Engine langsung apakah container ini BENERAN masih hidup.
 * Dipakai buat self-healing: kalau record di DB bilang 'running' tapi container-nya
 * udah ga ada di Docker (misal dihapus manual/crash), kita bisa auto-bersihin
 * record basi itu daripada mahasiswa keblokir permanen.
 */
async function isContainerAlive(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Running === true;
  } catch (err) {
    if (err.statusCode === 404) return false; // container beneran udah ga ada
    // Error lain (misal Docker daemon lagi down) - jangan asumsikan mati, lempar ke atas
    throw err;
  }
}

/**
 * Spawn container baru untuk mahasiswa.
 */
async function spawnContainer(nim, usedPorts) {
  await ensureNetwork();

  const sshPort = await findAvailablePort(usedPorts);
  const containerName = `student-${nim}-${Date.now()}`;
  const linuxUsername = 'mahasiswa';
  const linuxPassword = generatePassword();

  const container = await docker.createContainer({
    Image: config.docker.studentImage,
    name: containerName,
    Hostname: `praktikum-${nim}`,
    Env: [
      `STUDENT_USER=${linuxUsername}`,
      `STUDENT_PASS=${linuxPassword}`,
    ],
    HostConfig: {
      NetworkMode: config.docker.networkName,
      PortBindings: {
        '22/tcp': [{ HostIp: '0.0.0.0', HostPort: String(sshPort) }],
      },
      Memory: config.container.memoryMb * 1024 * 1024,
      MemorySwap: config.container.memoryMb * 1024 * 1024,
      NanoCpus: Math.floor(config.container.cpuLimit * 1e9),
      PidsLimit: 256,
      StorageOpt: config.container.diskQuotaMb ? { size: `${config.container.diskQuotaMb}M` } : undefined,
      RestartPolicy: { Name: 'no' },
      CapDrop: ['ALL'],
      CapAdd: ['CHOWN', 'SETUID', 'SETGID', 'DAC_OVERRIDE', 'FOWNER', 'AUDIT_WRITE'],
      SecurityOpt: ['no-new-privileges'],
    },
    ExposedPorts: { '22/tcp': {} },
  });

  await container.start();

  return { containerId: container.id, containerName, sshPort, linuxUsername, linuxPassword };
}

async function destroyContainer(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect().catch(() => null);
    if (!info) return; // udah ga ada, anggap sukses
    if (info.State.Running) {
      await container.stop({ t: 5 });
    }
    await container.remove({ force: true });
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
}

async function getContainerStats(containerId) {
  const container = docker.getContainer(containerId);
  return container.stats({ stream: false });
}

module.exports = {
  ensureNetwork,
  spawnContainer,
  destroyContainer,
  isContainerAlive,
  getContainerStats,
  generatePassword,
};
