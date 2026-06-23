// ============================================
// LOGIN — gestione del form e redirect alla home
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Auto-login: se già loggato salta direttamente alla home
    if (localStorage.getItem('display_name')) {
        location.href = 'home.html';
        return;
    }
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const errorEl = document.getElementById('loginEmailError');

    // Valida: campo vuoto o, se contiene @, verifica formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = user.includes('@');
    if (!user || (isEmail && !emailRegex.test(user))) {
        errorEl.classList.remove('d-none');
        return;
    }
    errorEl.classList.add('d-none');

    // Spinner sul bottone durante il login simulato
    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    const spinner = make('span', 'spinner-border spinner-border-sm me-2');
    spinner.setAttribute('role', 'status');
    btn.replaceChildren(spinner, 'Accesso in corso...');

    await new Promise(resolve => setTimeout(resolve, 800));

    const displayName = isEmail ? user.split('@')[0] : user;
    localStorage.setItem('display_name', displayName);
    if (!localStorage.getItem('profile_join_date')) {
        localStorage.setItem('profile_join_date', new Date().toISOString());
    }
    sessionStorage.setItem('just_logged_in', '1');
    location.href = 'home.html';
}
