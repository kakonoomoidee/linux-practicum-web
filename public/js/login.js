document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nim = document.getElementById('login-nim').value.trim();
  const password = document.getElementById('login-password').value;
  const remember_me = document.getElementById('login-remember').checked;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login-submit');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ nim, password, remember_me }),
    });
    const json = await res.json();

    if (!res.ok) {
      errorEl.textContent = json.message || 'Login gagal';
      btn.disabled = false;
      btn.textContent = 'Masuk';
      return;
    }

    window.location.href = json.data.first_login ? '/change-password' : '/dashboard';
  } catch (err) {
    errorEl.textContent = 'Tidak bisa menghubungi server, coba lagi.';
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
});
