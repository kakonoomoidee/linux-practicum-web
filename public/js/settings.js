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

document.getElementById('form-settings-password').addEventListener('submit', async (e) => {
  e.preventDefault();

  const old_password = document.getElementById('set-old').value;
  const new_password = document.getElementById('set-new').value;
  const confirm_password = document.getElementById('set-confirm').value;
  const btn = document.getElementById('btn-update-password');

  if (new_password !== confirm_password) {
    notify.error(i18n.mismatchError);
    return;
  }

  btn.disabled = true;
  const result = await api('POST', '/api/auth/change-password', { old_password, new_password });
  btn.disabled = false;

  if (result.ok) {
    notify.success(i18n.passwordUpdateSuccess);
    e.target.reset();
  } else {
    notify.error(result.message);
  }
});

document.getElementById('form-settings-language').addEventListener('submit', async (e) => {
  e.preventDefault();

  const lang = document.querySelector('input[name="lang"]:checked').value;
  const result = await api('POST', '/api/auth/language', { lang });

  if (result.ok) {
    notify.success(i18n.languageUpdateSuccess);
    setTimeout(() => window.location.reload(), 800);
  } else {
    notify.error(result.message);
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  window.location.href = '/login';
});
