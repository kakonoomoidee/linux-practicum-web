const os = require('os');

/**
 * Deteksi otomatis IP/host yang harus ditampilkan ke mahasiswa buat SSH,
 * tanpa perlu diisi manual di .env.
 *
 * Urutan prioritas:
 * 1. SSH_HOST_DISPLAY di .env (kalau diisi manual, ini SELALU menang - buat kasus
 *    server dengan banyak network interface di mana auto-detect bisa salah pilih).
 * 2. Kalau kedeteksi jalan di WSL (env var WSL_DISTRO_NAME ada) -> pakai "localhost".
 *    WSL2 punya fitur auto-forward: port apa pun yang listen di dalam WSL otomatis
 *    bisa diakses dari Windows lewat "localhost", tanpa perlu tau IP WSL yang
 *    internal & suka berubah-ubah tiap restart.
 * 3. Kalau bukan WSL (server Linux beneran) -> scan network interface, cari IPv4
 *    non-internal yang paling masuk akal (skip loopback & interface virtual Docker).
 * 4. Fallback terakhir -> 127.0.0.1 (bakal cuma bisa diakses dari server itu sendiri,
 *    tandanya auto-detect gagal total dan admin perlu isi SSH_HOST_DISPLAY manual).
 */
function detectHost() {
  const manual = process.env.SSH_HOST_DISPLAY && process.env.SSH_HOST_DISPLAY.trim();
  if (manual) {
    return { host: manual, source: 'manual (SSH_HOST_DISPLAY di .env)' };
  }

  if (process.env.WSL_DISTRO_NAME) {
    return { host: 'localhost', source: 'auto-detect (WSL2 localhost forwarding)' };
  }

  const interfaces = os.networkInterfaces();
  const skipPattern = /^(lo|docker|br-|veth|virbr|tun|tap)/i;
  const preferredPattern = /^(eth|en|wlan|ens|eno|wl)/i;

  let fallback = null;

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (skipPattern.test(name)) continue;
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (preferredPattern.test(name)) {
        return { host: addr.address, source: `auto-detect (interface "${name}")` };
      }
      if (!fallback) fallback = { host: addr.address, source: `auto-detect (interface "${name}", fallback)` };
    }
  }

  if (fallback) return fallback;

  return {
    host: '127.0.0.1',
    source: 'fallback terakhir - GAGAL auto-detect, cek konfigurasi jaringan atau isi SSH_HOST_DISPLAY manual di .env',
  };
}

module.exports = { detectHost };
