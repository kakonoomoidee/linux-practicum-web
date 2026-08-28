async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = getCsrfToken();

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { ok: res.ok, ...json };
}

const i18n = window.i18n || {};
const locale = window.locale || 'en-US';
let countdownInterval = null;

function showSkeleton(label) {
  document.getElementById('skeleton-label').textContent = label || i18n.loadingStatus;
  document.getElementById('skeleton-box').classList.remove('hidden');
  document.getElementById('no-container-box').classList.add('hidden');
  document.getElementById('container-box').classList.add('hidden');
}

function hideSkeleton() {
  document.getElementById('skeleton-box').classList.add('hidden');
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function showNoContainer() {
  hideSkeleton();
  stopCountdown();
  document.getElementById('no-container-box').classList.remove('hidden');
  document.getElementById('container-box').classList.add('hidden');
}

function formatDuration(ms) {
  if (ms <= 0) return i18n.expired || 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startCountdown(expiresAtIso) {
  stopCountdown();
  const expiresAt = new Date(expiresAtIso).getTime();
  const el = document.getElementById('c-countdown');

  function tick() {
    const remaining = expiresAt - Date.now();
    el.textContent = formatDuration(remaining);
    el.classList.toggle('text-red-600', remaining > 0 && remaining < 30 * 60 * 1000); // < 30 menit -> merah
    el.classList.toggle('text-brand-700', !(remaining > 0 && remaining < 30 * 60 * 1000));
    if (remaining <= 0) stopCountdown();
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function renderContainer(c, password) {
  hideSkeleton();
  document.getElementById('no-container-box').classList.add('hidden');
  document.getElementById('container-box').classList.remove('hidden');

  document.getElementById('c-name').textContent = c.container_name;
  document.getElementById('c-ssh-command').textContent = c.ssh_command;
  document.getElementById('c-username').textContent = c.ssh_username;
  document.getElementById('c-password').textContent = password || '••••••••';
  document.getElementById('c-created').textContent = new Date(c.created_at).toLocaleString(locale);
  document.getElementById('c-expires').textContent = new Date(c.expires_at).toLocaleString(locale);

  document.getElementById('password-warn').classList.toggle('hidden', !password);
  startCountdown(c.expires_at);
}

async function loadContainers() {
  showSkeleton(i18n.loadingStatus);
  const result = await api('GET', '/api/containers');
  const errorEl = document.getElementById('dash-error');
  errorEl.textContent = '';

  if (!result.ok) {
    hideSkeleton();
    errorEl.textContent = result.message;
    notify.error(result.message);
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

  showSkeleton(i18n.creating);

  const result = await api('POST', '/api/containers', {});

  if (!result.ok) {
    hideSkeleton();
    showNoContainer();
    errorEl.textContent = result.message;
    notify.error(result.message);
    return;
  }

  notify.success(i18n.createSuccessTitle);
  renderContainer(result.data, result.data.ssh_password);
});

document.getElementById('btn-destroy-container').addEventListener('click', async () => {
  const confirmed = await confirmAction({
    title: i18n.destroyConfirmTitle,
    text: i18n.destroyConfirmText,
    confirmText: i18n.destroyConfirmButton,
    cancelText: i18n.cancel,
    danger: true,
  });
  if (!confirmed) return;

  const errorEl = document.getElementById('dash-error');
  errorEl.textContent = '';

  const listResult = await api('GET', '/api/containers');
  if (!listResult.ok || listResult.data.length === 0) return;

  const id = listResult.data[0].id;

  showSkeleton(i18n.destroying);

  const del = await api('DELETE', `/api/containers/${id}`);

  if (del.ok) {
    notify.success(i18n.destroySuccessTitle);
    showNoContainer();
  } else {
    hideSkeleton();
    renderContainer(listResult.data[0]);
    errorEl.textContent = del.message;
    notify.error(del.message);
  }
});

document.getElementById('btn-copy-ssh').addEventListener('click', () => {
  const text = document.getElementById('c-ssh-command').textContent;
  navigator.clipboard.writeText(text);
  notify.success(i18n.copied);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  window.location.href = '/login';
});

loadContainers();
