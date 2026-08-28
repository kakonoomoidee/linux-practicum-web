const i18n = window.i18n || {};

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

// ==== Ganti password admin ====
document.getElementById('form-admin-password').addEventListener('submit', async (e) => {
  e.preventDefault();

  const old_password = document.getElementById('admin-set-old').value;
  const new_password = document.getElementById('admin-set-new').value;
  const confirm_password = document.getElementById('admin-set-confirm').value;
  const btn = document.getElementById('btn-admin-update-password');

  if (new_password !== confirm_password) {
    notify.error(i18n.mismatchError);
    return;
  }

  btn.disabled = true;
  const result = await api('POST', '/admin/settings/password', { old_password, new_password });
  btn.disabled = false;

  if (result.ok) {
    notify.success(i18n.passwordUpdateSuccess);
    e.target.reset();
  } else {
    notify.error(result.message);
  }
});

// ==== Preferensi bahasa admin ====
document.getElementById('form-admin-language').addEventListener('submit', async (e) => {
  e.preventDefault();

  const lang = document.querySelector('input[name="lang"]:checked').value;
  const result = await api('POST', '/admin/settings/language', { lang });

  if (result.ok) {
    notify.success(i18n.languageUpdateSuccess);
    setTimeout(() => window.location.reload(), 800);
  } else {
    notify.error(result.message);
  }
});

// ==== Generate API key baru ====
document.getElementById('form-create-api-key').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nameInput = document.getElementById('api-key-name');
  const name = nameInput.value.trim();
  if (!name) return;

  const result = await api('POST', '/admin/api-keys', { name });

  if (!result.ok) {
    notify.error(result.message);
    return;
  }

  nameInput.value = '';

  // Tampilkan key mentahnya SEKALI di modal - ga akan bisa dilihat lagi setelah ini
  await Swal.fire({
    icon: 'success',
    title: i18n.apiKeyCreatedTitle,
    html: `
      <p class="text-sm text-slate-500 mb-3">${i18n.apiKeyCreatedText}</p>
      <code class="block bg-slate-900 text-green-400 px-3 py-2 rounded-lg text-sm break-all">${result.data.rawKey}</code>
    `,
    confirmButtonColor: '#1d4ed8',
  });

  window.location.reload();
});

// ==== Revoke API key (event delegation) ====
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-revoke-key');
  if (!btn) return;

  const id = btn.dataset.id;

  const confirmed = await confirmAction({
    title: i18n.revokeConfirmTitle,
    text: i18n.revokeConfirmText,
    confirmText: i18n.revokeButton,
    cancelText: i18n.cancel,
    danger: true,
  });
  if (!confirmed) return;

  btn.disabled = true;
  const result = await api('POST', `/admin/api-keys/${id}/revoke`);

  if (result.ok) {
    notify.success(i18n.revokeSuccess);
    setTimeout(() => window.location.reload(), 800);
  } else {
    btn.disabled = false;
    notify.error(result.message);
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', async () => {
  await api('POST', '/admin/logout');
  window.location.href = '/admin/login';
});
