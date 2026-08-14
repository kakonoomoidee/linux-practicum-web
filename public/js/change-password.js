document.getElementById('form-change-password').addEventListener('submit', async (e) => {
  e.preventDefault();

  const old_password = document.getElementById('cp-old').value;
  const new_password = document.getElementById('cp-new').value;
  const confirm_password = document.getElementById('cp-confirm').value;
  const errorEl = document.getElementById('cp-error');
  const btn = document.getElementById('btn-cp-submit');

  errorEl.textContent = '';

  if (new_password !== confirm_password) {
    errorEl.textContent = 'Password baru dan konfirmasi tidak sama';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ old_password, new_password }),
    });
    const json = await res.json();

    if (!res.ok) {
      errorEl.textContent = json.message || 'Gagal ganti password';
      btn.disabled = false;
      btn.textContent = 'Ganti Password';
      return;
    }

    window.location.href = '/dashboard';
  } catch (err) {
    errorEl.textContent = 'Tidak bisa menghubungi server, coba lagi.';
    btn.disabled = false;
    btn.textContent = 'Ganti Password';
  }
});
