document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nim = document.getElementById('login-nim').value.trim();
  const password = document.getElementById('login-password').value;
  const remember_me = document.getElementById('login-remember').checked;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login-submit');
  const i18n = window.i18n || { submitting: 'Signing in...', submit: 'Sign In' };

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = i18n.submitting;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ nim, password, remember_me }),
    });
    const json = await res.json();

    if (!res.ok) {
      errorEl.textContent = json.message;
      notify.error(json.message);
      btn.disabled = false;
      btn.textContent = i18n.submit;
      return;
    }

    window.location.href = json.data.first_login ? '/change-password' : '/dashboard';
  } catch (err) {
    const msg = 'Could not reach the server, please try again.';
    errorEl.textContent = msg;
    notify.error(msg);
    btn.disabled = false;
    btn.textContent = i18n.submit;
  }
});
