const i18n = window.i18n || {};

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let pass = '';
  for (let i = 0; i < length; i++) pass += chars[bytes[i] % chars.length];
  return pass;
}

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

// ==== Destroy instance (event delegation, tombolnya di-render per baris dari EJS) ====
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-destroy-instance');
  if (!btn) return;

  const id = btn.dataset.id;
  const nim = btn.dataset.nim;

  const confirmed = await confirmAction({
    title: i18n.deleteConfirmTitle,
    text: `${i18n.deleteConfirmText} (NIM: ${nim})`,
    confirmText: i18n.deleteButton,
    cancelText: i18n.cancel,
    danger: true,
  });
  if (!confirmed) return;

  btn.disabled = true;
  const result = await api('POST', `/admin/instances/${id}/destroy`);

  if (result.ok) {
    notify.success(i18n.deleteSuccess);
    setTimeout(() => window.location.reload(), 1200);
  } else {
    btn.disabled = false;
    notify.error(result.message);
  }
});

// ==== Reset password mahasiswa ====
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-reset-password');
  if (!btn) return;

  const nim = btn.dataset.nim;
  const title = i18n.resetPasswordModalTitleTpl.replace('__NIM__', nim);

  const { value: newPassword } = await Swal.fire({
    title,
    html: `
      <p class="text-sm text-slate-500 mb-3 text-left">${i18n.resetPasswordModalText}</p>
      <input id="swal-new-password" type="text" class="swal2-input" placeholder="${i18n.resetPasswordPlaceholder}" style="margin: 0 0 0.5rem 0;">
      <button type="button" id="swal-generate-btn" class="text-xs text-brand-600 underline">${i18n.generateRandomButton}</button>
    `,
    showCancelButton: true,
    confirmButtonText: i18n.resetPasswordConfirmButton,
    cancelButtonText: i18n.cancel,
    confirmButtonColor: '#1d4ed8',
    reverseButtons: true,
    didOpen: () => {
      document.getElementById('swal-generate-btn').addEventListener('click', () => {
        document.getElementById('swal-new-password').value = generateRandomPassword();
      });
    },
    preConfirm: () => {
      const val = document.getElementById('swal-new-password').value;
      if (!val || val.length < 8) {
        Swal.showValidationMessage(i18n.passwordTooShort);
        return false;
      }
      return val;
    },
  });

  if (!newPassword) return;

  const result = await api('POST', `/admin/students/${nim}/reset-password`, { new_password: newPassword });

  if (result.ok) {
    // Tampilkan password barunya sekali lagi biar admin bisa copy & kasih ke mahasiswa
    await Swal.fire({
      icon: 'success',
      title: i18n.resetPasswordSuccess,
      html: `
        <p class="text-sm text-slate-500 mb-3">${i18n.resetPasswordCopyHint}</p>
        <code class="block bg-slate-900 text-green-400 px-3 py-2 rounded-lg text-sm">${newPassword}</code>
      `,
      confirmButtonColor: '#1d4ed8',
    });
  } else {
    notify.error(result.message);
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', async () => {
  await api('POST', '/admin/logout');
  window.location.href = '/admin/login';
});
