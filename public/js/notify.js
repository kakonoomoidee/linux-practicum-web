/**
 * Wrapper tipis di atas SweetAlert2 - dipakai di semua halaman biar setiap
 * modal/notifikasi konsisten style dan behaviornya, tanpa perlu ulang-ulang
 * konfigurasi Swal.fire() di tiap file.
 */

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toastEl) => {
    toastEl.addEventListener('mouseenter', Swal.stopTimer);
    toastEl.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

function notifySuccess(message, title) {
  Toast.fire({ icon: 'success', title: title || message, text: title ? message : undefined });
}

function notifyError(message, title) {
  Toast.fire({ icon: 'error', title: title || message, text: title ? message : undefined });
}

/**
 * Modal konfirmasi (menggantikan browser confirm() bawaan).
 * Return Promise<boolean> - true kalau user klik confirm.
 */
async function confirmAction({ title, text, confirmText = 'OK', cancelText = 'Cancel', danger = false }) {
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? '#dc2626' : '#1d4ed8',
    reverseButtons: true,
  });
  return result.isConfirmed;
}

/**
 * Modal input teks (dipakai misalnya buat reset password mahasiswa oleh admin).
 * Return Promise<string|null> - null kalau dibatalkan.
 */
async function promptInput({ title, text, inputLabel, placeholder = '', confirmText = 'Submit', validator }) {
  const result = await Swal.fire({
    title,
    text,
    input: 'text',
    inputLabel,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: confirmText,
    confirmButtonColor: '#1d4ed8',
    reverseButtons: true,
    inputValidator: validator,
  });
  return result.isConfirmed ? result.value : null;
}

window.notify = { success: notifySuccess, error: notifyError };
window.confirmAction = confirmAction;
window.promptInput = promptInput;
