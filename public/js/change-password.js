document.getElementById('form-change-password').addEventListener('submit', async (e) => {
  e.preventDefault();

  const old_password = document.getElementById('cp-old').value;
  const new_password = document.getElementById('cp-new').value;
  const confirm_password = document.getElementById('cp-confirm').value;
  const errorEl = document.getElementById('cp-error');
  const btn = document.getElementById('btn-cp-submit');
  const i18n = window.i18n || { submitting: 'Processing...', submit: 'Change Password', mismatch: 'Passwords do not match' };

  errorEl.textContent = '';

  if (new_password !== confirm_password) {
    errorEl.textContent = i18n.mismatch;
    notify.error(i18n.mismatch);
    return;
  }

  btn.disabled = true;
  btn.textContent = i18n.submitting;

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ old_password, new_password }),
    });
    const json = await res.json();

    if (!res.ok) {
      errorEl.textContent = json.message;
      notify.error(json.message);
      btn.disabled = false;
      btn.textContent = i18n.submit;
      return;
    }

    notify.success(json.message);
    window.location.href = '/dashboard';
  } catch (err) {
    const msg = 'Could not reach the server, please try again.';
    errorEl.textContent = msg;
    notify.error(msg);
    btn.disabled = false;
    btn.textContent = i18n.submit;
  }
});
