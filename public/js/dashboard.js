async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { ok: res.ok, ...json };
}

function showSkeleton(label) {
  document.getElementById('skeleton-label').textContent = label || 'Memuat...';
  document.getElementById('skeleton-box').classList.remove('hidden');
  document.getElementById('no-container-box').classList.add('hidden');
  document.getElementById('container-box').classList.add('hidden');
}

function hideSkeleton() {
  document.getElementById('skeleton-box').classList.add('hidden');
}

function showNoContainer() {
  hideSkeleton();
  document.getElementById('no-container-box').classList.remove('hidden');
  document.getElementById('container-box').classList.add('hidden');
}

function renderContainer(c, password) {
  hideSkeleton();
  document.getElementById('no-container-box').classList.add('hidden');
  document.getElementById('container-box').classList.remove('hidden');

  document.getElementById('c-name').textContent = c.container_name;
  document.getElementById('c-status').textContent = c.status;
  document.getElementById('c-ssh-command').textContent = c.ssh_command;
  document.getElementById('c-username').textContent = c.ssh_username;
  document.getElementById('c-password').textContent = password || '(hanya tampil sekali saat pembuatan)';
  document.getElementById('c-created').textContent = new Date(c.created_at).toLocaleString('id-ID');
  document.getElementById('c-expires').textContent = new Date(c.expires_at).toLocaleString('id-ID');

  document.getElementById('password-warn').classList.toggle('hidden', !password);
}

async function loadContainers() {
  showSkeleton('Memuat status container...');
  const result = await api('GET', '/api/containers');
  const errorEl = document.getElementById('dash-error');
  errorEl.textContent = '';

  if (!result.ok) {
    hideSkeleton();
    errorEl.textContent = result.message;
    return;
  }

  if (result.data.length === 0) {
    showNoContainer();
  } else {
    renderContainer(result.data[0]);
  }
}

document.getElementById('btn-create-container').addEventListener('click', async () => {
  const errorEl = document.getElementById('dash-error');
  errorEl.textContent = '';

  showSkeleton('Membuat container baru... (bisa beberapa detik)');

  const result = await api('POST', '/api/containers', {});

  if (!result.ok) {
    hideSkeleton();
    showNoContainer();
    errorEl.textContent = result.message;
    return;
  }

  renderContainer(result.data, result.data.ssh_password);
});

document.getElementById('btn-destroy-container').addEventListener('click', async () => {
  if (!confirm('Yakin mau hapus container? Semua data di dalamnya akan hilang.')) return;

  const errorEl = document.getElementById('dash-error');
  errorEl.textContent = '';

  const listResult = await api('GET', '/api/containers');
  if (!listResult.ok || listResult.data.length === 0) return;

  const id = listResult.data[0].id;

  showSkeleton('Menghapus container...');

  const del = await api('DELETE', `/api/containers/${id}`);

  if (del.ok) {
    showNoContainer();
  } else {
    hideSkeleton();
    renderContainer(listResult.data[0]); // balikin tampilan container karena gagal dihapus
    errorEl.textContent = del.message;
  }
});

document.getElementById('btn-copy-ssh').addEventListener('click', () => {
  const text = document.getElementById('c-ssh-command').textContent;
  navigator.clipboard.writeText(text);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  window.location.href = '/login';
});

loadContainers();
