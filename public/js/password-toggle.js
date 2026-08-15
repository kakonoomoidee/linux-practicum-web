// Toggle show/hide buat semua input password yang punya tombol dengan class "toggle-password"
// dan atribut data-target berisi id input yang mau di-toggle.
document.querySelectorAll('.toggle-password').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    const eyeIcon = btn.querySelector('.icon-eye');
    const eyeSlashIcon = btn.querySelector('.icon-eye-slash');
    const isCurrentlyPassword = input.type === 'password';

    input.type = isCurrentlyPassword ? 'text' : 'password';
    eyeIcon.classList.toggle('hidden', isCurrentlyPassword);
    eyeSlashIcon.classList.toggle('hidden', !isCurrentlyPassword);

    btn.setAttribute('aria-label', isCurrentlyPassword ? 'Sembunyikan password' : 'Tampilkan password');
  });
});
